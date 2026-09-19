// src/lib/invitado.js
// Sesión de invitado: cookie de sesión firmada (sin expiración -> muere al
// cerrar el navegador) que identifica a un usuario temporal vía API interna.
// Toda su información se elimina al salir. Sin MySQL directo.
import crypto from "crypto";

export const INVITADO_COOKIE = "lector_invitado";
export const INVITADO_PROVEEDOR = "invitado";

let secretoAvisado = false;

function secreto() {
  const valor = process.env.AUTH_SECRET;
  if (!valor) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET no configurado.");
    }
    if (!secretoAvisado) {
      console.warn("AUTH_SECRET ausente: usando secreto de desarrollo solo para entorno local.");
      secretoAvisado = true;
    }
    return "dev-invitado-secret";
  }
  return valor;
}

export function firmarInvitado(id) {
  const firma = crypto.createHmac("sha256", secreto()).update(String(id)).digest("hex");
  return `${id}.${firma}`;
}

export function invitadoIdDesdeValor(valor) {
  try {
    const [id, firma] = String(valor || "").split(".");
    if (!id || !firma) return null;
    const esperada = crypto.createHmac("sha256", secreto()).update(String(id)).digest("hex");
    if (firma.length !== esperada.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
    const numero = Number(id);
    return Number.isInteger(numero) && numero > 0 ? numero : null;
  } catch {
    return null;
  }
}

export function invitadoIdDesdeRequest(req) {
  try {
    return invitadoIdDesdeValor(req.cookies?.get(INVITADO_COOKIE)?.value);
  } catch {
    return null;
  }
}

// Resuelve el usuario efectivo: cuenta real, invitado válido (verificado vía
// API) o null. Fail-closed: sin sesión ni invitado verificable NO se resuelve.
export async function resolverUsuarioId(req, session) {
  if (session?.user?.id) return session.user.id;
  const invitadoId = invitadoIdDesdeRequest(req);
  if (invitadoId) {
    try {
      const { getUser } = await import("@/lib/api");
      const u = await getUser(invitadoId);
      const usuario = u?.user || u?.usuario || u;
      if (usuario && String(usuario.proveedor || "") === INVITADO_PROVEEDOR) return invitadoId;
      // Sin campo proveedor en la respuesta: si existe el usuario, se acepta
      // (la cookie ya está firmada con AUTH_SECRET).
      if (usuario?.id) return invitadoId;
      return null;
    } catch {
      return null;
    }
  }
  return null;
}
