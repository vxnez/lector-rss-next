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
    fechaAISO($("article time[datetime]").first().attr("datetime") || $("time[datetime]").first().attr("datetime"));
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
    const ambito = contenedor.length ? contenedor : a.parent();
    const resumen = ["p", ".resumen,.excerpt,.summary,.entradilla,dd"].reduce((mejor, sel) => {
      if (mejor) return mejor;
      const texto = textoLimpio($, ambito.find(sel).first());
      if (texto && texto.length > 30 && !texto.startsWith(titulo.slice(0, 20))) {
        return texto.slice(0, 300);
      }
      return mejor;
    }, "");
    const fecha =
      fechaAISO(ambito.find("time[datetime]").first().attr("datetime")) ||
      fechaAISO(ambito.find("[class*='date'],[class*='fecha'],[class*='publish'],[class*='time']").first().text().slice(0, 60));

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
    candidatos.push({ titulo, url: limpio, resumen, fecha, autor: "", imagen, video: "", puntuacion });
  });
  return candidatos
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, MAX_ITEMS)
    .map(({ puntuacion, ...item }) => item);
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

  const tituloSitio =
    meta($, "og:site_name") ||
    $("title").first().text().replace(/\s+/g, " ").trim().slice(0, 120) ||
    baseHost.replace(/^www\./i, "");

  const nodosJsonLd = extraerJsonLd($);
  let items = itemsDesdeJsonLd(nodosJsonLd, base, baseHost);
  if (items.length === 0) {
    const unico = extraerArticuloUnico($, base, baseHost, nodosJsonLd);
    if (unico) items = [unico];
  }
  if (items.length === 0) {
    items = itemsDesdeLista($, base, baseHost);
  }
  if (items.length === 0) {
    throw errorWeb(
      "Esta página no tiene una estructura de contenido compatible: no se encontraron artículos (ni datos JSON-LD, ni artículo único, ni lista de titulares).",
      "WEB_INCOMPATIBLE"
    );
  }

  const ahora = new Date().toISOString();
  const vistos = new Set();
  const itemsFeed = [];
  for (const item of items) {
    if (!item.url || vistos.has(item.url)) continue;
    vistos.add(item.url);
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
    if (itemsFeed.length >= MAX_ITEMS) break;
  }
  if (itemsFeed.length === 0) {
    throw errorWeb(
      "Esta página no tiene una estructura de contenido compatible para convertir a RSS.",
      "WEB_INCOMPATIBLE"
    );
  }

  return {
    feed: { title: tituloSitio, link: baseFinal, items: itemsFeed },
    urlFinal: baseFinal,
    etag: etag || null,
    lastModified: lastModified || null,
    convertida: true,
  };
}
