// src/lib/webToRss.js — Motor de conversión web → RSS (estilo RSS.app).
// Solo servidor: recibe la URL de una página convencional sin feed nativo,
// extrae sus noticias (JSON-LD → Open Graph/artículo → heurística de lista)
// y devuelve un feed con la forma de rss-parser para que el pipeline
// existente (alta, persistencia, refresco) lo consuma sin cambios.
//
// Seguridad: toda descarga usa fetchPublico (guarda SSRF: scheme http/https,
// DNS a IP pública, redirects revalidados) con tope de bytes.
// Caché: la conversión reenvía etag/last-modified (peticiones condicionales
// → 304 = sin cambios) y el dashboard solo lee la BD: no hay scraping en
// cada carga, solo al agregar y al refrescar la fuente.
import * as cheerio from "cheerio";
import { fetchPublico, leerTextoLimitado } from "@/lib/ssrf";

const TIMEOUT_MS = 12000;
const MAX_ITEMS = 25;

// Límites del crawling multipágina (anti-bloqueo y anti-bucle infinito):
// como máximo N páginas o M noticias en total, y un presupuesto global de
// tiempo para no agotar el maxDuration del serverless (el presupuesto manda:
// en sitios lentos el crawl se detiene antes y conserva lo recolectado).
// Entre páginas hay una pausa de cortesía secuencial (sin concurrencia).
const MAX_PAGINAS_CRAWL = 20;
const MAX_ITEMS_TOTAL = 100;
const TIEMPO_MAX_CRAWL_MS = 45000;
const CORTESIA_ENTRE_PAGINAS_MS = 500;

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const UA_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const UA_FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0";

function errorWeb(mensaje, code = "WEB_INCOMPATIBLE") {
  const error = new Error(mensaje);
  error.code = code;
  return error;
}

function limpiarUrlEntrada(valor) {
  const texto = String(valor || "").trim();
  if (!texto) throw errorWeb("La URL es obligatoria.", "WEB_URL");
  try {
    const url = new URL(/^https?:\/\//i.test(texto) ? texto : `https://${texto}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw errorWeb("La URL ingresada no tiene un formato válido.", "WEB_URL");
    }
    return url.href;
  } catch (err) {
    if (err?.code?.startsWith("WEB_")) throw err;
    throw errorWeb("La URL ingresada no tiene un formato válido.", "WEB_URL");
  }
}

async function descargarPagina(url, validadores = {}) {
  const armar = (ua) => {
    const headers = {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    };
    if (validadores.etag) headers["If-None-Match"] = validadores.etag;
    if (validadores.lastModified) headers["If-Modified-Since"] = validadores.lastModified;
    return headers;
  };
  let actual;
  try {
    try {
      actual = await fetchPublico(url, { headers: armar(UA_CHROME), timeoutMs: TIMEOUT_MS });
    } catch (err) {
      if (err?.name === "AbortError") {
        throw errorWeb("La página tardó demasiado en responder.", "WEB_TIMEOUT");
      }
      actual = await fetchPublico(url, { headers: armar(UA_FIREFOX), timeoutMs: TIMEOUT_MS });
    }
    if (!actual.res.ok && [401, 403, 429].includes(actual.res.status)) {
      await actual.res.arrayBuffer().catch(() => {});
      actual = await fetchPublico(url, { headers: armar(UA_FIREFOX), timeoutMs: TIMEOUT_MS });
    }
  } catch (err) {
    if (err?.code?.startsWith("WEB_")) throw err;
    if (err?.name === "AbortError") throw errorWeb("La página tardó demasiado en responder.", "WEB_TIMEOUT");
    throw errorWeb("No se pudo descargar la página web.", "WEB_FETCH");
  }

  const { res, urlFinal } = actual;
  if (res.status === 304) return { sinCambios: true, urlFinal };
  if (!res.ok) {
    throw errorWeb(
      res.status === 404
        ? "La página no existe (HTTP 404)."
        : `La página respondió con error (HTTP ${res.status}).`,
      "WEB_HTTP"
    );
  }
  const contentType = res.headers.get("content-type") || "";
  if (!/html|xhtml|text\//i.test(contentType)) {
    throw errorWeb(
      "Esa URL no es una página web convertible (ni feed RSS ni HTML).",
      "WEB_INCOMPATIBLE"
    );
  }
  let html;
  try {
    html = await leerTextoLimitado(res);
  } catch {
    throw errorWeb("La página es demasiado grande para convertirla.", "WEB_GRANDE");
  }
  return {
    html,
    baseFinal: urlFinal || url,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
  };
}

// ---- Utilidades de normalización (solo transformaciones de texto/URL) ----

function absolver(valor, base) {
  if (typeof valor !== "string") return "";
  const v = valor.trim();
  if (!v || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(v)) return "";
  try {
    const abs = new URL(v, base).href;
    if (!/^https?:\/\//i.test(abs)) return "";
    return abs;
  } catch {
    return "";
  }
}

function limpiarEnlaceNoticia(abs) {
  try {
    const url = new URL(abs);
    const seguimiento = /^(utm_|fbclid$|gclid$|dclid$|mc_cid$|mc_eid$|_ga$|ref$)/i;
    for (const nombre of [...url.searchParams.keys()]) {
      if (seguimiento.test(nombre)) url.searchParams.delete(nombre);
    }
    url.hash = "";
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
    return url.href;
  } catch {
    return "";
  }
}

function esEnlaceDescartable(abs, baseHost) {
  let url;
  try {
    url = new URL(abs);
  } catch {
    return true;
  }
  const ruta = url.pathname.toLowerCase();
  if (url.hostname.toLowerCase() !== baseHost) return false; // fuera del sitio: puede ser noticia enlazada
  if (/\.(jpe?g|png|webp|gif|avif|bmp|svg|ico|css|js|pdf|zip|mp4|mp3)(\?|#|$)/i.test(ruta)) return true;
  if (/\/(tag|tags|etiqueta|categor(ia|y|ies)|autor(es)?|author(s)?|page|pagina|paged|search|buscar|login|registro|register|cuenta|carrito|cart|checkout|contacto|contact|privacidad|privacy|cookies|terminos|aviso-legal|quienes-somos|about|newsletter|suscrib)(\/|$)/i.test(ruta)) {
    return true;
  }
  if (/[?&](paged?|page|pagina)=\d+/i.test(url.search)) return true;
  return false;
}

const TEXTO_NAV = /^(inicio|home|men[uú]|contacto|contact|login|entrar|registrarse|registro|suscribirse|suscripci[oó]n|privacidad|cookies|t[eé]rminos|aviso legal|qui[eé]nes somos|about|nosotros|buscar|search|ver m[aá]s|leer m[aá]s|more|next|siguiente|anterior|previous)$/i;

function textoLimpio($, el) {
  return $(el)
    .text()
    .replace(/\s+/g, " ")
    .trim();
}

function fechaAISO(valor) {
  if (!valor) return "";
  const texto = String(valor).trim();
  if (!texto) return "";
  const ms = Date.parse(texto);
  if (Number.isNaN(ms)) return "";
  const fecha = new Date(ms);
  if (fecha.getFullYear() < 1990 || fecha.getTime() > Date.now() + 1000 * 60 * 60 * 24 * 2) return "";
  return fecha.toISOString();
}

// Meses en español: Date.parse no los entiende ("17 de septiembre de 2026").
const MESES_ES = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10",
  noviembre: "11", diciembre: "12", ene: "01", feb: "02", mar: "03", abr: "04",
  may: "05", jun: "06", jul: "07", ago: "08", sep: "09", sept: "09",
  oct: "10", nov: "11", dic: "12",
};

function fechaEspanolaAISO(texto) {
  const m = String(texto || "")
    .toLowerCase()
    .match(/(\d{1,2})\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)\.?\,?(?:\s+de\s+|\s+)(\d{4})/);
  if (!m) return "";
  const mes = MESES_ES[m[2]];
  if (!mes) return "";
  return `${m[3]}-${mes}-${String(Number(m[1])).padStart(2, "0")}T00:00:00`;
}

// Extrae la primera fecha válida de textos libres ("March 24, 2026",
// "17 de septiembre de 2026", "2026-03-24"). Devuelve ISO o "".
function extraerFechaDeTexto(...textos) {
  const patronEn = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}/i;
  for (const candidato of textos) {
    const texto = String(candidato || "").replace(/\s+/g, " ").trim();
    if (!texto) continue;
    const fragmento = texto.length > 400 ? texto.slice(0, 400) : texto;
    const mEn = fragmento.match(patronEn);
    if (mEn) {
      // V8 no traga "Sept": se normaliza a "Sep" antes de parsear.
      const iso = fechaAISO(mEn[0].replace(/\bsept\b\.?/i, "Sep"));
      if (iso) return iso;
    }
    const isoEs = fechaAISO(fechaEspanolaAISO(fragmento));
    if (isoEs) return isoEs;
  }
  return "";
}

function esImagenTracker(src) {
  const v = String(src || "").toLowerCase();
  if (/pixel|beacon|spacer|transparent|blank|1x1|tracking|clear\.gif|dot\.gif/i.test(v)) return true;
  return false;
}

function mejorSrcset(srcset) {
  if (!srcset) return "";
  let mejor = "";
  let maxW = 0;
  for (const parte of String(srcset).split(",")) {
    const trozos = parte.trim().split(/\s+/);
    const candidato = (trozos[0] || "").trim();
    if (!candidato) continue;
    const w = /(\d+)w$/.exec(parte.trim());
    if (w) {
      if (Number(w[1]) > maxW) {
        maxW = Number(w[1]);
        mejor = candidato;
      }
    } else if (!mejor) {
      mejor = candidato;
    }
  }
  return mejor;
}

function imagenDeImg($, img, base) {
  if (!img || !img.length) return "";
  const cruda =
    img.attr("src") || mejorSrcset(img.attr("srcset")) || img.attr("data-src") || img.attr("data-lazy-src") || "";
  if (!cruda || esImagenTracker(cruda)) return "";
  return absolver(cruda, base);
}

// CTAs que nunca son resumen ("Learn more", "Leer más"...).
const TEXTO_CTA = /^(learn more|leer m[aá]s|ver m[aá]s|read more|continue reading|seguir leyendo|descubrir m[aá]s)[\s›»→.]*$/i;

function parrafoValido(texto, titulo) {
  const t = String(texto || "").replace(/\s+/g, " ").trim();
  if (!t || t.length < 30) return "";
  if (TEXTO_CTA.test(t)) return "";
  if (t === titulo) return "";
  // Párrafo que repite el titular (la descripción suele empezar distinto).
  if (titulo && titulo.length > 30 && t.startsWith(titulo.slice(0, 30))) return "";
  return t;
}

// Resumen de una tarjeta: recorre TODOS los <p> del ámbito (no solo first:
// con <p> anidados el parser auto-cierra el externo y el primero sale
// vacío), luego hermanos/padre/tarjeta; como respaldo une hasta 3 párrafos
// del bloque (extractivo ligero, sin dependencias NLP).
function extraerResumenDeTarjeta($, a, ambito, bloque, titulo) {
  const vistos = new Set();
  const candidatos = [];
  const recolectar = (raiz) => {
    if (!raiz || !raiz.length) return;
    raiz.find("p").each((_, el) => {
      const t = parrafoValido($(el).text(), titulo);
      if (t && !vistos.has(t)) {
        vistos.add(t);
        candidatos.push(t);
      }
    });
  };
  recolectar(ambito);
  if (bloque && (!ambito.length || bloque[0] !== ambito[0])) recolectar(bloque);
  // Hermanos cercanos del enlace y del ámbito (la descripción a veces es
  // hermana del titular, no descendiente).
  [a, ambito].forEach((origen) => {
    if (!origen || !origen.length) return;
    origen.siblings("p").each((_, el) => {
      const t = parrafoValido($(el).text(), titulo);
      if (t && !vistos.has(t)) {
        vistos.add(t);
        candidatos.push(t);
      }
    });
  });
  const padre = a.parent();
  if (padre && padre.length) recolectar(padre.parent());
  if (candidatos.length > 0) return candidatos[0].slice(0, 300);
  // Respaldo extractivo: une hasta 3 párrafos cortos del bloque (cada uno
  // ≥15 caracteres) hasta ~300; exige un mínimo total para no guardar ruido.
  const cortos = [];
  const recolectarCortos = (raiz) => {
    if (!raiz || !raiz.length || cortos.join(" ").length >= 300) return;
    raiz.find("p").each((_, el) => {
      if (cortos.join(" ").length >= 300) return;
      const t = String($(el).text() || "").replace(/\s+/g, " ").trim();
      if (t.length >= 15 && !TEXTO_CTA.test(t) && t !== titulo && !vistos.has(t)) {
        vistos.add(t);
        cortos.push(t);
        if (cortos.length >= 3) return;
      }
    });
  };
  recolectarCortos(ambito);
  if (bloque && (!ambito.length || bloque[0] !== ambito[0])) recolectarCortos(bloque);
  const unido = cortos.join(" ").slice(0, 300);
  return unido.length >= 60 ? unido : "";
}

// ---- Extracción por capas ----

function extraerJsonLd($) {
  const candidatos = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const crudo = $(el).text();
    if (!crudo || crudo.length > 200000) return;
    try {
      const datos = JSON.parse(crudo);
      const lista = Array.isArray(datos) ? datos : [datos];
      for (const nodo of lista) candidatos.push(nodo);
    } catch {
      // Bloque JSON-LD inválido: se ignora.
    }
  });
  return candidatos;
}

function esTipoArticulo(tipo = "") {
  return /newsarticle|blogposting|article|reportage|liveblog|analysisnews/i.test(String(tipo).replace(/[^a-z]/gi, ""));
}

function autorDeJsonLd(nodo) {
  const autor = nodo?.author;
  if (!autor) return "";
  if (typeof autor === "string") return autor.trim();
  if (Array.isArray(autor)) {
    const primero = autor.find((a) => a?.name) || autor[0];
    return String(primero?.name || primero || "").trim();
  }
  return String(autor?.name || "").trim();
}

function itemsDesdeJsonLd(nodos, base, baseHost) {
  const items = [];
  const apilar = (nodo) => {
    if (!nodo || typeof nodo !== "object") return;
    const tipos = Array.isArray(nodo["@type"]) ? nodo["@type"] : [nodo["@type"]];
    const tipoTexto = tipos.filter(Boolean).join(" ");
    if (/itemlist|collectionpage|blog|newsmediaorganization|website|webpage|searchresults/i.test(tipoTexto)) {
      const elementos = nodo.itemListElement || nodo.mainEntity?.itemListElement || nodo.blogPost || nodo.hasPart;
      if (Array.isArray(elementos)) elementos.forEach(apilar);
      if (Array.isArray(nodo.mainEntity)) nodo.mainEntity.forEach(apilar);
      return;
    }
    if (!esTipoArticulo(tipoTexto)) return;
    const url = absolver(nodo.url || nodo.mainEntityOfPage?.["@id"] || nodo.mainEntityOfPage || "", base);
    const titulo = String(nodo.headline || nodo.name || "").replace(/\s+/g, " ").trim();
    if (!url || !titulo || titulo.length < 10) return;
    const limpio = limpiarEnlaceNoticia(url);
    if (!limpio || esEnlaceDescartable(limpio, baseHost)) return;
    const imagenNodo = nodo.image;
    const imagenCruda = Array.isArray(imagenNodo)
      ? imagenNodo.find((i) => i?.url)?.url || imagenNodo[0]?.url || imagenNodo[0]
      : imagenNodo?.url || imagenNodo;
    items.push({
      titulo,
      url: limpio,
      resumen: String(nodo.description || "").replace(/\s+/g, " ").trim().slice(0, 300),
      fecha: fechaAISO(nodo.datePublished || nodo.dateCreated),
      autor: autorDeJsonLd(nodo),
      imagen: typeof imagenCruda === "string" ? absolver(imagenCruda, base) : "",
      video: "",
    });
  };
  nodos.forEach(apilar);
  return items;
}

function meta($, ...nombres) {
  for (const nombre of nombres) {
    const porProp = $(`meta[property="${nombre}"]`).first().attr("content");
    if (porProp) return porProp.trim();
    const porNombre = $(`meta[name="${nombre}"]`).first().attr("content");
    if (porNombre) return porNombre.trim();
  }
  return "";
}

function extraerArticuloUnico($, base, baseHost, jsonLd) {
  const esArticulo = /article/i.test(meta($, "og:type")) || meta($, "article:published_time");
  if (!esArticulo) return null;
  const titulo =
    meta($, "og:title") ||
    textoLimpio($, "article h1").slice(0, 200) ||
    textoLimpio($, "h1").slice(0, 200);
  if (!titulo || titulo.length < 10) return null;
  const cuerpo =
    textoLimpio($, "article").slice(0, 300) ||
    meta($, "og:description", "description").slice(0, 300);
  const canonica = $('link[rel="canonical"]').first().attr("href");
  const url = limpiarEnlaceNoticia(absolver(canonica || meta($, "og:url") || base, base));
  if (!url) return null;
  const fecha =
    fechaAISO(meta($, "article:published_time", "article:modified_time", "date", "publish_date")) ||
    fechaAISO($("article time[datetime]").first().attr("datetime") || $("time[datetime]").first().attr("datetime")) ||
    extraerFechaDeTexto($("article").first().text().slice(0, 1500));
  const primeroJsonLd = (jsonLd || []).find((n) => esTipoArticulo(n?.["@type"]));
  return {
    titulo,
    url,
    resumen: cuerpo,
    fecha,
    autor:
      autorDeJsonLd(primeroJsonLd || {}) ||
      meta($, "article:author", "author").split(/[,\/]/)[0].trim(),
    imagen:
      absolver(meta($, "og:image", "twitter:image"), base) ||
      imagenDeImg($, $("article img").first(), base),
    video: videoDePagina($, base),
  };
}

function videoDePagina($, base) {
  const ogVideo = absolver(meta($, "og:video", "og:video:url", "twitter:player:stream"), base);
  if (ogVideo && /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i.test(ogVideo)) return ogVideo;
  let hallado = "";
  $("video source[src], video[src]").each((_, el) => {
    if (hallado) return;
    const src = absolver($(el).attr("src"), base);
    if (src && /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i.test(src)) hallado = src;
  });
  return hallado;
}

function itemsDesdeLista($, base, baseHost) {
  const vistos = new Set();
  const candidatos = [];
  $("a[href]").each((_, el) => {
    const a = $(el);
    const href = a.attr("href");
    if (!href) return;
    const abs = absolver(href, base);
    if (!abs || !/^https?:\/\//i.test(abs)) return;
    const limpio = limpiarEnlaceNoticia(abs);
    if (!limpio || vistos.has(limpio)) return;
    let titulo = textoLimpio($, el);
    // Titular solo-imagen: usa el alt como título.
    if ((!titulo || titulo.length < 10) && a.find("img").length > 0) {
      titulo = String(a.find("img").first().attr("alt") || "").replace(/\s+/g, " ").trim();
    }
    if (!titulo || titulo.length < 18 || titulo.length > 220) return;
    if (TEXTO_NAV.test(titulo)) return;
    if (esEnlaceDescartable(limpio, baseHost)) return;

    const contenedor = a.closest("article, li, div, section, td").first();
    // La tarjeta completa (article/li) incluye footer con fecha y autor;
    // el div más cercano suele quedarse corto (p. ej. <time> en el footer).
    const tarjeta = a.closest("article, li").first();
    const ambito = (tarjeta.length ? tarjeta : contenedor.length ? contenedor : a.parent());
    const bloque = tarjeta.length ? tarjeta : ambito;
    const resumen = extraerResumenDeTarjeta($, a, ambito, bloque, titulo);
    const autorTarjeta = (() => {
      const el = ambito.find('[rel="author"]').first();
      const nombre = el.length ? textoLimpio($, el) : "";
      return nombre && nombre.length <= 80 ? nombre : "";
    })();
    const fecha =
      fechaAISO(ambito.find("time[datetime]").first().attr("datetime")) ||
      extraerFechaDeTexto(
        ambito.find("time").first().text(),
        (() => {
          const textos = [];
          ambito
            .find("[class*='date'],[class*='fecha'],[class*='publish'],[class*='time'],[class*='meta'],[class*='byline'],[class*='autor'],[class*='author']")
            .each((_, el) => textos.push($(el).text()));
          return textos.join(" | ");
        })(),
        a.parent().text(),
        ambito.text().slice(-300)
      );

    let puntuacion = Math.min(titulo.length, 120);
    if (a.closest("article").length) puntuacion += 40;
    if (ambito.find("time").length) puntuacion += 25;
    const img = ambito.find("img").first();
    const imagen = imagenDeImg($, img.length ? img : a.find("img").first(), base);
    if (imagen) puntuacion += 20;
    if (resumen) puntuacion += 15;
    try {
      const profundidad = new URL(limpio).pathname.split("/").filter(Boolean).length;
      if (profundidad >= 2) puntuacion += 10;
    } catch {
      // URL ya validada: no resta.
    }

    vistos.add(limpio);
    candidatos.push({ titulo, url: limpio, resumen, fecha, autor: autorTarjeta, imagen, video: "", puntuacion });
  });
  return candidatos
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, MAX_ITEMS)
    .map(({ puntuacion, ...item }) => item);
}

// ---- Paginación multipágina (pagination crawling) ----

// Número de página explícito en la URL (?page=2, /page/3/, /p/2...). 1 si no hay.
function numeroDePagina(abs) {
  try {
    const url = new URL(abs);
    const params = ["page", "paged", "p", "pagina", "pg"];
    for (const nombre of params) {
      const n = Number(url.searchParams.get(nombre));
      if (Number.isInteger(n) && n > 0) return n;
    }
    const m = url.pathname.match(/\/(?:page|p|pagina|pg|paged?)\/(\d+)(?:\/|$)/i);
    if (m) return Number(m[1]);
  } catch {
    // URL inválida: se asume primera página.
  }
  return 1;
}

function normalizarUrlPagina(abs) {
  try {
    const url = new URL(abs);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase();
    url.pathname = url.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
    return url.href;
  } catch {
    return String(abs || "");
  }
}

// ¿El enlace apunta a una página de listado numerada? Devuelve su número o 0.
function numeroDeEnlacePaginado(abs) {
  try {
    const url = new URL(abs);
    if (/\/wp-admin|\/wp-json|\/feed|\/rss|\/atom|\/amp(\/|$)/i.test(url.pathname)) return 0;
    return numeroDePagina(abs) > 1 || /[?&](page|paged|p|pagina|pg)=\d+/i.test(abs) ||
      /\/(?:page|p|pagina|pg|paged?)\/\d+(?:\/|$)/i.test(url.pathname)
      ? numeroDePagina(abs)
      : 0;
  } catch {
    return 0;
  }
}

const TEXTO_SIGUIENTE = /^(siguiente|next|»|›|→|más resultados|mas resultados|cargar más|cargar mas|ver más|ver mas|mostrar más|older|older posts|entradas antiguas|página siguiente|pagina siguiente)$/i;

// Detecta la URL de la página siguiente de un listado. Solo mismo host
// (no se persiguen enlaces externos) y solo enlaces con href real: los
// botones "Load More" 100% JS (sin href) no son seguibles sin navegador.
function detectarSiguientePagina($, base, baseHost, paginaActual) {
  const candidata = (href) => {
    const abs = absolver(href, base);
    if (!abs || !/^https?:\/\//i.test(abs)) return "";
    try {
      if (new URL(abs).hostname.toLowerCase() !== baseHost) return "";
    } catch {
      return "";
    }
    return normalizarUrlPagina(abs);
  };

  // 1) Señal explícita: <link rel="next"> o <a rel="next">.
  const relNext =
    $('link[rel="next"]').first().attr("href") || $('a[rel="next"]').first().attr("href");
  if (relNext) {
    const abs = candidata(relNext);
    if (abs) return abs;
  }

  // 2) Enlace numerado inmediatamente posterior (?page=N+1, /page/N+1/).
  let mejorNumerado = "";
  $("a[href]").each((_, el) => {
    if (mejorNumerado) return;
    const n = numeroDeEnlacePaginado(absolver($(el).attr("href"), base));
    if (n === paginaActual + 1) {
      const abs = candidata($(el).attr("href"));
      if (abs) mejorNumerado = abs;
    }
  });
  if (mejorNumerado) return mejorNumerado;

  // 3) Botón/enlace "Siguiente" con href navegable.
  let siguienteTexto = "";
  $("a[href]").each((_, el) => {
    if (siguienteTexto) return;
    if (TEXTO_SIGUIENTE.test(textoLimpio($, el))) {
      const abs = candidata($(el).attr("href"));
      if (abs) siguienteTexto = abs;
    }
  });
  if (siguienteTexto) return siguienteTexto;

  // 4) Sondeo prudente: hay UI de paginación pero sin "siguiente" explícito.
  // Solo desde la página 1 y construyendo ?page=2 (un único intento, que el
  // bucle valida: si no aporta noticias nuevas, se detiene).
  if (paginaActual === 1) {
    const hayPaginador =
      $(".pagination,.paginacion,.paginador,ul.page-numbers,nav[class*='pagin' i],div[class*='pagin' i]").length > 0;
    if (hayPaginador) {
      try {
        const url = new URL(base);
        if (url.hostname.toLowerCase() === baseHost) {
          url.searchParams.set("page", "2");
          url.hash = "";
          return normalizarUrlPagina(url.href);
        }
      } catch {
        // Base inválida: sin sondeo.
      }
    }
  }
  return "";
}

// Sondeo de patrones clásicos de paginación (/page/2/, ?paged=2, ?page=2)
// para listados cuya paginación es 100% JS (bloques Query de Gutenberg,
// "Load More" sin href) y no exponen ninguna señal seguible. Solo desde la
// página 1: el bucle valida cada candidato y conserva únicamente el que
// aporta noticias nuevas (los demás se descartan sin romper el listado).
function candidatosSondeoPagina(base, baseHost) {
  const urls = [];
  try {
    const referencia = new URL(base);
    if (referencia.hostname.toLowerCase() !== baseHost) return urls;
    if (numeroDePagina(base) !== 1) return urls;
    // Nunca sondear sobre URLs de feed/sindicación.
    if (/\/(feed|rss|atom)(\/|$)/i.test(referencia.pathname)) return urls;
    // 1) Estilo WordPress: /page/2/ (verificado con github.blog el 17/09/2026:
    // su home no expone siguiente pero /page/2/ trae artículos distintos).
    const conRuta = new URL(base);
    conRuta.pathname = `${conRuta.pathname.replace(/\/+$/, "")}/page/2/`;
    conRuta.hash = "";
    urls.push(normalizarUrlPagina(conRuta.href));
    // 2) ?paged=2 (WordPress) y 3) ?page=2 (genérico).
    for (const param of ["paged", "page"]) {
      const conQuery = new URL(base);
      conQuery.searchParams.set(param, "2");
      conQuery.hash = "";
      urls.push(normalizarUrlPagina(conQuery.href));
    }
  } catch {
    // Base inválida: sin sondeo.
  }
  return [...new Set(urls)];
}

// Continuación en el mismo estilo del sondeo que funcionó (?page=2 →
// ?page=3, /page/2/ → /page/3/): permite recorrer paginadores 100% JS más
// allá de la segunda página. Solo aplica a URLs ya numeradas (N ≥ 2).
function siguienteUrlMismoEstilo(urlActual) {
  try {
    const n = numeroDePagina(urlActual);
    if (!Number.isInteger(n) || n < 2) return "";
    const url = new URL(urlActual);
    if (/\/(page|paged?|pagina|pg)\/\d+\/?$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(
        /\/(page|paged?|pagina|pg)\/\d+(\/?)$/i,
        `/$1/${n + 1}$2`
      );
      url.hash = "";
      return normalizarUrlPagina(url.href);
    }
    for (const nombre of ["paged", "page", "p", "pagina", "pg"]) {
      if (url.searchParams.has(nombre)) {
        url.searchParams.set(nombre, String(n + 1));
        url.hash = "";
        return normalizarUrlPagina(url.href);
      }
    }
  } catch {
    // URL inválida: sin continuación.
  }
  return "";
}

// Títulos de portada sin valor de sección ("Home", "Inicio"...): en esos
// casos el título de la fuente es solo el nombre del sitio.
const TITULO_SECCION_GENERICO = /^(home|inicio|homepage|portada|welcome|bienvenido|blog)$/i;

// Etiqueta específica de la sección/listado: primer h1 con contenido real
// (suele ser el nombre de la sección), luego og:title y por último <title>
// sin el sufijo del sitio ("Sección - Sitio"). Devuelve "" si no hay nada
// aprovechable.
function etiquetaSeccion($, sitio) {
  const candidatos = [];
  $("h1").each((_, el) => {
    const t = textoLimpio($, el).slice(0, 80);
    if (t.length >= 2 && t.length <= 60 && !TEXTO_NAV.test(t) && !candidatos.includes(t)) {
      candidatos.push(t);
    }
  });
  // Un h1 con el nombre del sitio (logo/cabecera) no describe la sección:
  // se prefiere otro h1 distinto antes de caer al primero.
  const distinto = candidatos.find((t) => t.toLowerCase() !== sitio.toLowerCase());
  if (distinto) return distinto;
  if (candidatos.length > 0) return candidatos[0];
  const og = meta($, "og:title");
  if (og && og.length >= 2 && og.length <= 80) return og.slice(0, 80);
  let titulo = $("title").first().text().replace(/\s+/g, " ").trim();
  if (sitio) {
    const esc = sitio.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    titulo = titulo.replace(new RegExp(`\\s*[|•·–—/-]\\s*${esc}\\s*$`, "i"), "").trim();
  }
  if (titulo.length >= 2 && titulo.length <= 80) return titulo;
  return "";
}

// Título de la fuente convertida con la sección calificada por el sitio
// ("The GitHub Blog - Engineering") en vez del nombre global idéntico para
// todas las secciones. Si la sección ya menciona al sitio ("The GitHub
// Engineering Blog") no se duplica; si el combinado es muy largo se queda
// con la parte más descriptiva.
function tituloSitioSeccion($, sitio, baseHost) {
  const seccion = etiquetaSeccion($, sitio);
  if (
    !seccion ||
    TITULO_SECCION_GENERICO.test(seccion) ||
    seccion.toLowerCase() === sitio.toLowerCase()
  ) {
    return sitio;
  }
  const nucleo = baseHost.replace(/^www\./i, "").split(".")[0].toLowerCase();
  if (
    seccion.toLowerCase().includes(sitio.toLowerCase()) ||
    (nucleo.length >= 3 && seccion.toLowerCase().includes(nucleo))
  ) {
    return seccion.length <= 60 ? seccion : sitio;
  }
  const combinado = `${sitio} - ${seccion}`;
  if (combinado.length <= 44) return combinado;
  return seccion.length <= 60 ? seccion : sitio;
}

// ---- Extracción de una página HTML a { tituloSitio, items, esArticuloUnico } ----

export function extraerFeedDeHtml(html, baseFinal) {
  const $ = cheerio.load(html, { decodeEntities: true });
  $("script:not([type='application/ld+json']), style, noscript").remove();

  let base = baseFinal;
  try {
    const baseHref = $("base[href]").first().attr("href");
    if (baseHref) base = new URL(baseHref, baseFinal).href;
  } catch {
    // Base inválida: se conserva la URL final.
  }
  let baseHost = "";
  try {
    baseHost = new URL(base).hostname.toLowerCase();
  } catch {
    throw errorWeb("La URL ingresada no tiene un formato válido.", "WEB_URL");
  }

  const nombreSitio =
    meta($, "og:site_name") ||
    $("title").first().text().replace(/\s+/g, " ").trim().slice(0, 120) ||
    baseHost.replace(/^www\./i, "");
  // Título por sección (h1 → og:title → <title>), calificado con el sitio:
  // cada subsección convertida queda con nombre diferenciado y persistible.
  const tituloSitio = tituloSitioSeccion($, nombreSitio, baseHost);

  const nodosJsonLd = extraerJsonLd($);
  let items = itemsDesdeJsonLd(nodosJsonLd, base, baseHost);
  let esArticuloUnico = false;
  if (items.length === 0) {
    // Desempate listado vs. artículo único: algunas plantillas (WordPress)
    // declaran og:type=article hasta en páginas de archivo. Si hay varios
    // <article> (uno por tarjeta) y la heurística de lista encuentra 2+,
    // es un listado aunque haya señales de artículo único.
    const numArticulos = $("article").length;
    let lista = [];
    if (numArticulos >= 2) {
      lista = itemsDesdeLista($, base, baseHost);
    }
    if (lista.length >= 2) {
      items = lista;
    } else {
      const unico = extraerArticuloUnico($, base, baseHost, nodosJsonLd);
      if (unico) {
        items = [unico];
        esArticuloUnico = true;
      } else if (lista.length === 0) {
        items = itemsDesdeLista($, base, baseHost);
      } else {
        items = lista;
      }
    }
  }
  const paginaActual = numeroDePagina(base);
  const siguiente = esArticuloUnico ? "" : detectarSiguientePagina($, base, baseHost, paginaActual);
  return { tituloSitio, items, esArticuloUnico, siguiente, base: normalizarUrlPagina(base) };
}

// ---- Entrada principal ----

/**
 * Convierte una página web sin feed nativo en un feed compatible con el
 * pipeline del dashboard. Devuelve:
 * { feed: { title, link, items: [{title, link, contentSnippet, isoDate,
 *   enclosure?, "media:content"?}] }, urlFinal, etag, lastModified }
 * o { sinCambios: true, urlFinal } si la página no cambió (validadores).
 * Lanza Error con mensaje limpio para el usuario si no es convertible.
 */
export async function convertirPaginaAFeed(urlIngresada, { validadores = {} } = {}) {
  const urlLimpia = limpiarUrlEntrada(urlIngresada);
  const descarga = await descargarPagina(urlLimpia, validadores);
  if (descarga.sinCambios) return { sinCambios: true, urlFinal: descarga.urlFinal };

  const { html, baseFinal, etag, lastModified } = descarga;
  const primera = extraerFeedDeHtml(html, baseFinal);
  if (primera.items.length === 0) {
    throw errorWeb(
      "Esta página no tiene una estructura de contenido compatible: no se encontraron artículos (ni datos JSON-LD, ni artículo único, ni lista de titulares).",
      "WEB_INCOMPATIBLE"
    );
  }

  // Multipage crawling: recorre páginas siguientes hasta agotar el listado o
  // alcanzar los topes (páginas, noticias, tiempo). Los artículos únicos no
  // paginan. Corte por página sin novedades = fin del listado. La cola
  // mezcla URLs detectadas en el HTML con sondeos de patrones clásicos; cada
  // sondeo fallido se descarta y se prueba el siguiente sin cortar el crawl.
  let todos = [...primera.items];
  let paginas = 1;
  const visitadas = new Set([primera.base, normalizarUrlPagina(urlLimpia)]);
  let baseHostSondeo = "";
  try {
    baseHostSondeo = new URL(primera.base).hostname.toLowerCase();
  } catch {
    // Base inválida: el crawl queda solo con la detección del HTML.
  }
  const cola = [];
  if (primera.siguiente) {
    cola.push({ url: primera.siguiente, sondeo: false });
  } else if (!primera.esArticuloUnico && baseHostSondeo) {
    for (const url of candidatosSondeoPagina(primera.base, baseHostSondeo)) {
      cola.push({ url, sondeo: true });
    }
  }
  const arranque = Date.now();
  while (
    cola.length > 0 &&
    !primera.esArticuloUnico &&
    paginas < MAX_PAGINAS_CRAWL &&
    todos.length < MAX_ITEMS_TOTAL &&
    Date.now() - arranque < TIEMPO_MAX_CRAWL_MS
  ) {
    const { url: urlSiguiente, sondeo } = cola.shift();
    const urlPagina = normalizarUrlPagina(urlSiguiente);
    if (!urlPagina || visitadas.has(urlPagina)) continue;
    visitadas.add(urlPagina);
    await esperar(CORTESIA_ENTRE_PAGINAS_MS);
    if (Date.now() - arranque >= TIEMPO_MAX_CRAWL_MS) break;
    let pagina;
    try {
      pagina = await descargarPagina(urlPagina);
    } catch {
      if (sondeo) continue; // Sondeo fallido: probar el siguiente patrón.
      break; // Página caída/bloqueada: se conserva lo ya recolectado.
    }
    if (pagina?.sinCambios || !pagina?.html) {
      if (sondeo) continue;
      break;
    }
    let extraidos;
    try {
      extraidos = extraerFeedDeHtml(pagina.html, pagina.baseFinal);
    } catch {
      if (sondeo) continue;
      break;
    }
    visitadas.add(extraidos.base);
    const vistos = new Set(todos.map((item) => item.url));
    let nuevos = 0;
    for (const item of extraidos.items) {
      if (todos.length >= MAX_ITEMS_TOTAL) break;
      if (!item.url || vistos.has(item.url)) continue;
      vistos.add(item.url);
      todos.push(item);
      nuevos++;
    }
    if (nuevos === 0) {
      if (sondeo) continue; // Patrón que no aplica: probar el siguiente.
      paginas++; // Se cuenta la página terminal detectada (semántica previa).
      break; // Listado agotado (o página repetida).
    }
    paginas++;
    // Página con novedades: se sigue la detección normal del HTML; si la
    // página no expone siguiente pero llegamos por sondeo (o la URL ya está
    // numerada), se continúa con el mismo patrón N+1 para paginadores JS.
    if (extraidos.siguiente) {
      cola.push({ url: extraidos.siguiente, sondeo: false });
    } else {
      const mas = siguienteUrlMismoEstilo(urlPagina);
      if (mas) cola.push({ url: mas, sondeo: true });
    }
  }

  // Consolidación: desduplicar por URL y ordenar cronológicamente inverso
  // (más reciente primero). Sin fecha válida van al final, en orden de
  // descubrimiento, para no fingir una novedad que no tienen.
  const vistosFinal = new Set();
  const unicos = todos.filter((item) => {
    if (!item.url || vistosFinal.has(item.url)) return false;
    vistosFinal.add(item.url);
    return true;
  });
  unicos.sort((a, b) => {
    const ta = Date.parse(a.fecha || "");
    const tb = Date.parse(b.fecha || "");
    const va = Number.isNaN(ta) ? -1 : ta;
    const vb = Number.isNaN(tb) ? -1 : tb;
    return vb - va;
  });

  const ahora = new Date().toISOString();
  const itemsFeed = [];
  for (const item of unicos.slice(0, MAX_ITEMS_TOTAL)) {
    const descripcion = [item.resumen, item.autor ? `Por ${item.autor}` : ""]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 320);
    const entrada = {
      title: item.titulo,
      link: item.url,
      guid: item.url,
      contentSnippet: descripcion,
      isoDate: item.fecha || ahora,
      pubDate: item.fecha || ahora,
    };
    if (item.imagen && /^https?:\/\//i.test(item.imagen)) {
      entrada.enclosure = { url: item.imagen };
    }
    if (item.video && /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i.test(item.video)) {
      entrada["media:content"] = { $: { url: item.video, type: "video/mp4" } };
    }
    itemsFeed.push(entrada);
  }
  if (itemsFeed.length === 0) {
    throw errorWeb(
      "Esta página no tiene una estructura de contenido compatible para convertir a RSS.",
      "WEB_INCOMPATIBLE"
    );
  }

  return {
    feed: { title: primera.tituloSitio, link: baseFinal, items: itemsFeed },
    urlFinal: baseFinal,
    etag: etag || null,
    lastModified: lastModified || null,
    convertida: true,
    paginas,
  };
}
