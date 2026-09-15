// src/lib/formato.js — Formato de fechas y dominios (una sola fuente de verdad).
// Sin dependencias de React: usable en cliente y servidor.

const formattersFecha = new Map();

export function formatFecha(fechaStr, reciente = "Reciente", locale = "es-ES") {
  const fechaObj = fechaStr ? new Date(fechaStr) : new Date();
  try {
    if (Number.isNaN(fechaObj.getTime())) return reciente;
    let f = formattersFecha.get(locale);
    if (!f) {
      f = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
      formattersFecha.set(locale, f);
    }
    return f.format(fechaObj);
  } catch {
    return reciente;
  }
}

export function formatFechaCorta(valor, locale = "es-ES") {
  if (!valor) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(valor));
  } catch {
    return "—";
  }
}

export function dominioDeUrl(urlFeed = "") {
  try {
    return new URL(urlFeed).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function nombreFuenteDeArticulo(art, generica = "Fuente RSS") {
  if (art?.fuente_nombre && art.fuente_nombre !== "Fuente RSS") {
    return String(art.fuente_nombre).toUpperCase();
  }
  const rawUrl = art?.url_original || art?.url || art?.link;
  if (rawUrl) {
    const dominio = dominioDeUrl(rawUrl);
    if (dominio) return dominio.toUpperCase();
  }
  return String(generica).toUpperCase();
}
