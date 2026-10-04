// src/lib/imagenes.js — Validación de imágenes del lector (frontend).
// Regla estricta: prohibidas capturas de página completa o miniaturas
// genéricas basadas en la URL/título. Solo fotos/gráficos nativos del
// contenido (<img> del cuerpo, enclosures/media del feed, og:image real).
// Sin imagen válida: el lector oculta el contenedor (nada de artefactos).
// Sin dependencias: usable en cliente y servidor.

const DOMINIOS_SCREENSHOT =
  /screenshotapi|screenshotone|screenshotlayer|urlbox|browshot|restpack|apiflash|microlink|s\.wp\.com\/mshots|thum\.io|mini\.s-shot|image\.google|images\.weserv/i;

const DOMINIOS_PLACEHOLDER =
  /via\.placeholder|placehold\.co|dummyimage|loremflickr|picsum\.photos|placekitten|placeimg|fakeimg/i;

export function esScreenshotUrl(valor = "") {
  const s = String(valor || "").trim();
  if (!s) return false;
  return DOMINIOS_SCREENSHOT.test(s);
}

export function esPlaceholderUrl(valor = "") {
  const s = String(valor || "").trim();
  if (!s) return false;
  return DOMINIOS_PLACEHOLDER.test(s);
}

/** Imagen mostrable: https real, no screenshot/placeholder/tracker/data. */
export function esImagenValida(valor = "") {
  const s = String(valor || "").trim();
  if (!s || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(s)) return false;
  if (!/^https?:\/\//i.test(s)) return false;
  if (esScreenshotUrl(s) || esPlaceholderUrl(s)) return false;
  // Píxeles de seguimiento y spacers con nombre explícito.
  if (/pixel|beacon|spacer|transparent|blank|1x1|clear\.gif|dot\.gif/i.test(s)) return false;
  return true;
}

/** Primera URL válida de una lista (enclosure → body → og). */
export function primeraImagenValida(...candidatas) {
  for (const c of candidatas.flat()) {
    if (typeof c === "string" && esImagenValida(c)) return c.trim();
  }
  return "";
}
