// src/app/api/push/route.js — Alta/baja de suscripciones Web Push.
// Proxy best-effort a la API interna; sin endpoint de push en el backend se
// responde ok local para no romper el frontend. Sin MySQL directo.
import { auth } from "@/auth";
import { api } from "@/lib/api";
import { resolverUsuarioId } from "@/lib/invitado";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("dispositivos") === "1") {
    try {
      const session = await auth();
      const userId = await resolverUsuarioId(req, session);
      if (!userId) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
      }
      try {
        const data = await api(`/api/push/subscriptions?usuario_id=${encodeURIComponent(userId)}`);
        const rows = Array.isArray(data) ? data : data?.data || [];
        return NextResponse.json(rows);
      } catch {
        return NextResponse.json([]);
      }
    } catch (error) {
      console.error("Error al listar push vía API:", error?.message || error);
      return NextResponse.json({ error: "Error al listar dispositivos" }, { status: 500 });
    }
  }
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}

export async function POST(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const { endpoint, keys } = await req.json().catch(() => ({}));

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Suscripción incompleta" }, { status: 400 });
    }

    try {
      await api("/api/push/subscriptions", {
        method: "POST",
        body: { usuario_id: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      });
    } catch (error) {
      // Backend sin push: se acepta localmente para no romper el frontend.
      console.warn("Push no persistido en backend:", error?.message || error);
    }
    return NextResponse.json({ message: "Suscripción guardada" }, { status: 201 });
  } catch (error) {
    console.error("Error al guardar push:", error?.message || error);
    return NextResponse.json({ error: "Error al guardar suscripción" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);

    if (searchParams.get("all") === "true") {
      try {
        await api(`/api/push/subscriptions?usuario_id=${encodeURIComponent(userId)}`, {
          method: "DELETE",
        });
      } catch (error) {
        console.warn("Push no eliminado en backend:", error?.message || error);
      }
      return NextResponse.json({ message: "Todas las suscripciones eliminadas" });
    }

    const { endpoint } = await req.json().catch(() => ({}));

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 });
    }

    try {
      await api("/api/push/subscriptions", {
        method: "DELETE",
        body: { usuario_id: userId, endpoint },
      });
    } catch (error) {
      console.warn("Push no eliminado en backend:", error?.message || error);
    }
    return NextResponse.json({ message: "Suscripción eliminada" });
  } catch (error) {
    console.error("Error al eliminar push:", error?.message || error);
    return NextResponse.json({ error: "Error al eliminar suscripción" }, { status: 500 });
  }
}
