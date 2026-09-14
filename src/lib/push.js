// src/lib/push.js — Envío de notificaciones Web Push (VAPID) con web-push.
// Solo servidor: nunca importar desde componentes cliente.
import webpush from "web-push";
import { db } from "./db";

let vapidConfigurado = false;

function configurarVapid() {
  if (vapidConfigurado) return true;
  const publica = process.env.VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:rss-dashboard@example.com",
    publica,
    privada
  );
  vapidConfigurado = true;
  return true;
}

// Envía un push a todas las suscripciones activas del usuario.
// Las suscripciones muertas (410/404) se podan solas.
export async function sendPushToUser(userId, { title, body, url = "/" } = {}) {
  if (!configurarVapid()) return { enviadas: 0, motivo: "sin-vapid" };
  const [subs] = await db.query(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ?",
    [userId]
  );
  if (subs.length === 0) return { enviadas: 0, motivo: "sin-suscripciones" };
  const payload = JSON.stringify({ title, body, url });
  let enviadas = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        enviadas++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await db
            .query("DELETE FROM push_subscriptions WHERE endpoint = ?", [s.endpoint])
            .catch(() => {});
        } else {
          console.error("Error al enviar push:", err.message);
        }
      }
    })
  );
  return { enviadas };
}
