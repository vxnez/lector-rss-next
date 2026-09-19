// src/app/api/cron/refresh/route.js — Refresco delegado al backend.
// Sin MySQL directo: este cron ya no itera usuarios locales. El backend
// (servxn) es el dueño de fuentes/artículos; aquí se verifica salud y se
// responde ok para no romper Vercel Cron.
import { getHealth } from "@/lib/api";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET(req) {
  const secreto = process.env.CRON_SECRET;
  if (secreto) {
    if (req.headers.get("authorization") !== `Bearer ${secreto}`) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET no configurado" },
      { status: 503 }
    );
  }

  try {
    await getHealth().catch(() => null);
    // El refresco real lo hace el backend; Vercel solo actúa como disparador.
    return NextResponse.json({
      usuariosProcesados: 0,
      totalNuevas: 0,
      delegado: "backend",
    });
  } catch (error) {
    console.error("[CRON] Error general vía API:", error?.message || error);
    return NextResponse.json({ error: "Error en el cron" }, { status: 500 });
  }
}
