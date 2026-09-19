// src/app/api/actividad/route.js — Actividad reciente vía API interna.
import { auth } from "@/auth";
import { getFuentes } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const fuentes = (await getFuentes(userId).catch(() => [])) || [];
    const ultima = Array.isArray(fuentes) && fuentes.length > 0 ? fuentes[0] : null;
    const ultimaFuente = ultima
      ? { titulo: ultima.titulo || ultima.nombre || null, creado_en: ultima.creado_en || null }
      : null;
    return NextResponse.json(
      { ultimaFuente },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error al obtener actividad vía API:", error?.message || error);
    return NextResponse.json({ error: "Error al obtener actividad" }, { status: 500 });
  }
}
