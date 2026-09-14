// src/app/api/push/route.js — Alta/baja de suscripciones Web Push por usuario.
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolverUsuarioId } from "@/lib/invitado";
import { NextResponse } from "next/server";

// Clave pública VAPID para que el navegador cree la suscripción.
export async function GET() {
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null });
}

export async function POST(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    const { endpoint, keys } = await req.json().catch(() => ({}));

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Suscripción incompleta" }, { status: 400 });
    }

    await db.query(
      `INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [userId, endpoint, keys.p256dh, keys.auth]
    );
    return NextResponse.json({ message: "Suscripción guardada" }, { status: 201 });
  } catch (error) {
    console.error("Error al guardar push:", error);
    return NextResponse.json({ error: "Error al guardar suscripción" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    const { endpoint } = await req.json().catch(() => ({}));

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 });
    }

    await db.query(
      "DELETE FROM push_subscriptions WHERE endpoint = ? AND usuario_id = ?",
      [endpoint, userId]
    );
    return NextResponse.json({ message: "Suscripción eliminada" });
  } catch (error) {
    console.error("Error al eliminar push:", error);
    return NextResponse.json({ error: "Error al eliminar suscripción" }, { status: 500 });
  }
}
