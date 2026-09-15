// src/app/api/actividad/route.js — Actividad reciente de la cuenta
// (última fuente agregada) para la subvista de Seguridad.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [[ultimaFuente]] = await db.query(
      "SELECT titulo, creado_en FROM fuentes_rss WHERE usuario_id = ? ORDER BY id DESC LIMIT 1",
      [userId]
    );
    return NextResponse.json(
      { ultimaFuente: ultimaFuente || null },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error al obtener actividad:", error);
    return NextResponse.json({ error: "Error al obtener actividad" }, { status: 500 });
  }
}
