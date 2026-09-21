// src/app/api/ia/progreso/route.js — Telemetría barata del avance IA.
// Proxy autenticado a GET /api/ia/progreso del backend:
// {pendientes, en_curso, actualizados_en}. El cliente lo sondea cada ~3 s
// solo durante corridas (nunca WebSockets: sin conexiones persistentes en
// serverless y tope de 60 s por función).
import { auth } from "@/auth";
import { resolverUsuarioId } from "@/lib/invitado";
import { getIAProgreso } from "@/lib/api";
import { NextResponse } from "next/server";

const VACIO = { pendientes: 0, en_curso: false, actualizados_en: null };

export async function GET(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const data = await getIAProgreso(userId).catch(() => null);
    if (!data || typeof data !== "object") {
      return NextResponse.json(VACIO, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }
    return NextResponse.json(
      {
        pendientes: Number(data.pendientes) || 0,
        en_curso: data.en_curso === true,
        actualizados_en: data.actualizados_en || null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Error al obtener progreso IA:", error?.message || error);
    return NextResponse.json(VACIO, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
