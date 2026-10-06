// src/lib/limpiezaTexto.js — Limpieza y normalización de texto de noticias (frontend).
// Sin dependencias: usable en cliente y servidor. No toca backend ni MySQL.
// Cubre: strip HTML seguro, decodificación de entities, colapso de espacios,
// filtrado de ruido/CTA y truncado extendido con corte en límite de bloque.

const ENTIDADES_BASICAS = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodificarEntidades(texto = "") {
  let s = String(texto || "");
  if (!s || !s.includes("&")) return s;
  // Numéricas decimales y hexadecimales.
  s = s.replace(/&#(\d{1,7});/g, (_, n) => {
    const c = Number(n);
    if (!Number.isFinite(c) || c <= 0 || c > 0x10ffff) return "";
    try {
      return String.fromCodePoint(c);
    } catch {
      return "";
    }
  });
  s = s.replace(/&#x([0-9a-fA-F]{1,6});/g, (_, h) => {
    const c = parseInt(h, 16);
    if (!Number.isFinite(c) || c <= 0 || c > 0x10ffff) return "";
    try {
      return String.fromCodePoint(c);
    } catch {
      return "";
    }
  });
  // Nombradas básicas + las más comunes en feeds.
  s = s.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ENTIDADES_BASICAS[n] ?? "");
  s = s.replace(/&(copy|reg|hellip|ldquo|rdquo|lsquo|rsquo|ndash|mdash|middot);/g, (m) => {
    const mapa = {
      copy: "©",
      reg: "®",
      hellip: "…",
      ldquo: "\u201C",
      rdquo: "\u201D",
      lsquo: "\u2018",
      rsquo: "\u2019",
      ndash: "–",
      mdash: "—",
      middot: "·",
    };
    const clave = m.slice(1, -1);
    return mapa[clave] ?? m;
  });
  return s;
}

const ETIQUETAS_SALTO = /<\s*br\b[^>]*>/gi;
const ETIQUETAS_BLOQUE_CIERRE =
  /<\s*\/\s*(p|div|li|ul|ol|h[1-6]|blockquote|pre|tr|section|article)\b[^>]*>|<\s*hr\b[^>]*>/gi;
const ETIQUETAS_PRE = /<\s*pre\b[^>]*>([\s\S]*?)<\s*\/\s*pre\s*>/gi;

// Dentro de código todo es texto literal: se sueltan solo envoltorios de
// resaltado (span/a/...) y el resto (<dialog>, <button id=...>) se escapa
// para que sobreviva al strip genérico y se vea en el lector (luego se
// decodifica a visible). Sin esto, `<dialog>` se comía y quedaba la
// píldora vacía o en blanco.
const ETIQUETAS_ENVOLTORIO_CODIGO =
  /<\s*\/?\s*(span|a|em|strong|b|i|u|font|mark|small|sub|sup|code)\b[^>]*>/gi;
function escaparCodigoLiteral(interior = "") {
  return String(interior || "")
    .replace(/<\s*br\b[^>]*>/gi, "\n")
    .replace(ETIQUETAS_ENVOLTORIO_CODIGO, "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function stripHtml(texto = "") {
  let s = String(texto || "");
  if (!s || !s.includes("<")) return s;
  // Bloques de código (<pre>) se conservan como cercas ``` para que el
  // lector los pinte como consola; el resto del HTML se limpia igual.
  s = s.replace(ETIQUETAS_PRE, (m, interior) => {
    const codigo = escaparCodigoLiteral(interior)
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    if (!codigo) return "\n\n";
    return `\n\n\`\`\`\n${codigo}\n\`\`\`\n\n`;
  });
  // <br> = salto suave (una línea); cierre de bloque (</p>, </div>, ...) =
  // separación de párrafo (línea en blanco). Así no se fusionan párrafos.
  s = s.replace(ETIQUETAS_SALTO, "\n");
  s = s.replace(ETIQUETAS_BLOQUE_CIERRE, "\n\n");
  // Resto de etiquetas (aperturas, inline) fuera. El <code> en línea se
  // conserva como `código` para el render.
  s = s.replace(/<\s*code\b[^>]*>([\s\S]*?)<\s*\/\s*code\s*>/gi, (_, interior) =>
    `\`${escaparCodigoLiteral(interior).trim()}\``
  );
  // Strip genérico: respeta cercas ``` y `código` (nuevas o preexistentes)
  // para no comer `<tag>` literales (p. ej. `<dialog>` decodificado antes
  // por cheerio en el backend). Solo se limpia fuera de ellas.
  s = s
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]+`)/g)
    .map((parte, i) => (i % 2 === 0 ? parte.replace(/<[^>]*>/g, " ") : parte))
    .join("");
  return s;
}

// Líneas que nunca aportan contexto (navegación, CTA, tracking residual).
const RE_RUIDO_LINEA =
  /^(learn more|leer m[aá]s|ver m[aá]s|read more|continue reading|seguir leyendo|descubrir m[aá]s|siguiente|anterior|previous|next|suscr[ií]bete|subscribe|cookies|privacidad|aviso legal|read full stor\w*|full (article|post|story)|more|continue|\[…\]|\[\.\.\.\])[…\s›»→.]*$/i;

function esLineaBasura(linea) {
  const t = linea.trim();
  if (!t) return true;
  if (t.length < 2) return true;
  // Solo símbolos/puntuación.
  if (/^[\s\-–—_*#•·….,;:!?()[\]{}"'«»‹›/\\|@]+$/.test(t)) return true;
  if (RE_RUIDO_LINEA.test(t)) return true;
  return false;
}

/** Limpieza central de resúmenes: HTML → texto, entities, escapes y espacios.
 *  No trunca: el tope lo aplica `truncarResumen` o el backend (1200/8000). */
export function limpiarTextoResumen(texto = "") {
  let s = String(texto || "");
  if (!s) return "";
  s = stripHtml(s);
  // Las cercas de código se apartan: ni el trim por línea ni el filtro de
  // ruido deben tocarlas (indentación y líneas como `}` son contenido).
  const cercas = [];
  s = s.replace(/^```[^\S\n]*\r?\n([\s\S]*?)\r?\n```/gm, (m, codigo) => {
    cercas.push(decodificarEntidades(String(codigo || "")));
    return `@@BLOQUECODIGO${cercas.length - 1}@@`;
  });
  s = s.replace(/^~~~[^\S\n]*\r?\n([\s\S]*?)\r?\n~~~/gm, (m, codigo) => {
    cercas.push(decodificarEntidades(String(codigo || "")));
    return `@@BLOQUECODIGO${cercas.length - 1}@@`;
  });
  s = decodificarEntidades(s);
  // Doble decodificación residual (feeds con &amp;amp;).
  if (s.includes("&") && /&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/.test(s)) {
    s = decodificarEntidades(s);
  }
  // Caracteres de control y reemplazo, salvo \n y \t.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFD]/g, "");
  // Escapes literales residuales.
  s = s.replace(/\\n|\\r|\\t/g, " ");
  // Normaliza saltos y espacios por línea. Las líneas vacías se conservan
  // como separadores de párrafo (si se filtraran, los <p> se fusionarían).
  s = s.replace(/\r\n?/g, "\n");
  const crudas = s.split("\n").map((l) => l.replace(/[ \t\u00A0]+/g, " ").trim());
  const filtradas = [];
  for (const l of crudas) {
    if (!l) {
      filtradas.push("");
      continue;
    }
    if (esLineaBasura(l)) continue;
    filtradas.push(l);
  }
  s = filtradas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Colapsa espacios dentro de cada línea sin pegar párrafos, y pega la
  // puntuación a la palabra anterior (las etiquetas inline dejan huecos).
  s = s
    .split("\n")
    .map((l) => (l ? l.replace(/\s+/g, " ").replace(/\s+([.,;:!?…)»”’])/g, "$1").trim() : ""))
    .join("\n");
  // Se devuelven los bloques de código intactos (con su indentación).
  s = s.replace(/^@@BLOQUECODIGO(\d+)@@$/gm, (_, n) => {
    const codigo = cercas[Number(n)];
    return codigo !== undefined ? `\`\`\`\n${codigo}\n\`\`\`` : "";
  });
  return s;
}

/** Título de feed/artículo: trim, colapso y tope 300 con "Sin título". */
export function limpiarTitulo(texto = "", tope = 300) {
  const s = limpiarTextoResumen(texto).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "Sin título";
  if (s.length <= tope) return s;
  const corte = s.slice(0, tope);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return `${(ultimoEspacio > tope * 0.6 ? corte.slice(0, ultimoEspacio) : corte).trim()}…`;
}

/** Truncado extendido con corte en límite de bloque (nunca a mitad de viñeta):
 *  prefiere doble salto, luego fin de frase/viñeta, luego palabra. */
export function truncarResumen(texto = "", max = 1200) {
  const s = String(texto || "");
  if (s.length <= max) return s;
  const ventana = s.slice(0, max);
  const candidatos = [
    ventana.lastIndexOf("\n\n"),
    ventana.lastIndexOf("\n"),
    Math.max(ventana.lastIndexOf(". "), ventana.lastIndexOf(".\n")),
    ventana.lastIndexOf(" "),
  ].filter((i) => Number.isInteger(i) && i > max * 0.5);
  const corte = candidatos.length > 0 ? Math.max(...candidatos) : max;
  return `${ventana.slice(0, corte).trim()}…`;
}

/** Resumen extendido listo para mostrar: limpia y acota a `max` (1200 por
 *  defecto, igual que el contrato backend v003). */
export function resumenExtendido(texto = "", max = 1200) {
  const limpio = limpiarTextoResumen(texto);
  if (!limpio) return "";
  return limpio.length > max ? truncarResumen(limpio, max) : limpio;
}
