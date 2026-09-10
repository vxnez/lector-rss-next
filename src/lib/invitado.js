// src/lib/invitado.js
// Sesión de invitado: cookie de sesión firmada (sin expiración -> muere al
// cerrar el navegador) que identifica a un usuario temporal en la BD.
// Toda su información se elimina al salir o con la purga de invitados viejos.
import crypto from "crypto";

export const INVITADO_COOKIE = "lector_invitado";
export const INVITADO_PROVEEDOR = "invitado";

function secreto() {
  return process.env.AUTH_SECRET || "dev-invitado-secret";
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

// Resuelve el usuario efectivo: cuenta real, invitado válido o el valor por defecto.
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
      // Si no se puede verificar, se cae al valor por defecto.
    }
  }
  return 1;
}
