// src/app/api/auth/invitado/route.js
// Modo invitado vía API interna (sin MySQL directo):
// POST { action: "crear" } -> POST /api/users + cookie firmada.
// POST { action: "salir" } / DELETE -> DELETE /api/users/:id + limpiar cookie.
// GET -> GET /api/users/:id verifica la sesión.
import crypto from "crypto";
import { NextResponse } from "next/server";
import { INVITADO_COOKIE, INVITADO_PROVEEDOR, firmarInvitado, invitadoIdDesdeRequest } from "@/lib/invitado";
import { createUser, deleteUser, getUser } from "@/lib/api";

function limpiarCookie(res) {
  res.cookies.set(INVITADO_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

async function esInvitadoValido(id) {
  try {
    const data = await getUser(id);
    const u = data?.user || data?.usuario || data;
    if (!u?.id) return null;
    return u;
  } catch {
    return null;
  }
}

export async function GET(req) {
  const id = invitadoIdDesdeRequest(req);
  if (!id) return NextResponse.json({ invitado: false }, { status: 401 });
  const u = await esInvitadoValido(id);
  if (!u) {
    return limpiarCookie(NextResponse.json({ invitado: false }, { status: 401 }));
  }
  return NextResponse.json({ invitado: true });
}

export async function POST(req) {
  try {
    const { action } = await req.json().catch(() => ({}));

    if (action === "salir") {
      const id = invitadoIdDesdeRequest(req);
      if (id) {
        try {
          await deleteUser(id);
        } catch (error) {
          console.error("Error al eliminar invitado vía API:", error?.message || error);
        }
      }
      return limpiarCookie(NextResponse.json({ ok: true }));
    }

    // Crear invitado efímero vía API interna.
    const email = `invitado_${Date.now().toString(36)}${crypto.randomInt(100000, 999999)}@invitado.local`;
    const secreto = crypto.randomBytes(32).toString("hex");
    let nuevoId = null;
    try {
      const creado = await createUser({
        nombre: "Invitado",
        email,
        password: secreto,
        proveedor: INVITADO_PROVEEDOR,
      });
      nuevoId = creado?.user?.id || creado?.usuario?.id || creado?.id || creado?.insertId || null;
    } catch (error) {
      console.error("Error al crear invitado vía API:", error?.message || error);
      return NextResponse.json({ error: "No se pudo iniciar como invitado." }, { status: 500 });
    }
    if (!nuevoId) {
      return NextResponse.json({ error: "No se pudo iniciar como invitado." }, { status: 500 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(INVITADO_COOKIE, firmarInvitado(nuevoId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return res;
  } catch (error) {
    console.error("Error en modo invitado vía API:", error?.message || error);
    return NextResponse.json({ error: "No se pudo iniciar como invitado." }, { status: 500 });
  }
}

export async function DELETE(req) {
  const id = invitadoIdDesdeRequest(req);
  if (id) {
    try {
      await deleteUser(id);
    } catch (error) {
      console.error("Error al eliminar invitado vía API:", error?.message || error);
    }
  }
  return limpiarCookie(NextResponse.json({ ok: true }));
}
