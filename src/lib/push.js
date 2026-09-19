// src/lib/push.js — Envío de notificaciones Web Push (VAPID).
// Solo servidor: nunca importar desde componentes cliente.
// Sin MySQL directo: las suscripciones viven en la API interna si existe el
// endpoint; si no, el envío es no-op para no romper refrescos/cron.
import webpush from "web-push";
import { api } from "./api";

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

async function obtenerSuscripciones(userId) {
  // Intento best-effort contra la API interna; si no existe, no hay push.
  const rutas = [
    `/api/push/subscriptions?usuario_id=${encodeURIComponent(userId)}`,
    `/api/data/push?usuario_id=${encodeURIComponent(userId)}`,
  ];
  for (const ruta of rutas) {
    try {
      const data = await api(ruta);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.subscriptions)) return data.subscriptions;
    } catch {
      // Probar la siguiente ruta.
    }
  }
  return [];
}

// Envía un push a todas las suscripciones activas del usuario.
export async function sendPushToUser(userId, { title, body, url = "/" } = {}) {
  if (!configurarVapid()) return { enviadas: 0, motivo: "sin-vapid" };
  const subs = await obtenerSuscripciones(userId).catch(() => []);
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
          try {
            await api(`/api/push/subscriptions?endpoint=${encodeURIComponent(s.endpoint)}`, {
              method: "DELETE",
            });
          } catch {
            // Poda best-effort.
          }
        } else {
          console.error("Error al enviar push:", err.message);
        }
      }
    })
  );
  return { enviadas };
}
