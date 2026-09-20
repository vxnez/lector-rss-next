// src/app/api/cron/refresh/route.js — Refresco programado vía backend.
// Vercel Cron dispara aquí (ver vercel.json); este handler lista usuarios y
// refresca cada uno contra la API interna, agregando el resultado.
// Sin MySQL directo. Requiere CRON_SECRET como Bearer en producción.
import { api, refreshFuentes } from "@/lib/api";
import { sendPushToUser } from "@/lib/push";
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
    const lista = await api("/api/users").catch(() => []);
    const usuarios = Array.isArray(lista)
      ? lista
      : lista?.data || lista?.users || lista?.usuarios || [];
    let usuariosProcesados = 0;
    let totalNuevas = 0;
    const errores = [];
    for (const u of usuarios) {
      const uid = u?.id;
      if (uid === undefined || uid === null) continue;
      try {
        // Presupuesto acotado por usuario para no quemar los 60s de Vercel.
        const r = await refreshFuentes(uid, null, { timeoutMs: 20000 });
        const nuevos = Number(r?.nuevos) || 0;
        usuariosProcesados++;
        totalNuevas += nuevos;
        if (nuevos > 0) {
          await sendPushToUser(uid, {
            title: "RSS Dashboard",
            body: `${nuevos} noticias nuevas`,
            url: "/",
          }).catch(() => null);
        }
      } catch (error) {
        errores.push({ id: uid, error: String(error?.message || error).slice(0, 120) });
      }
    }
    return NextResponse.json({
      usuariosProcesados,
      totalNuevas,
      ...(errores.length > 0 ? { errores: errores.slice(0, 10) } : {}),
    });
  } catch (error) {
    console.error("[CRON] Error general vía API:", error?.message || error);
    return NextResponse.json({ error: "Error en el cron" }, { status: 500 });
  }
}
