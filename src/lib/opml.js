// src/lib/opml.js — Importar/exportar fuentes en formato OPML.
// Solo cliente: parseo con DOMParser y descarga con Blob. Sin dependencias.

function textoAtributo(nodo, ...nombres) {
  for (const nombre of nombres) {
    const valor = (nodo.getAttribute?.(nombre) || "").trim();
    if (valor) return valor;
  }
  return "";
}

// Normaliza para comparar/dedup: minúsculas en protocolo+host y sin "/" final.
export function normalizarUrlFeed(url = "") {
  try {
    const parsed = new URL(String(url).trim());
    const host = parsed.hostname.toLowerCase();
    const ruta = parsed.pathname.replace(/\/+$/, "") || "/";
    const base = `${parsed.protocol}//${host}${ruta}`;
    return parsed.search || parsed.hash ? base + parsed.search + parsed.hash : base;
  } catch {
    return String(url).trim().replace(/\/+$/, "").toLowerCase();
  }
}

// Recorre outlines recursivamente: un outline con xmlUrl es un feed y su
// categoría es el grupo padre más cercano (o "General" si viene suelto).
export function parsearOPML(texto) {
  const doc = new DOMParser().parseFromString(String(texto || ""), "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("OPML no válido");
  }
  const items = [];
  const caminar = (nodo, categoria) => {
    for (const hijo of nodo.children || []) {
      if (hijo.tagName !== "outline") continue;
      const url = textoAtributo(hijo, "xmlUrl", "xmlurl", "url");
      if (url) {
        items.push({
          titulo: textoAtributo(hijo, "title", "text") || url,
          url,
          categoria: categoria || "General",
        });
      } else {
        caminar(hijo, textoAtributo(hijo, "title", "text") || categoria);
      }
    }
  };
  const body = doc.querySelector("opml > body, body") || doc;
  caminar(body, "");
  // Dedup dentro del propio archivo (misma URL normalizada).
  const vistos = new Set();
  return items.filter((item) => {
    const clave = normalizarUrlFeed(item.url);
    if (!clave || vistos.has(clave)) return false;
    vistos.add(clave);
    return true;
  });
}

function escaparXml(valor = "") {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Agrupa las fuentes por categoría para un OPML importable en 1 clic.
export function construirOPML(fuentes = []) {
  const grupos = new Map();
  for (const fuente of fuentes) {
    const categoria = String(fuente.categoria || fuente.category || "General").trim() || "General";
    if (!grupos.has(categoria)) grupos.set(categoria, []);
    grupos.get(categoria).push(fuente);
  }
  const lineas = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<opml version=\"2.0\">",
    "  <head>",
    "    <title>Mis fuentes RSS</title>",
    "  </head>",
    "  <body>",
  ];
  for (const [categoria, lista] of grupos) {
    lineas.push(`    <outline text="${escaparXml(categoria)}" title="${escaparXml(categoria)}">`);
    for (const fuente of lista) {
      const titulo = escaparXml(fuente.titulo || fuente.nombre || fuente.url_feed);
      const url = escaparXml(fuente.url_feed);
      lineas.push(`      <outline type="rss" text="${titulo}" title="${titulo}" xmlUrl="${url}"/>`);
    }
    lineas.push("    </outline>");
  }
  lineas.push("  </body>", "</opml>");
  return lineas.join("\n");
}

export function descargarTexto(contenido, nombreArchivo, tipo = "text/xml") {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  // El enlace debe estar en el DOM: si no, Firefox/Safari ignoran el clic.
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
