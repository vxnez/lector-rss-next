// src/lib/feed-utils.js — Utilidades puras del feed (sin React ni DOM).
// Extraídas de page.js para que la página componga en vez de implementarlo todo.

// Construye los query params del feed (página + filtros server-side).
export function paramsFeed({ page, limit, tab, orden, q, categorias, fuentes, ia }) {
  const params = new URLSearchParams({
    limit: String(limit),
    page: String(page),
    tab,
    orden,
  });
  if (String(q || "").trim()) params.set("q", String(q).trim());
  if (Array.isArray(categorias) && categorias.length > 0) params.set("categorias", categorias.join(","));
  if (Array.isArray(fuentes) && fuentes.length > 0) params.set("fuentes", fuentes.join(","));
  if (ia === "con_ia" || ia === "sin_ia") params.set("ia", ia);
  return params.toString();
}

// Convierte la clave VAPID (base64url) al formato que pide PushManager.
export function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (String(base64).length % 4)) % 4);
  const raw = atob(String(base64).replace(/-/g, "+").replace(/_/g, "/") + padding);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Ventana de números de página con elipsis: 1 … c-1 c c+1 … N
export function numerosPagina(total, actual) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas = new Set([1, 2, total - 1, total, actual - 1, actual, actual + 1]);
  const lista = [...paginas].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const resultado = [];
  let anterior = 0;
  for (const n of lista) {
    if (n - anterior > 1) resultado.push("…");
    resultado.push(n);
    anterior = n;
  }
  return resultado;
}
