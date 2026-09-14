// public/sw.js — Service worker mínimo: solo notificaciones push.
// Sin caché offline (alcance deliberado): muestra el push y abre la app al tocar.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // Payload no JSON: se usa el aviso genérico.
  }
  const title = data.title || "RSS Dashboard";
  const options = {
    body: data.body || "Tienes noticias nuevas en tus fuentes.",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(url));
});
