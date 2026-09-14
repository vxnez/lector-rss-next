// src/app/api/cron/refresh/route.js — Auto-refresh de feeds (Vercel Cron).
// Requiere CRON_SECRET en Vercel: el cron envía Authorization: Bearer <secret>.
// Sin CRON_SECRET solo se permite en desarrollo.
//
// Frecuencia (vercel.json): el plan Hobby solo permite 1 ejecución diaria
// (aquí "0 12 * * *" = entre las 12:00 y 12:59 UTC). Para mayor frecuencia
// en Hobby, usar un programador externo (p. ej. cron-job.org) contra esta
// misma ruta con Authorization: Bearer <CRON_SECRET>. En Pro se puede usar
// "*/45 * * * *". Nota: vercel.json debe ser JSON puro, sin comentarios.
import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";
import { refrescarFuentesDeUsuario } from "@/app/api/rss/route";
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
    const [usuarios] = await db.query(
      "SELECT DISTINCT usuario_id FROM fuentes_rss"
    );

    let usuariosProcesados = 0;
    let totalNuevas = 0;
    // Secuencial por usuario para no exceder el pool ni el tiempo del cron.
    for (const { usuario_id } of usuarios) {
      try {
        const resumen = await refrescarFuentesDeUsuario(usuario_id, {
          restoreToday: false,
        });
        usuariosProcesados++;
        totalNuevas += resumen.nuevos;
        if (resumen.nuevos > 0) {
          await sendPushToUser(usuario_id, {
            title: "RSS Dashboard",
            body:
              resumen.nuevos === 1
                ? "Tienes 1 noticia nueva en tus fuentes."
                : `Tienes ${resumen.nuevos} noticias nuevas en tus fuentes.`,
            url: "/",
          });
        }
      } catch (err) {
        console.error(`[CRON] Usuario ${usuario_id}:`, err.message);
      }
    }

    return NextResponse.json({ usuariosProcesados, totalNuevas });
  } catch (error) {
    console.error("[CRON] Error general:", error);
    return NextResponse.json({ error: "Error en el cron" }, { status: 500 });
  }
}
