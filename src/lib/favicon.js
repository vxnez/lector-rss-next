// src/lib/favicon.js — Favicon adaptativo al tema de la app.
// Repinta el badge RSS con el color de acento del tema activo y lo aplica
// como data URL al <link rel="icon">. El /icon.svg estático queda como
// respaldo (primer pintado, login, sin JS).
function luminancia(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const canal = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function svgFavicon(acento = "#2EA8E8") {
  const glyph = luminancia(acento) > 0.5 ? "#0e1319" : "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" rx="22" fill="${acento}"/><g stroke="${glyph}" stroke-width="8" fill="none" stroke-linecap="round"><path d="M 49 70 A 17 17 0 0 0 32 53"/><path d="M 63 70 A 31 31 0 0 0 32 39"/></g><circle cx="32" cy="70" r="6.5" fill="${glyph}"/></svg>`;
}

export function actualizarFavicon(acento) {
  try {
    const url = "data:image/svg+xml," + encodeURIComponent(svgFavicon(acento));
    let enlace = document.querySelector('link[rel="icon"]');
    if (!enlace) {
      enlace = document.createElement("link");
      enlace.rel = "icon";
      document.head.appendChild(enlace);
    }
    enlace.type = "image/svg+xml";
    enlace.href = url;
  } catch {
    // Sin DOM disponible: se conserva el favicon estático.
  }
}
