// src/app/api/auth/invitado/route.js
// Gestión del modo invitado:
// POST { action: "crear" } -> crea un usuario temporal y fija la cookie de sesión.
// POST { action: "salir" } / DELETE -> elimina toda su información y limpia la cookie.
// GET -> indica si hay una sesión de invitado válida.
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { INVITADO_COOKIE, INVITADO_PROVEEDOR, firmarInvitado, invitadoIdDesdeRequest } from "@/lib/invitado";

const PURGA_HORAS = 24;

async function eliminarInvitado(id) {
  const [filas] = await db.query(
    "SELECT email FROM usuarios WHERE id = ? AND proveedor = ?",
    [id, INVITADO_PROVEEDOR]
  );
  const usuario = filas[0];
  if (!usuario) return false;
  const [fuentes] = await db.query("SELECT id FROM fuentes_rss WHERE usuario_id = ?", [id]);
  const ids = fuentes.map((f) => f.id);
  if (ids.length > 0) {
    await db.query(
      `DELETE FROM articulos_publicados WHERE fuente_id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
  }
  await db.query("DELETE FROM fuentes_rss WHERE usuario_id = ?", [id]);
  try {
    await db.query("DELETE FROM recuperacion_codigos WHERE email = ?", [usuario.email]);
  } catch {
    // La tabla de recuperación puede no existir aún: no bloquea la limpieza.
  }
  await db.query("DELETE FROM usuarios WHERE id = ?", [id]);
  return true;
}

async function purgarInvitadosViejos() {
  try {
    const [viejos] = await db.query(
      "SELECT id FROM usuarios WHERE proveedor = ? AND creado_en < DATE_SUB(NOW(), INTERVAL ? HOUR)",
      [INVITADO_PROVEEDOR, PURGA_HORAS]
    );
    for (const fila of viejos) {
      try {
        await eliminarInvitado(fila.id);
      } catch {
        // Se continúa con el siguiente invitado.
      }
    }
  } catch {
    // La purga es mantenimiento best-effort: nunca bloquea la entrada.
  }
}

function limpiarCookie(res) {
  res.cookies.set(INVITADO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req) {
  const id = invitadoIdDesdeRequest(req);
  if (!id) return NextResponse.json({ invitado: false }, { status: 401 });
  try {
    const [filas] = await db.query(
      "SELECT id FROM usuarios WHERE id = ? AND proveedor = ?",
      [id, INVITADO_PROVEEDOR]
    );
    if (!filas[0]) {
      return limpiarCookie(NextResponse.json({ invitado: false }, { status: 401 }));
    }
    return NextResponse.json({ invitado: true });
  } catch (error) {
    console.error("Error al verificar invitado:", error);
    return NextResponse.json({ invitado: false }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { action } = await req.json().catch(() => ({}));

    if (action === "salir") {
      const id = invitadoIdDesdeRequest(req);
      if (id) {
        try {
          await eliminarInvitado(id);
        } catch (error) {
          console.error("Error al eliminar invitado:", error);
        }
      }
      return limpiarCookie(NextResponse.json({ ok: true }));
    }

    // Crear invitado: primero se purgan los invitados viejos olvidados.
    await purgarInvitadosViejos();
    const email = `invitado_${Date.now().toString(36)}${crypto.randomInt(100000, 999999)}@invitado.local`;
    const secreto = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
    const [resultado] = await db.query(
      "INSERT INTO usuarios (nombre, email, password_hash, proveedor) VALUES (?, ?, ?, ?)",
      ["Invitado", email, secreto, INVITADO_PROVEEDOR]
    );
    const res = NextResponse.json({ ok: true });
    // Cookie de sesión (sin maxAge): se pierde al cerrar el navegador.
    res.cookies.set(INVITADO_COOKIE, firmarInvitado(resultado.insertId), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (error) {
    console.error("Error en modo invitado:", error);
    return NextResponse.json({ error: "No se pudo iniciar como invitado." }, { status: 500 });
  }
}

export async function DELETE(req) {
  const id = invitadoIdDesdeRequest(req);
  if (id) {
    try {
      await eliminarInvitado(id);
    } catch (error) {
      console.error("Error al eliminar invitado:", error);
    }
  }
  return limpiarCookie(NextResponse.json({ ok: true }));
}
