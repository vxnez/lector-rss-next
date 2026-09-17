// src/lib/invitado.js
// Sesión de invitado: cookie de sesión firmada (sin expiración -> muere al
// cerrar el navegador) que identifica a un usuario temporal en la BD.
// Toda su información se elimina al salir o con la purga de invitados viejos.
import crypto from "crypto";

export const INVITADO_COOKIE = "lector_invitado";
export const INVITADO_PROVEEDOR = "invitado";

let secretoAvisado = false;

function secreto() {
  const valor = process.env.AUTH_SECRET;
  if (!valor) {
    // Fail-closed en producción: sin secreto único la cookie sería
    // falsificable con la constante pública. En desarrollo se permite
    // con aviso explícito.
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

// Resuelve el usuario efectivo: cuenta real, invitado válido o null.
// Fail-closed: sin sesión ni invitado verificable NO se resuelve a
// ningún usuario (antes se devolvía el id literal 1). Los handlers
// responden 401 cuando esto es null.
export async function resolverUsuarioId(req, session) {
  if (session?.user?.id) return session.user.id;
  const invitadoId = invitadoIdDesdeRequest(req);
  if (invitadoId) {
    try {
      const { db } = await import("@/lib/db");
      const [filas] = await db.query("SELECT id FROM usuarios WHERE id = ? AND proveedor = ?", [
        invitadoId,
        INVITADO_PROVEEDOR,
      ]);
      if (filas[0]) return invitadoId;
    } catch {
      // Error al verificar: se niega en vez de caer al valor por defecto.
      return null;
    }
  }
  return null;
}
