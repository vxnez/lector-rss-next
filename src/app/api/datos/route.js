// src/app/api/datos/route.js — Exportar y eliminar datos propios vía API interna.
// Solo sesión real (como /api/perfil); invitados usan salir (efímero).
import { auth } from "@/auth";
import { deleteUser, getArticulos, getFuentes, getUser } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [usuario, fuentes, articulosRes] = await Promise.all([
      getUser(userId),
      getFuentes(userId).catch(() => []),
      getArticulos({ usuario_id: userId, limit: 100000, offset: 0 }).catch(() => []),
    ]);
    const usuarioNorm = usuario?.user || usuario?.usuario || usuario;
    if (!usuarioNorm?.id && !usuarioNorm?.email) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const articulos = Array.isArray(articulosRes)
      ? articulosRes
      : articulosRes?.articulos || articulosRes?.articles || articulosRes?.data || [];
    return NextResponse.json({
      exportado_en: new Date().toISOString(),
      usuario: usuarioNorm,
      fuentes: fuentes || [],
      articulos: articulos || [],
    });
  } catch (error) {
    console.error("Error al exportar datos vía API:", error?.message || error);
    return NextResponse.json({ error: "Error al exportar datos" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    // Borrado delegado al backend (elimina cuenta + asociados).
    await deleteUser(userId);
    return NextResponse.json({ message: "Cuenta y datos eliminados" });
  } catch (error) {
    console.error("Error al eliminar datos vía API:", error?.message || error);
    const status = Number(error?.status) || 500;
    if (status === 404) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error al eliminar datos" }, { status: 500 });
  }
}
