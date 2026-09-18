// src/app/api/rss/route.js
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolverUsuarioId } from "@/lib/invitado";
import { NextResponse, after } from "next/server";
import { sendPushToUser } from "@/lib/push";
import Parser from "rss-parser";

export const maxDuration = 60;
import * as cheerio from "cheerio";
import {
  CATALOGO_PROMPT,
  CATEGORIAS_DISPONIBLES,
} from "@/lib/categoryClassifier";
import { fetchPublico, leerBufferLimitado, leerTextoLimitado } from "@/lib/ssrf";
import { convertirPaginaAFeed } from "@/lib/webToRss";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
});

// LRU mínima sin dependencias: evita crecimiento sin cota en servidor.
// Solo se cachean éxitos de Gemini; los fallos ("sin-ia") no se guardan.
const CLASIFICACION_CACHE_MAX = 500;
const clasificacionCache = new Map();
const imagenPaginaCache = new Map();

function cacheClasificacionGet(key) {
  const hit = clasificacionCache.get(key);
  if (hit) {
    // Refresca recencia.
    clasificacionCache.delete(key);
    clasificacionCache.set(key, hit);
  }
  return hit;
}

function cacheClasificacionSet(key, valor) {
  if (clasificacionCache.has(key)) clasificacionCache.delete(key);
  clasificacionCache.set(key, valor);
  if (clasificacionCache.size > CLASIFICACION_CACHE_MAX) {
    clasificacionCache.delete(clasificacionCache.keys().next().value);
  }
}

// Resuelve rutas relativas (/images/x.jpg, //cdn/...) contra la página y
// valida scheme http(s). Sin esto se pierden imágenes con src relativo,
// muy común en WordPress y CMS propios.
function absolverUrlMultimedia(valor, base) {
  if (typeof valor !== "string") return null;
  const v = valor.trim();
  if (!v || /^(data:|blob:|javascript:)/i.test(v)) return null;
  try {
    const abs = new URL(v, base).href;
    if (!/^https?:\/\//i.test(abs)) return null;
    return abs;
  } catch {
    return null;
  }
}

// Píxeles de seguimiento / trackers 1x1 por nombre o dimensiones.
// (No se verifica con HEAD cada candidato: el costo en latencia es alto y
// el cliente ya descarta con onError; esto filtra lo evidente en origen.)
function esTrackerMultimedia(img, abs) {
  const texto = `${img.attr("src") || ""} ${img.attr("data-src") || ""} ${img.attr("alt") || ""} ${img.attr("class") || ""} ${abs || ""}`.toLowerCase();
  if (/pixel|beacon|\/track|tracking|analytics|spacer|transparent|blank|1x1|clear\.gif|dot\.gif/i.test(texto)) return true;
  const w = parseInt(img.attr("width") || "0", 10);
  const h = parseInt(img.attr("height") || "0", 10);
  if ((w === 1 && h <= 1) || (h === 1 && w <= 1)) return true;
  return false;
}

// ¿URL directa a archivo de video reproducible en <video>? Solo ficheros
// (mp4/webm/ogv/mov/m4v); se rechazan players embebidos (youtube, embeds)
// porque no son reproducibles como fondo sin controles.
function esUrlVideoDirecta(valor) {
  if (typeof valor !== "string") return false;
  const v = valor.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  return /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i.test(v);
}

// Descarga el HTML de una página (con guard SSRF) o null si no es HTML.
// Con reintento en perfil alterno: varios medios (WAFs) bloquean la huella
// Chrome con 403 pero responden al perfil Firefox (patrón ya verificado en
// feeds). Registra cada desenlace para trazabilidad en logs del servidor.
async function obtenerHtmlPagina(url, etiqueta = "media") {
  const inicio = Date.now();
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {
    // Se registra la URL cruda.
  }
  const registrar = (estado, detalle = "") => {
    console.log(`[media:${etiqueta}] host=${host} ${estado} ms=${Date.now() - inicio}${detalle ? ` ${detalle}` : ""}`);
  };
  try {
    let res;
    let urlFinal = url;
    try {
      ({ res, urlFinal } = await fetchPublico(url, { headers: HEADERS_BROWSER, timeoutMs: 8000 }));
    } catch (err) {
      if (err.name === "AbortError") throw err;
      ({ res, urlFinal } = await fetchPublico(url, { headers: HEADERS_ALT, timeoutMs: 8000 }));
    }
    if (!res.ok && [401, 403, 429].includes(res.status)) {
      await res.arrayBuffer().catch(() => {});
      ({ res, urlFinal } = await fetchPublico(url, { headers: HEADERS_ALT, timeoutMs: 8000 }));
    }
    const contentType = res.headers.get("content-type") || "";
    if (!res.ok || !/html/i.test(contentType)) {
      registrar("NO_HTML", `status=${res.status} ct=${contentType.slice(0, 60)}`);
      return null;
    }
    const html = await leerTextoLimitado(res);
    registrar("OK", `bytes=${html.length}`);
    return { html, baseFinal: urlFinal || url };
  } catch (err) {
    registrar(err.name === "AbortError" ? "TIMEOUT" : "ERROR", `motivo=${err.message || err}`);
    return null;
  }
}

// Video de la página: meta tags, <video> nativos e iframes embebidos.
// Devuelve { video, poster }: el poster (og:video n/a, <video poster>,
// thumbnail YouTube/Vimeo) sirve como imagen cuando no hay otra.
async function extraerVideoDePagina(url) {
  const vacio = { video: "", poster: "" };
  const pagina = await obtenerHtmlPagina(url);
  if (!pagina) return vacio;
  const $ = cheerio.load(pagina.html);
  // 1) Meta tags estándar.
  const candidatos = [
    { url: $('meta[property="og:video:secure_url"]').attr("content"), tipo: $('meta[property="og:video:type"]').attr("content") },
    { url: $('meta[property="og:video"]').attr("content"), tipo: $('meta[property="og:video:type"]').attr("content") },
    { url: $('meta[property="og:video:url"]').attr("content"), tipo: $('meta[property="og:video:type"]').attr("content") },
    { url: $('meta[name="twitter:player:stream"]').attr("content"), tipo: null },
  ];
  for (const c of candidatos) {
    if (typeof c.tipo === "string" && c.tipo && !c.tipo.toLowerCase().startsWith("video/")) continue;
    if (esUrlVideoDirecta(c.url)) {
      try {
        return { video: new URL(c.url.trim(), pagina.baseFinal).href, poster: "" };
      } catch {
        // Probar con el siguiente candidato.
      }
    }
  }
  // 2) <video> nativos: <source> directo + poster representativo.
  const videos = $("video");
  for (const el of videos.toArray()) {
    const v = $(el);
    const poster = absolverUrlMultimedia(v.attr("poster"), pagina.baseFinal) || "";
    const fuentes = [];
    if (v.attr("src")) fuentes.push(v.attr("src"));
    v.find("source").each((_, s) => {
      const u = $(s).attr("src");
      if (u) fuentes.push(u);
    });
    for (const f of fuentes) {
      if (esUrlVideoDirecta(f)) {
        try {
          return { video: new URL(f.trim(), pagina.baseFinal).href, poster };
        } catch {
          // Probar con la siguiente fuente.
        }
      }
    }
    if (poster) return { video: "", poster };
  }
  // 2b. JW Player: el <video> usa blob: (inservible fuera del navegador),
  // pero .jw-preview trae el poster en el style (CDN estable, sin firmar).
  // Nota: no se usa la API de playlist de JW (mp4 con token temporal que
  // caduca y pudriría el dato persistido); el poster sí es permanente.
  const vistas = $(".jw-preview, [class*='jw-preview']");
  for (const el of vistas.toArray()) {
    const estilo = $(el).attr("style") || "";
    const coincidencia = estilo.match(/url\(\s*["']?(https?:[^"')]+)["']?\s*\)/i);
    if (coincidencia) {
      const abs = absolverUrlMultimedia(coincidencia[1], pagina.baseFinal);
      if (abs) return { video: "", poster: abs };
    }
  }
  // 3) iframes embebidos: YouTube (incl. youtube-nocookie y web-components
  // ytm-*) → thumbnail determinista (sin red); Vimeo → oEmbed público
  // (una sola llamada con guard SSRF).
  const esPaginaYouTube =
    pagina.html.includes("youtube-nocookie") ||
    pagina.html.includes("ytm-") ||
    pagina.html.includes("youtube.com/embed");
  const idYouTubeValido = (v) => (typeof v === "string" && /^[\w-]{11}$/.test(v.trim() || "") ? v.trim() : "");
  if (esPaginaYouTube) {
    const conId = $("[video-id], [data-video-id]");
    for (const el of conId.toArray()) {
      const id = idYouTubeValido($(el).attr("video-id")) || idYouTubeValido($(el).attr("data-video-id"));
      if (id) return { video: "", poster: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
    }
  }
  const frames = $("iframe");
  for (const el of frames.toArray()) {
    const src = $(el).attr("src") || "";
    const yt = src.match(/(?:youtube\.com\/(?:embed\/|v\/|shorts\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([\w-]{6,})/i);
    if (yt) return { video: "", poster: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };
    const vm = src.match(/player\.vimeo\.com\/video\/(\d+)/i);
    if (vm) {
      const thumb = await miniaturaVimeo(vm[1]);
      if (thumb) return { video: "", poster: thumb };
    }
  }
  return vacio;
}

async function miniaturaVimeo(id) {
  try {
    const { res } = await fetchPublico(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${id}`)}`,
      { headers: { Accept: "application/json" }, timeoutMs: 5000 }
    );
    if (!res.ok) return "";
    const data = await res.json().catch(() => null);
    const thumb = data?.thumbnail_url;
    return typeof thumb === "string" && /^https?:\/\//i.test(thumb.trim()) ? thumb.trim() : "";
  } catch {
    return "";
  }
}

// Video incluido en el propio feed (enclosure o media:content de video).
function extraerVideoUrl(item = {}) {
  const candidatos = [];
  const enclosure = item.enclosure;
  if (enclosure && typeof enclosure.url === "string") {
    candidatos.push({ url: enclosure.url, tipo: enclosure.type });
  }
  const grupos = [item["media:content"], item["media:group"]];
  for (const grupo of grupos) {
    const lista = Array.isArray(grupo) ? grupo : [grupo];
    for (const m of lista) {
      const datos = m?.$ || (typeof m === "object" && m !== null && typeof m.url === "string" ? m : null);
      if (datos && typeof datos.url === "string") candidatos.push({ url: datos.url, tipo: datos.type || datos.medium });
    }
  }
  for (const c of candidatos) {
    if (typeof c.tipo === "string" && c.tipo) {
      const t = c.tipo.toLowerCase();
      if (t.startsWith("image/") || t.startsWith("audio/")) continue;
      if (t.includes("/") && !t.startsWith("video/")) continue;
    }
    if (esUrlVideoDirecta(c.url)) return c.url.trim();
  }
  return "";
}

async function extraerImagenDirecta(url) {
  // Reutiliza el fetcher con fallback de perfil + logs (obtenerHtmlPagina).
  const pagina = await obtenerHtmlPagina(url, "imagen");
  if (!pagina) return null;
  const { html, baseFinal } = pagina;
  try {
    const $ = cheerio.load(html);

    // Helper: obtener la mejor URL de srcset (la de mayor ancho)
    function mejorDeSrcset(srcset) {
      if (!srcset) return null;
      const partes = srcset.split(",").map(s => s.trim());
      let mejor = null;
      let maxW = 0;
      for (const parte of partes) {
        const match = parte.match(/^(.+?)\s+(\d+)w$/);
        if (match) {
          const w = parseInt(match[2], 10);
          if (w > maxW) {
            maxW = w;
            mejor = match[1].trim();
          }
        } else if (!mejor && parte) {
          // fallback: primera URL si no hay descriptores w
          mejor = parte.split(" ")[0].trim();
        }
      }
      return mejor;
    }

    // 1. Meta tags estándar (OG, Twitter, etc.)
    const metaCandidatas = [
      $('meta[property="og:image"]').attr("content"),
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('meta[name="twitter:image:src"]').attr("content"),
      $('link[rel="image_src"]').attr("href"),
      $('meta[property="og:image:url"]').attr("content"),
      $('meta[name="image"]').attr("content"),
      $('meta[itemprop="image"]').attr("content"),
    ];
    for (const candidata of metaCandidatas) {
      if (typeof candidata === "string" && candidata.trim()) {
        try {
          const absoluta = new URL(candidata.trim(), baseFinal).href;
          if (/^https?:\/\//i.test(absoluta)) return absoluta;
        } catch {
          // Probar con la siguiente candidata.
        }
      }
    }

    // 2. JSON-LD structured data (Schema.org)
    const jsonLdScripts = $('script[type="application/ld+json"]');
    for (const el of jsonLdScripts.toArray()) {
      try {
        const data = JSON.parse($(el).html() || "");
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] === "ImageObject" && item.contentUrl) {
            return new URL(item.contentUrl, baseFinal).href;
          }
          if (item.image) {
            const img = typeof item.image === "string" ? item.image : item.image.contentUrl || item.image.url;
            if (img) return new URL(img, baseFinal).href;
          }
        }
      } catch {
        // Ignorar JSON inválido
      }
    }

    // 3. Buscar la primera imagen grande en el contenido principal
    // Selectores ampliados para WordPress, sitios modernos, etc.
    const selectoresContenido = [
      'article img',
      '[role="main"] img',
      '.article-body img',
      '.post-content img',
      '.entry-content img',
      '.content img',
      'main img',
      '#content img',
      // WordPress / Gutenberg / WP Engine
      '.wp-block-image img',
      '.wp-block-cover img',
      '.post-thumbnail img',
      '.entry-header img',
      '.featured-image img',
      '.post-image img',
      '.article-image img',
      '.hero-image img',
      // Señales de alta precisión: LCP del artículo, microdatos y
      // miniatura del post (Astra/WordPress: .post-thumb).
      'img[fetchpriority="high"]',
      '[itemprop="image"]',
      '.post-thumb img',
      '[class*="post-thumb"] img',
      '.attachment-full',
      // Figcaption de adjunto WordPress (Astra/autofácil: figure.wp-caption
      // con img.wp-image-* y data-src lazy).
      '.wp-caption img',
      'figure[class*="wp-"] img',
      // Clases comunes de temas
      '.td-post-content img',
      '.post-body img',
      '.article-content img',
      '.story-body img',
      '.entry img',
      // Contenedores de imagen principal
      '[class*="featured"] img',
      '[class*="hero"] img',
      '[class*="lead"] img',
      '[class*="main-image"] img',
      '[class*="primary-image"] img',
      // Figure / Picture (común en WordPress)
      'figure img',
      'picture img',
      'figure picture img',
      // Android Authority / sitios con CSS-in-JS
      '[class^="e_"] img',
      '[class*=" e_"] img',
      '[class*="wp-image-"]',
      // Selectores genéricos de contenedores de imagen
      '.image-wrapper img',
      '.img-wrapper img',
      '.thumbnail img',
      '.post-media img',
      '.entry-media img',
    ];
    for (const selector of selectoresContenido) {
      const img = $(selector).first();
      if (img.length) {
        // Prioridad: srcset (mejor resolución) > src > data-src > data-lazy-src > data-original
        const srcset = img.attr("srcset");
        const srcDeSrcset = mejorDeSrcset(srcset);
        const src = srcDeSrcset || img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src") || img.attr("data-original") || img.attr("data-srcset") && mejorDeSrcset(img.attr("data-srcset"));
        const abs = absolverUrlMultimedia(src, baseFinal);
        if (abs && !esTrackerMultimedia(img, abs)) return abs;
      }
    }

    // 3b. Buscar en <picture><source> (responsive images)
    const pictureSources = $('picture source');
    for (const source of pictureSources.toArray()) {
      const srcset = $(source).attr("srcset");
      const srcDeSrcset = mejorDeSrcset(srcset);
      const abs = absolverUrlMultimedia(srcDeSrcset, baseFinal);
      if (abs) return abs;
    }

    // 4. Fallback: primera imagen válida en todo el HTML (excluyendo iconos, avatares, etc.)
    const todasLasImagenes = $('img');
    for (let i = 0; i < todasLasImagenes.length; i++) {
      const img = $(todasLasImagenes[i]);
      const srcset = img.attr("srcset");
      const srcDeSrcset = mejorDeSrcset(srcset);
      const src = srcDeSrcset || img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src") || img.attr("data-original") || img.attr("data-srcset") && mejorDeSrcset(img.attr("data-srcset"));
      if (!src) continue;
      // Filtrar imágenes pequeñas/iconos/avatares/trackers
      const width = parseInt(img.attr("width") || "0", 10);
      const height = parseInt(img.attr("height") || "0", 10);
      if ((width && width < 100) || (height && height < 100)) continue;
      const alt = (img.attr("alt") || "").toLowerCase();
      if (alt.includes("logo") || alt.includes("icon") || alt.includes("avatar") || alt.includes("badge")) continue;
      try {
        const abs = new URL(src, baseFinal).href;
        if (esTrackerMultimedia(img, abs)) continue;
        if (/^https?:\/\//i.test(abs) && /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(abs)) return abs;
      } catch {
        // continuar
      }
    }

    return null;
  } catch {
    return null;
  }
}

let classificationSchemaPromise;

// Red de seguridad en cold start (cacheada por promesa): el esquema canónico
// vive en sql/03_articulos.sql + sql/06_ensure_schema.sql para BDs antiguas.
async function ensureClassificationSchema() {
  if (!classificationSchemaPromise) {
    classificationSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'articulos_publicados'
           AND COLUMN_NAME IN ('clasificacion_metodo', 'clasificacion_confianza', 'imagen_url')`
      );
      const existing = new Set(columns.map((column) => column.COLUMN_NAME));
      if (!existing.has("clasificacion_metodo")) {
        await db.query("ALTER TABLE articulos_publicados ADD COLUMN clasificacion_metodo VARCHAR(20) NOT NULL DEFAULT 'sin-ia'");
      }
      if (!existing.has("clasificacion_confianza")) {
        await db.query("ALTER TABLE articulos_publicados ADD COLUMN clasificacion_confianza DECIMAL(4,3) NOT NULL DEFAULT 0.500");
      }
      if (!existing.has("imagen_url")) {
        await db.query("ALTER TABLE articulos_publicados ADD COLUMN imagen_url VARCHAR(500) NULL");
      }
    })().catch((error) => {
      classificationSchemaPromise = undefined;
      throw error;
    });
  }
  return classificationSchemaPromise;
}

let articulosUnicidadPromise;

// Columna video_url (misma red de seguridad que el resto de ensures).
let videoSchemaPromise;

async function ensureVideoSchema() {
  if (!videoSchemaPromise) {
    videoSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'articulos_publicados'
           AND COLUMN_NAME = 'video_url'`
      );
      if (columns.length === 0) {
        await db.query("ALTER TABLE articulos_publicados ADD COLUMN video_url VARCHAR(500) NULL");
      }
    })().catch((error) => {
      videoSchemaPromise = undefined;
      throw error;
    });
  }
  return videoSchemaPromise;
}

async function ensureArticulosUnicidad(userId) {
  if (!articulosUnicidadPromise) {
    articulosUnicidadPromise = (async () => {
      const [indices] = await db.query(
        `SELECT INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columnas
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'articulos_publicados'
           AND NON_UNIQUE = 0
         GROUP BY INDEX_NAME`
      );
      const tieneGlobal = indices.some((indice) => indice.INDEX_NAME === "unique_url");
      const tienePar = indices.some((indice) => indice.columnas === "fuente_id,url_original");
      if (tieneGlobal) {
        await db.query("ALTER TABLE articulos_publicados DROP INDEX unique_url");
      }
      if (!tienePar) {
        await db.query("ALTER TABLE articulos_publicados ADD UNIQUE KEY unique_fuente_url (fuente_id, url_original)");
      }
      await normalizarArticulosExistentes(userId);
    })().catch((error) => {
      articulosUnicidadPromise = undefined;
      throw error;
    });
  }
  return articulosUnicidadPromise;
}

let fuentesCacheSchemaPromise;

async function ensureFuentesCacheSchema() {
  if (!fuentesCacheSchemaPromise) {
    fuentesCacheSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'fuentes_rss'
           AND COLUMN_NAME IN ('etag', 'last_modified', 'ultima_revision')`
      );
      const existing = new Set(columns.map((column) => column.COLUMN_NAME));
      if (!existing.has("etag")) {
        await db.query("ALTER TABLE fuentes_rss ADD COLUMN etag VARCHAR(255) NULL");
      }
      if (!existing.has("last_modified")) {
        await db.query("ALTER TABLE fuentes_rss ADD COLUMN last_modified VARCHAR(255) NULL");
      }
      if (!existing.has("ultima_revision")) {
        await db.query("ALTER TABLE fuentes_rss ADD COLUMN ultima_revision DATETIME NULL");
      }
    })().catch((error) => {
      fuentesCacheSchemaPromise = undefined;
      throw error;
    });
  }
  return fuentesCacheSchemaPromise;
}

async function actualizarValidadoresFuente(fuenteId, etag, lastModified) {
  await db.query(
    `UPDATE fuentes_rss
     SET etag = COALESCE(?, etag), last_modified = COALESCE(?, last_modified), ultima_revision = NOW()
     WHERE id = ?`,
    [etag || null, lastModified || null, fuenteId]
  );
}

// Origen de la fuente: 'rss' (feed nativo) o 'web' (página convertida con el
// motor web→RSS). Las convertidas se refrescan re-scrapeando la página en vez
// de parsear un feed, y comparten el mismo caché condicional (etag /
// last_modified / ultima_revision). Patrón ensure* del proyecto: la columna
// se crea bajo demanda y la promesa se cachea por vida del servidor.
let fuentesOrigenSchemaPromise;

async function ensureFuentesOrigenSchema() {
  if (!fuentesOrigenSchemaPromise) {
    fuentesOrigenSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'fuentes_rss'
           AND COLUMN_NAME = 'origen'`
      );
      if (columns.length === 0) {
        await db.query(
          "ALTER TABLE fuentes_rss ADD COLUMN origen VARCHAR(16) NOT NULL DEFAULT 'rss'"
        );
      }
    })().catch((error) => {
      fuentesOrigenSchemaPromise = undefined;
      throw error;
    });
  }
  return fuentesOrigenSchemaPromise;
}

// Interruptor por fuente "convertir la página completa": 1 = refrescar con el
// crawler multipágina completo (convertirPaginaAFeed) bajo demanda, 0 =
// extracción estándar. Patrón ensure* del proyecto: columna creada bajo
// demanda y promesa cacheada por vida del servidor.
let fuentesFullPageSchemaPromise;

async function ensureFuentesFullPageSchema() {
  if (!fuentesFullPageSchemaPromise) {
    fuentesFullPageSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'fuentes_rss'
           AND COLUMN_NAME = 'convert_full_page'`
      );
      if (columns.length === 0) {
        await db.query(
          "ALTER TABLE fuentes_rss ADD COLUMN convert_full_page TINYINT(1) NOT NULL DEFAULT 0"
        );
      }
    })().catch((error) => {
      fuentesFullPageSchemaPromise = undefined;
      throw error;
    });
  }
  return fuentesFullPageSchemaPromise;
}

// Mapa id → convertFullPage tolerante a BDs sin la columna (todo 0).
// Evita que un SELECT con columna inexistente rompa refrescos/cron.
async function mapaFullPageFuentes(ids = []) {
  const mapa = new Map();
  if (!ids.length) return mapa;
  try {
    const [filas] = await db.query(
      `SELECT id, convert_full_page FROM fuentes_rss WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    for (const fila of filas) mapa.set(fila.id, Number(fila.convert_full_page) === 1);
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR" && error?.code !== "ER_NO_SUCH_TABLE") throw error;
    for (const id of ids) mapa.set(id, false);
  }
  return mapa;
}

// URL de página original ingresada por el usuario (para el crawler
// full-page aunque url_feed apunte al feed XML descubierto). Patrón
// ensure* del proyecto: columna creada bajo demanda y promesa cacheada.
let fuentesPaginaOrigenSchemaPromise;

async function ensureFuentesPaginaOrigenSchema() {
  if (!fuentesPaginaOrigenSchemaPromise) {
    fuentesPaginaOrigenSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'fuentes_rss'
           AND COLUMN_NAME = 'pagina_origen'`
      );
      if (columns.length === 0) {
        await db.query(
          "ALTER TABLE fuentes_rss ADD COLUMN pagina_origen VARCHAR(1000) NULL"
        );
      }
    })().catch((error) => {
      fuentesPaginaOrigenSchemaPromise = undefined;
      throw error;
    });
  }
  return fuentesPaginaOrigenSchemaPromise;
}

// Mapa id → origen tolerante a BDs sin la columna (todo 'rss').
// Evita que un SELECT con columna inexistente rompa refrescos/cron.
async function mapaOrigenFuentes(ids = []) {
  const mapa = new Map();
  if (!ids.length) return mapa;
  try {
    const [filas] = await db.query(
      `SELECT id, origen FROM fuentes_rss WHERE id IN (${ids.map(() => "?").join(",")})`,
      ids
    );
    for (const fila of filas) mapa.set(fila.id, fila.origen === "web" ? "web" : "rss");
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR" && error?.code !== "ER_NO_SUCH_TABLE") throw error;
    for (const id of ids) mapa.set(id, "rss");
  }
  return mapa;
}

// Obtiene el feed de una fuente según su origen y su interruptor
// convertFullPage: parseo nativo, re-scrapeo de página convertida, o
// crawler multipágina completo bajo demanda (flag activo). El modo nativo
// usa validadores condicionales; el modo full-page siempre descarga en
// fresco (los validadores del feed XML no sirven para la página HTML).
async function obtenerFeedFuente(fuente, { omitirOrigenDb = false } = {}) {
  const validadores = { etag: fuente.etag, lastModified: fuente.last_modified };
  let convertFullPage = Number(fuente.convert_full_page) === 1 || fuente.convertFullPage === true;
  if (!fuente.convert_full_page && fuente.convertFullPage === undefined && !omitirOrigenDb && fuente.id) {
    convertFullPage = (await mapaFullPageFuentes([fuente.id])).get(fuente.id) || false;
  }
  // Flag activo: invoca el motor de paginación/crawler completo en lugar de
  // la extracción estándar limitada a la primera página.
  // Clave: url_feed puede ser el XML del feed descubierto (p. ej.
  // https://github.blog/feed/), no la página que el usuario pegó (p. ej.
  // https://github.blog/developer-skills/). Convertir el XML como HTML
  // falla o devuelve "sin cambios", por eso se prueban candidatos en orden:
  // 1) pagina_origen (URL original del usuario), 2) link del sitio obtenido
  // del propio feed, 3) url_feed tal cual (cubre origen 'web').
  if (convertFullPage) {
    const candidatos = [];
    const ver = (v) => (typeof v === "string" ? v.trim() : "");
    for (const url of [ver(fuente.pagina_origen), ver(fuente.url_feed)]) {
      if (url && !candidatos.includes(url)) candidatos.push(url);
    }
    let ultimoError = null;
    for (const url of candidatos) {
      try {
        const conversion = await convertirPaginaAFeed(url, {});
        if (conversion?.sinCambios) continue;
        return { feed: conversion.feed, etag: conversion.etag, lastModified: conversion.lastModified, paginas: conversion.paginas || 1 };
      } catch (err) {
        ultimoError = err;
        // Solo tiene sentido el fallback al sitio si la URL no era HTML.
        if (!err?.code?.startsWith("WEB_")) throw err;
      }
    }
    // Fallback: el feed nativo suele traer <link> al sitio; crawlear su home.
    try {
      const feedRes = await intentarParsearFeed(fuente.url_feed, {});
      const sitio = ver(feedRes?.feed?.link);
      if (sitio && !candidatos.includes(sitio)) {
        const conversion = await convertirPaginaAFeed(sitio, {});
        if (!conversion?.sinCambios) {
          return { feed: conversion.feed, etag: conversion.etag, lastModified: conversion.lastModified, paginas: conversion.paginas || 1 };
        }
      }
    } catch {
      // Se ignora: abajo se relanza el error original de la página.
    }
    throw ultimoError || new Error("No se pudo convertir la página a RSS.");
  }
  let origen = fuente.origen;
  if (!origen && !omitirOrigenDb) {
    origen = (await mapaOrigenFuentes([fuente.id])).get(fuente.id) || "rss";
  }
  if (origen === "web") {
    const conversion = await convertirPaginaAFeed(fuente.url_feed, { validadores });
    if (conversion?.sinCambios) return { sinCambios: true, urlFinal: conversion.urlFinal };
    return { feed: conversion.feed, etag: conversion.etag, lastModified: conversion.lastModified };
  }
  return intentarParsearFeed(fuente.url_feed, validadores);
}

// Refuerzo de medios: guarda imagen/video descubiertos bajo demanda en el
// artículo (solo vacíos y del llamante) para no re-extraer en cada apertura.
async function persistirMediaArticulo(idArticulo, userId, { imagen, video } = {}) {
  if (!Number.isInteger(idArticulo) || idArticulo <= 0) return;
  const asignaciones = [];
  const params = [];
  if (typeof imagen === "string" && /^https?:\/\//i.test(imagen.trim())) {
    asignaciones.push("a.imagen_url = ?");
    params.push(imagen.trim().slice(0, 500));
  }
  if (typeof video === "string" && esUrlVideoDirecta(video)) {
    asignaciones.push("a.video_url = ?");
    params.push(video.trim().slice(0, 500));
  }
  if (asignaciones.length === 0) return;
  params.push(idArticulo, userId);
  await db.query(
    `UPDATE articulos_publicados a
     INNER JOIN fuentes_rss f ON a.fuente_id = f.id
     SET ${asignaciones.join(", ")}
     WHERE a.id = ? AND f.usuario_id = ?`,
    params
  );
}

const HEADERS_BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/xhtml+xml, */*;q=0.8",
  Referer: "https://www.google.com/",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

// Perfil alterno sin Referer y con UA Firefox: algunos WAFs (p. ej.
// Hipertextual) bloquean la huella Chrome con 403 en ms, pero responden
// 200 a este perfil. Verificado por prueba directa el 15/09/2026.
const HEADERS_ALT = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/xhtml+xml, */*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

function limpiarUrlNoticia(rawUrl) {
  if (!rawUrl) return "";
  try {
    const urlObj = new URL(rawUrl.trim());
    // Allowlist de esquemas: los enlaces de artículos solo pueden ser
    // http/https. Otros esquemas (javascript:, data:, ...) se descartan
    // para que nunca lleguen al href del lector.
    if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") return "";
    const parametrosSeguimiento = /^(utm_|fbclid$|gclid$|dclid$|mc_cid$|mc_eid$|_ga$|ref$)/i;
    for (const nombre of [...urlObj.searchParams.keys()]) {
      if (parametrosSeguimiento.test(nombre)) urlObj.searchParams.delete(nombre);
    }
    urlObj.protocol = urlObj.protocol.toLowerCase();
    urlObj.hostname = urlObj.hostname.toLowerCase();
    if ((urlObj.protocol === "http:" && urlObj.port === "80") || (urlObj.protocol === "https:" && urlObj.port === "443")) {
      urlObj.port = "";
    }
    urlObj.hash = "";
    urlObj.pathname = urlObj.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
    return urlObj.toString();
  } catch (e) {
    return "";
  }
}

function limpiarUrl(urlRaw) {
  const valor = urlRaw?.trim();
  if (!valor) return "";

  try {
    return new URL(/^https?:\/\//i.test(valor) ? valor : `https://${valor}`).href;
  } catch (error) {
    throw new Error("La URL ingresada no tiene un formato válido.");
  }
}

function normalizarUrlComparacion(rawUrl = "") {
  const valor = rawUrl.trim();
  if (!valor) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(valor) ? valor : `https://${valor}`);
    url.hash = "";
    for (const param of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      url.searchParams.delete(param);
    }
    const ruta = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ""}${ruta}${url.search}`;
  } catch {
    return valor.toLowerCase();
  }
}

async function buscarFuenteDuplicada(userId, candidatas = []) {
  const objetivos = new Set(candidatas.map(normalizarUrlComparacion).filter(Boolean));
  if (objetivos.size === 0) return null;
  const [fuentes] = await db.query("SELECT id, titulo, url_feed FROM fuentes_rss WHERE usuario_id = ?", [userId]);
  return fuentes.find((fuente) => objetivos.has(normalizarUrlComparacion(fuente.url_feed))) || null;
}

function derivarNombreFuente(feed = {}, urlFinal = "") {
  let nombre = String(feed.title || "").replace(/\s+/g, " ").trim();
  nombre = nombre
    .replace(/\s*[|•·–—\/-]\s*(latest[^|•·–—\/-]*|últimas[^|•·–—\/-]*|ultimas[^|•·–—\/-]*)$/i, "")
    .replace(/\s*\b(latest articles|latest news|latest updates|rss feed|atom feed|feed)\s*$/i, "")
    .replace(/\s*[|•·–—\/-]\s*$/, "")
    .trim();

  if (nombre && nombre.length <= 40) return nombre;

  const sitio = feed.link || urlFinal || "";
  try {
    const etiqueta = new URL(sitio).hostname.replace(/^www\./i, "").split(".")[0];
    if (etiqueta) return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
  } catch {
    // Sin sitio válido: se usa el título recortado.
  }

  if (nombre) {
    const corte = nombre.slice(0, 37);
    const ultimoEspacio = corte.lastIndexOf(" ");
    return `${(ultimoEspacio > 10 ? corte.slice(0, ultimoEspacio) : corte).trim()}…`;
  }
  return "Fuente RSS";
}

const RSS_TIMEOUT_MS = 8000;
const HTML_TIMEOUT_MS = 12000;
const MAX_FEED_CANDIDATES = 80;

// Fetch con fallback de huella: si el sitio bloquea el perfil Chrome
// (401/403/429) o la red falla, reintenta una vez con el perfil alterno.
async function fetchConFallback(url, { timeoutMs = RSS_TIMEOUT_MS, validadores = {} } = {}) {
  const armar = (base) => {
    const headers = { ...base };
    if (validadores.etag) headers["If-None-Match"] = validadores.etag;
    if (validadores.lastModified) headers["If-Modified-Since"] = validadores.lastModified;
    return headers;
  };
  const pedir = async (base) => {
    // fetchPublico valida scheme + IP pública en cada salto de redirect
    // y devuelve la URL final validada junto a la respuesta.
    return fetchPublico(url, { headers: armar(base), timeoutMs });
  };
  let actual;
  try {
    actual = await pedir(HEADERS_BROWSER);
  } catch (err) {
    if (err.name === "AbortError") throw err;
    actual = await pedir(HEADERS_ALT);
  }
  if (!actual.res.ok && [401, 403, 429].includes(actual.res.status)) {
    await actual.res.arrayBuffer().catch(() => {});
    actual = await pedir(HEADERS_ALT);
  }
  return actual;
}

async function obtenerTextoDecodificado(url, timeoutMs = RSS_TIMEOUT_MS, validadores = {}) {
  try {
    const { res, urlFinal } = await fetchConFallback(url, { timeoutMs, validadores });

    if (res.status === 304) {
      return { sinCambios: true, urlFinal };
    }
    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

    const buffer = await leerBufferLimitado(res);
    const bytes = new Uint8Array(buffer);
    const utf8Text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const contentType = res.headers.get("content-type") || "";
    const declaration = utf8Text.slice(0, 500).match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    const usaLatin = /iso-8859-1|windows-1252|latin-1|cp1252/.test(`${contentType} ${declaration || ""}`);
    const tieneReemplazos = utf8Text.includes("�");
    const text = usaLatin || tieneReemplazos
      ? new TextDecoder("windows-1252").decode(bytes)
      : utf8Text;

    return {
      text: repararTextoMalDecodificado(text),
      urlFinal,
      contentType,
      etag: res.headers.get("etag"),
      lastModified: res.headers.get("last-modified"),
    };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("La solicitud excedió el tiempo límite de espera (timeout)");
    }
    throw err;
  }
}

async function intentarParsearFeed(url, validadores = {}) {
  try {
    const respuesta = await obtenerTextoDecodificado(url, RSS_TIMEOUT_MS, validadores);
    if (respuesta.sinCambios) {
      return { sinCambios: true, urlFinal: respuesta.urlFinal };
    }
    const contenido = respuesta.text.trim();
    let feed;

    if (contenido.startsWith("{")) {
      const json = JSON.parse(contenido);
      if (Array.isArray(json.items)) {
        feed = {
          title: json.title || "Fuente RSS",
          items: json.items.map((item) => ({
            title: item.title,
            link: item.url || item.external_url,
            content: item.content_html || item.content_text,
            summary: item.summary,
            isoDate: item.date_published || item.date_modified,
            guid: item.id,
          })),
        };
      }
    } else {
      feed = await parser.parseString(contenido);
    }

    if (feed && feed.items && feed.items.length > 0) {
      return { feed, urlFinal: respuesta.urlFinal, etag: respuesta.etag, lastModified: respuesta.lastModified };
    }
  } catch (e) {
    return null;
  }
  return null;
}

function agregarCandidato(candidatos, href, baseUrl, prioridad = 0) {
  if (!href || candidatos.length >= MAX_FEED_CANDIDATES) return;

  const valor = String(href)
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .trim();
  if (!valor || /^(javascript:|mailto:|tel:|#)/i.test(valor)) return;

  try {
    const url = new URL(valor, baseUrl);
    if (!/^https?:$/.test(url.protocol)) return;
    url.hash = "";
    const normalizada = url.href;
    if (!candidatos.some((candidato) => candidato.url === normalizada)) {
      candidatos.push({ url: normalizada, prioridad });
    }
  } catch (error) {
    // Los enlaces malformados de una página no deben cancelar el descubrimiento.
  }
}

function extraerCandidatosDesdeHtml(html, urlBase) {
  const candidatos = [];
  const $ = cheerio.load(html, { decodeEntities: true });
  const baseHref = $("base[href]").first().attr("href");
  let baseUrl = urlBase;

  try {
    baseUrl = baseHref ? new URL(baseHref, urlBase).href : urlBase;
  } catch (error) {}

  $("link[href]").each((_, element) => {
    const href = $(element).attr("href");
    const type = ($(element).attr("type") || "").toLowerCase();
    const rel = ($(element).attr("rel") || "").toLowerCase();
    const esFeed = /rss|atom|rdf|xml|json|feed/.test(`${type} ${rel}`);
    agregarCandidato(candidatos, href, baseUrl, esFeed ? 100 : 80);
  });

  $("meta[content]").each((_, element) => {
    const contenido = $(element).attr("content");
    const nombre = `${$(element).attr("name") || ""} ${$(element).attr("property") || ""}`;
    if (/rss|atom|feed|alternate/i.test(nombre)) {
      agregarCandidato(candidatos, contenido, baseUrl, 90);
    }
  });

  $("a[href], area[href]").each((_, element) => {
    const href = $(element).attr("href");
    const texto = `${$(element).text()} ${$(element).attr("aria-label") || ""}`;
    if (/rss|atom|feed|xml|suscrib|sindic/i.test(`${href} ${texto}`)) {
      agregarCandidato(candidatos, href, baseUrl, 70);
    }
  });

  // Algunos CMS publican el endpoint solamente dentro de JSON-LD o scripts.
  const posiblesUrls = html.match(/(?:https?:)?\/\/[^\s"'<>]+|(?:\/|\?)[^\s"'<>]*(?:rss|atom|feed|\.xml)[^\s"'<>]*/gi) || [];
  for (const posibleUrl of posiblesUrls) {
    if (/rss|atom|feed|\.xml/i.test(posibleUrl)) {
      agregarCandidato(candidatos, posibleUrl, baseUrl, 60);
    }
  }

  return candidatos;
}

function obtenerRutasFeed(urlLimpia) {
  const entrada = new URL(urlLimpia);
  const origen = entrada.origin;
  const rutas = new Set();
  const agregarRuta = (ruta) => rutas.add(new URL(ruta, origen).href);
  const path = entrada.pathname.replace(/\/+/g, "/").replace(/\/$/, "");
  const directorio = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "/";

  [
    "/feed/", "/feed", "/feed/rss2/", "/rss/", "/rss", "/rss/feed/", "/atom/", "/atom",
    "/feed.xml", "/feed.json", "/rss.xml", "/rss.json", "/atom.xml", "/index.xml",
    "/rss/index.xml", "/feeds/rss.xml", "/feeds/atom.xml", "/rss/feed.xml",
    "/?feed=rss2", "/?feed=atom", "/?feed=rss", "/?format=feed", "/?format=xml",
    "/?output=1", "/?output=rss", "/?output=atom",
  ].forEach(agregarRuta);

  if (directorio !== "/") {
    ["feed/", "feed", "feed/rss2/", "rss/", "rss", "atom.xml", "feed.xml", "feed.json", "index.xml"].forEach((ruta) => {
      agregarRuta(`${directorio}${ruta}`);
    });
  }

  if (path && path !== "/") {
    ["/feed/", "/feed", "/feed/rss2/", "/rss.xml", "/atom.xml", "/index.xml"].forEach((sufijo) => {
      agregarRuta(`${path}${sufijo}`);
    });
  }

  return [...rutas];
}

async function buscarPrimerFeed(candidatos) {
  const ordenados = [...candidatos]
    .sort((a, b) => b.prioridad - a.prioridad)
    .slice(0, MAX_FEED_CANDIDATES);
  let siguiente = 0;
  let encontrado = null;
  const worker = async () => {
    while (!encontrado) {
      const indice = siguiente++;
      if (indice >= ordenados.length) return;
      const resultado = await intentarParsearFeed(ordenados[indice].url);
      if (resultado) encontrado = resultado;
    }
  };

  await Promise.all(Array.from({ length: Math.min(6, ordenados.length) }, worker));
  return encontrado;
}

async function buscarFeedRSS(urlIngresada, { forzarWeb = false } = {}) {
  const urlLimpia = limpiarUrl(urlIngresada);
  if (!urlLimpia) throw new Error("La URL es obligatoria.");

  // Conversión forzada (checkbox "página completa"): se omite el
  // descubrimiento nativo y se crawlea la página con paginación. Útil
  // cuando el feed nativo existe pero recorta el histórico (p. ej.
  // WordPress sirve ~10 ítems aunque la sección tenga 17 páginas).
  if (forzarWeb) {
    const conversion = await convertirPaginaAFeed(urlLimpia);
    if (conversion?.sinCambios || !conversion?.feed) {
      throw new Error("No se pudo convertir la página a RSS.");
    }
    return {
      feed: conversion.feed,
      urlFinal: conversion.urlFinal,
      etag: conversion.etag,
      lastModified: conversion.lastModified,
      convertida: true,
      paginas: conversion.paginas || 1,
    };
  }

  const feedDirecto = await intentarParsearFeed(urlLimpia);
  if (feedDirecto) return feedDirecto;

  const candidatos = [];
  let urlPagina = urlLimpia;

  try {
    const { res, urlFinal } = await fetchConFallback(urlLimpia, { timeoutMs: HTML_TIMEOUT_MS });
    urlPagina = urlFinal || urlLimpia;

    const enlacesHeader = res.headers.get("link") || "";
    for (const coincidencia of enlacesHeader.matchAll(/<([^>]+)>\s*;[^,]*rel\s*=\s*["']?([^,;"']+)["']?[^,]*/gi)) {
      const relacion = coincidencia[2].toLowerCase();
      if (/alternate|feed|self/.test(relacion)) {
        agregarCandidato(candidatos, coincidencia[1], urlPagina, 95);
      }
    }

    if (res.ok && /html|xhtml|text\//i.test(res.headers.get("content-type") || "text/html")) {
      const html = await leerTextoLimitado(res);
      extraerCandidatosDesdeHtml(html, urlPagina).forEach((candidato) => candidatos.push(candidato));
    }
  } catch (err) {
    console.warn("Error leyendo la página para descubrir RSS:", err.message);
  }

  obtenerRutasFeed(urlPagina).forEach((url) => agregarCandidato(candidatos, url, urlPagina, 40));
  const feedDescubierto = await buscarPrimerFeed(candidatos);
  if (feedDescubierto) return feedDescubierto;

  // Sin feed nativo: último recurso estilo RSS.app — convertir la propia
  // página en feed (scraping con guarda SSRF). Lanza un error limpio para
  // el usuario si la página no es convertible.
  const conversion = await convertirPaginaAFeed(urlLimpia);
  if (conversion?.sinCambios || !conversion?.feed) {
    throw new Error("No se pudo detectar un feed RSS válido en esta URL.");
  }
  return {
    feed: conversion.feed,
    urlFinal: conversion.urlFinal,
    etag: conversion.etag,
    lastModified: conversion.lastModified,
    convertida: true,
    paginas: conversion.paginas || 1,
  };
}

// Cola de pendientes de IA: un lote por petición (el cliente itera). Vive
// fuera del POST para atenderse antes del preámbulo pesado de ensures y no
// agotar el maxDuration del serverless con cientos de filas pendientes.
async function clasificarPendientesResponse(userId, body = {}) {
  const limite = Math.min(Math.max(Number(body.lote) || 12, 1), 24);
  const [pendientes] = await db.query(
    `SELECT a.id, a.titulo, a.resumen
     FROM articulos_publicados a
     INNER JOIN fuentes_rss f ON a.fuente_id = f.id
     WHERE f.usuario_id = ? AND a.clasificacion_metodo = 'sin-ia' AND (a.descartado = 0 OR a.descartado IS NULL)
     ORDER BY a.fecha_publicacion DESC, a.id DESC
     LIMIT ?`,
    [userId, limite]
  );

  if (pendientes.length === 0) {
    return NextResponse.json({ clasificados: 0, restantes: 0 });
  }

  const apiKey = configIA().apiKey;
  if (!apiKey) {
    return NextResponse.json({ clasificados: 0, restantes: pendientes.length, diag: "sin_clave" });
  }

  const { resultados, esperaMs, fallo } = await clasificarLoteConIA(apiKey, pendientes);
  const filas = [];
  pendientes.forEach((pendiente, indice) => {
    const resultado = resultados[indice];
    if (resultado?.metodo === "gemini") {
      filas.push({ id: pendiente.id, categoria: resultado.categoria, metodo: resultado.metodo, confianza: resultado.confianza });
    }
  });

  let clasificados = 0;
  if (filas.length > 0) clasificados = await bulkUpdateCategoriasPorId(filas);

  const todosFallaron = resultados.every((resultado) => resultado?.metodo !== "gemini");
  const [[conteo]] = await db.query(
    `SELECT COUNT(*) AS restantes
     FROM articulos_publicados a
     INNER JOIN fuentes_rss f ON a.fuente_id = f.id
     WHERE f.usuario_id = ? AND a.clasificacion_metodo = 'sin-ia' AND (a.descartado = 0 OR a.descartado IS NULL)`,
    [userId]
  );
  // La espera de cuota la aplica el cliente entre lotes (ver reintentarEn):
  // dormir aquí quemaría el maxDuration del serverless.
  const reintentarEn = esperaMs > 0
    ? Math.min(Math.max(Math.ceil(esperaMs / 1000), 1), 120)
    : todosFallaron ? 30 : 0;
  // diag orienta al cliente cuando nada se clasificó ('sin_clave' | 'auth' |
  // 'cuota' | 'red' | 'respuesta'); null si hubo al menos un éxito.
  return NextResponse.json({
    clasificados,
    restantes: Number(conteo?.restantes) || 0,
    reintentarEn,
    diag: todosFallaron ? (fallo || "respuesta") : null,
  });
}

export async function POST(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    // Cola de IA primero: solo lee/actualiza articulos_publicados y no
    // necesita el preámbulo pesado (ensures + normalización con locks, que
    // con cientos de filas puede agotar el maxDuration del serverless y
    // matar la petición antes de clasificar nada).
    if (body.action === "clasificar_pendientes") {
      return clasificarPendientesResponse(userId, body);
    }

    await ensureClassificationSchema();
    await ensureVideoSchema();
    await ensureFuentesCacheSchema();
    await ensureFuentesOrigenSchema();
    await ensureFuentesFullPageSchema();
    try {
      await ensureFuentesPaginaOrigenSchema();
    } catch {
      // Sin columna: el alta sigue sin página origen (fallback a feed.link).
    }
    await ensureArticulosUnicidad(userId);

    const limiteFecha = new Date();
    limiteFecha.setDate(limiteFecha.getDate() - 7);
    limiteFecha.setHours(0, 0, 0, 0);

    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    if (body.action === "refresh_source") {
      const { source_id, url } = body;
      if (!source_id || !url) {
        return NextResponse.json({ error: "Faltan datos de la fuente" }, { status: 400 });
      }

      try {
        // Ownership: la fuente debe pertenecer al llamante antes de
        // leer, persistir, restaurar o purgar bajo su id.
        // Se leen también el flag convert_full_page y la página origen
        // (tolerante a BDs sin las columnas) para decidir entre extracción
        // estándar y crawler completo.
        let propias;
        try {
          [propias] = await db.query(
            "SELECT id, etag, last_modified, convert_full_page, pagina_origen FROM fuentes_rss WHERE id = ? AND usuario_id = ?",
            [source_id, userId]
          );
        } catch (error) {
          if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
          try {
            [propias] = await db.query(
              "SELECT id, etag, last_modified, convert_full_page FROM fuentes_rss WHERE id = ? AND usuario_id = ?",
              [source_id, userId]
            );
          } catch (error2) {
            if (error2?.code !== "ER_BAD_FIELD_ERROR") throw error2;
            [propias] = await db.query(
              "SELECT id, etag, last_modified FROM fuentes_rss WHERE id = ? AND usuario_id = ?",
              [source_id, userId]
            );
          }
        }
        if (!propias[0]) {
          return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
        }
        const resultado = await obtenerFeedFuente({
          id: source_id,
          url_feed: url,
          etag: propias[0]?.etag,
          last_modified: propias[0]?.last_modified,
          convert_full_page: propias[0]?.convert_full_page,
          pagina_origen: propias[0]?.pagina_origen,
        });
        if (resultado?.sinCambios) {
          await actualizarValidadoresFuente(source_id, null, null);
          return NextResponse.json({ message: "La fuente no tiene cambios nuevos", sinCambios: true, pendientes: 0, restaurados: 0, purgados: 0 });
        }
        const feed = resultado?.feed;
        let pendientes = 0;
        if (feed?.items && feed.items.length > 0) {
          const existentes = await obtenerClasificacionesExistentes([source_id]);
          const clasificaciones = await prepararClasificaciones(source_id, feed.items, existentes, { omitirIA: true });
          await persistirArticulos(source_id, feed.items, clasificaciones, limiteFecha);
          pendientes = extraerPendientes(clasificaciones).length;
          await actualizarValidadoresFuente(source_id, resultado?.etag, resultado?.lastModified);
        }
        const [restauradosFuente] = await db.query(
          `UPDATE articulos_publicados
           SET descartado = 0
           WHERE fuente_id = ? AND descartado = 1 AND fecha_publicacion >= ?`,
          [source_id, inicioHoy]
        );
        const purgados = await purgarArticulosAntiguos({ fuenteId: source_id });
        const usoFullPage = Number(propias[0]?.convert_full_page) === 1;
        return NextResponse.json({
          message: usoFullPage
            ? `Fuente actualizada con página completa (${resultado?.paginas || 1} páginas recorridas)`
            : "Fuente individual actualizada correctamente",
          restaurados: restauradosFuente.affectedRows || 0,
          pendientes,
          purgados,
          convertFullPage: usoFullPage,
          paginas: resultado?.paginas || 1,
        });
      } catch (e) {
        console.error(`[RSS REFRESH SOURCE ERROR] Fuente ID ${source_id}:`, e.message);
        return NextResponse.json({ error: e.message || "No se pudo actualizar la fuente seleccionada" }, { status: 500 });
      }
    }
    
    if (body.action === "refresh") {
      const resumen = await refrescarFuentesDeUsuario(userId, {
        restoreToday: Boolean(body.restore_today),
      });
      if (resumen.vacia) {
        return NextResponse.json({ message: "No hay fuentes registradas para actualizar", nuevos: 0 });
      }
      // Push no bloqueante: avisa solo si hubo noticias realmente nuevas.
      if (resumen.nuevos > 0) {
        after(() =>
          sendPushToUser(userId, {
            title: "RSS Dashboard",
            body:
              resumen.nuevos === 1
                ? "Tienes 1 noticia nueva en tus fuentes."
                : `Tienes ${resumen.nuevos} noticias nuevas en tus fuentes.`,
            url: "/",
          }).catch((err) => console.error("Error al enviar push:", err.message))
        );
      }
      return NextResponse.json({
        message: "Feeds actualizados y restaurados correctamente",
        nuevos: resumen.nuevos,
        restaurados: resumen.restaurados,
        pendientes: resumen.pendientes,
        omitidas: resumen.omitidas,
        purgados: resumen.purgados,
      });
    }

    const { url_feed } = body;
    if (!url_feed) {
      return NextResponse.json({ error: "La URL es obligatoria" }, { status: 400 });
    }

    const duplicadaEntrada = await buscarFuenteDuplicada(userId, [url_feed]);
    if (duplicadaEntrada) {
      return NextResponse.json(
        { error: `Esta fuente RSS ya está registrada en tu cuenta como "${duplicadaEntrada.titulo}".` },
        { status: 409 }
      );
    }

    const { feed, urlFinal, etag, lastModified, convertida, paginas } = await buscarFeedRSS(url_feed, {
      forzarWeb: body.forzar_conversion === true,
    });

    if (!feed.items || feed.items.length === 0) {
      throw new Error("La URL es válida, pero no contiene artículos RSS disponibles.");
    }

    const duplicadaFinal = await buscarFuenteDuplicada(userId, [urlFinal, url_feed]);
    if (duplicadaFinal) {
      return NextResponse.json(
        { error: `Esta fuente RSS ya está registrada en tu cuenta como "${duplicadaFinal.titulo}".` },
        { status: 409 }
      );
    }

    let resFuente;
    // pagina_origen: conserva la URL que pegó el usuario para poder crawlear
    // la página HTML aunque url_feed termine siendo el XML descubierto.
    const paginaOrigenAlta = typeof url_feed === "string" ? url_feed.trim().slice(0, 1000) : null;
    try {
      [resFuente] = await db.query(
        "INSERT INTO fuentes_rss (usuario_id, titulo, url_feed, categoria, etag, last_modified, ultima_revision, origen, convert_full_page, pagina_origen) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)",
        [userId, derivarNombreFuente(feed, urlFinal), urlFinal, body.categoria?.trim() || "General", etag || null, lastModified || null, convertida ? "web" : "rss", body.forzar_conversion === true ? 1 : 0, paginaOrigenAlta]
      );
    } catch (error) {
      // BD sin migrar: reintenta sin pagina_origen y/o sin el flag.
      if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
      try {
        [resFuente] = await db.query(
          "INSERT INTO fuentes_rss (usuario_id, titulo, url_feed, categoria, etag, last_modified, ultima_revision, origen, convert_full_page) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)",
          [userId, derivarNombreFuente(feed, urlFinal), urlFinal, body.categoria?.trim() || "General", etag || null, lastModified || null, convertida ? "web" : "rss", body.forzar_conversion === true ? 1 : 0]
        );
      } catch (error2) {
        if (error2?.code !== "ER_BAD_FIELD_ERROR") throw error2;
        [resFuente] = await db.query(
          "INSERT INTO fuentes_rss (usuario_id, titulo, url_feed, categoria, etag, last_modified, ultima_revision, origen) VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)",
          [userId, derivarNombreFuente(feed, urlFinal), urlFinal, body.categoria?.trim() || "General", etag || null, lastModified || null, convertida ? "web" : "rss"]
        );
      }
    }

    const fuenteId = resFuente.insertId;

    const clasificaciones = await prepararClasificaciones(fuenteId, feed.items, new Map(), { omitirIA: true });
    const { insertados } = await persistirArticulos(fuenteId, feed.items, clasificaciones, limiteFecha, { soloInsertar: true });
    const totalNuevas = insertados;

    if (totalNuevas === 0) {
      await db.query("DELETE FROM fuentes_rss WHERE id = ? AND usuario_id = ?", [fuenteId, userId]);
      throw new Error("El feed no contiene artículos con enlaces válidos para mostrar.");
    }

    const pendientes = extraerPendientes(clasificaciones).length;

    if (convertida) {
      return NextResponse.json(
        {
          message: "Página convertida a RSS y agregada con éxito",
          nuevos: totalNuevas,
          pendientes,
          convertida: true,
          paginas: paginas || 1,
        },
        { status: 201 }
      );
    }
    return NextResponse.json({ message: "Fuente agregada con éxito", nuevos: totalNuevas, pendientes }, { status: 201 });
  } catch (error) {
    console.error("Error crítico en POST /api/rss:", error);
    return NextResponse.json(
      { error: error.message || "No se pudo procesar la solicitud del feed RSS." },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    await ensureClassificationSchema();
    await ensureVideoSchema();
    await ensureArticulosUnicidad(userId);
    try {
      await ensureFuentesFullPageSchema();
    } catch {
      // Sin columna: el listado sale sin flag (todo 0).
    }
    try {
      await ensureFuentesPaginaOrigenSchema();
    } catch {
      // Sin columna: el listado sale sin página origen.
    }
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo");

    if (tipo === "fuentes") {
      let fuentes;
      try {
        [fuentes] = await db.query(
          "SELECT id, titulo, url_feed, categoria, convert_full_page, pagina_origen FROM fuentes_rss WHERE usuario_id = ? ORDER BY id DESC",
          [userId]
        );
      } catch (error) {
        if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
        try {
          [fuentes] = await db.query(
            "SELECT id, titulo, url_feed, categoria, convert_full_page FROM fuentes_rss WHERE usuario_id = ? ORDER BY id DESC",
            [userId]
          );
        } catch (error2) {
          if (error2?.code !== "ER_BAD_FIELD_ERROR") throw error2;
          [fuentes] = await db.query(
            "SELECT id, titulo, url_feed, categoria FROM fuentes_rss WHERE usuario_id = ? ORDER BY id DESC",
            [userId]
          );
        }
      }
      return NextResponse.json(
        (fuentes || []).map((f) => ({
          ...f,
          convertFullPage: Number(f.convert_full_page) === 1,
        }))
      );
    }

    if (tipo === "categorias") {
      return NextResponse.json(CATEGORIAS_DISPONIBLES);
    }

    if (tipo === "imagen") {
      const cruda = (searchParams.get("url") || "").trim();
      let verificada = "";
      try {
        const urlObj = new URL(cruda);
        if (!/^https?:$/.test(urlObj.protocol)) throw new Error("Protocolo no válido");
        verificada = urlObj.href;
      } catch {
        return NextResponse.json({ imagen: null });
      }
      const idArticulo = Number(searchParams.get("id") || "0") || null;
      if (imagenPaginaCache.has(verificada)) {
        const cacheada = imagenPaginaCache.get(verificada) || {};
        // Refuerzo: si ya se conocen los medios, guardarlos en el artículo
        // para no re-extraerlos en futuras aperturas.
        if ((cacheada.imagen || cacheada.video) && idArticulo) {
          await persistirMediaArticulo(idArticulo, userId, cacheada).catch(() => {});
        }
        return NextResponse.json({ imagen: cacheada.imagen || null, video: cacheada.video || null });
      }
      const encontrada = await extraerImagenDirecta(verificada);
      // Orden de medios: imagen directa → video/poster embebido.
      // Sin screenshot: si no hay medio legítimo se devuelve nulo
      // controlado y el lector renderiza solo texto.
      const tMedia = Date.now();
      let medios;
      let etapa = "directa";
      if (encontrada) {
        medios = { imagen: encontrada, video: null };
      } else {
        const embebido = await extraerVideoDePagina(verificada);
        if (embebido.video || embebido.poster) {
          etapa = embebido.video ? "video" : "poster";
          medios = { imagen: embebido.poster || null, video: embebido.video || null };
        } else {
          etapa = "nada";
          medios = { imagen: null, video: null };
        }
      }
      // Trazabilidad: qué etapa ganó, para qué host y en cuánto tiempo.
      try {
        console.log(`[media:decision] host=${new URL(verificada).hostname} etapa=${etapa} ms=${Date.now() - tMedia}`);
      } catch {
        // El log nunca bloquea la respuesta.
      }
      imagenPaginaCache.set(verificada, medios);
      if (imagenPaginaCache.size > 500) {
        imagenPaginaCache.delete(imagenPaginaCache.keys().next().value);
      }
      if ((medios.imagen || medios.video) && idArticulo) {
        await persistirMediaArticulo(idArticulo, userId, medios).catch(() => {});
      }
      return NextResponse.json(medios);
    }

    // Conteos globales para las tarjetas (pendientes / leídas / guardadas).
    if (tipo === "conteos") {
      const [[c]] = await db.query(
        `SELECT
           SUM(a.leido = 0 AND (a.guardado = 0 OR a.guardado IS NULL)) AS pendientes,
           SUM(a.leido = 1) AS leidas,
           SUM(a.guardado = 1) AS guardadas
         FROM articulos_publicados a
         INNER JOIN fuentes_rss f ON a.fuente_id = f.id
         WHERE f.usuario_id = ? AND (a.descartado = 0 OR a.descartado IS NULL)`,
        [userId]
      );
      return NextResponse.json({
        pendientes: Number(c?.pendientes) || 0,
        leidas: Number(c?.leidas) || 0,
        guardadas: Number(c?.guardadas) || 0,
      });
    }

    // Facetas de categorías: respeta pestaña/búsqueda/fuentes, ignora las
    // categorías elegidas (comportamiento estándar de facetas).
    if (tipo === "facetas") {
      const { where, params } = construirFiltros(searchParams, userId, { ignorarCategorias: true });
      const [filas] = await db.query(
        `SELECT a.categoria AS categoria, COUNT(*) AS total
         FROM articulos_publicados a
         INNER JOIN fuentes_rss f ON a.fuente_id = f.id
         ${where}
         GROUP BY a.categoria
         ORDER BY a.categoria ASC`,
        params
      );
      return NextResponse.json(
        filas.map((fila) => ({
          categoria: repararTextoMalDecodificado(fila.categoria),
          total: Number(fila.total) || 0,
        }))
      );
    }

    // Feed paginado con filtros en servidor:
    // ?page=2&limit=30&tab=todas&q=&categorias=A,B&fuentes=1,2&orden=recientes&ia=todas
    // Sin ?limit ni ?page se mantiene respuesta legacy (arreglo) por compatibilidad.
    const limiteParam = searchParams.get("limit");
    const paginaParam = searchParams.get("page");
    const usaPaginacion = limiteParam !== null || paginaParam !== null;
    const limite = Math.min(Math.max(Number(limiteParam) || 30, 1), 100);
    const pagina = Math.max(Number(paginaParam) || 1, 1);
    const desplazamiento = searchParams.get("offset") !== null
      ? Math.max(Number(searchParams.get("offset")) || 0, 0)
      : (pagina - 1) * limite;

    if (!usaPaginacion) {
      const [rowsLegacy] = await db.query(
        `SELECT
          a.id,
          a.titulo,
          a.resumen,
          a.url_original,
          a.fecha_publicacion,
          a.leido,
          a.guardado,
          a.categoria,
          a.clasificacion_metodo,
          a.clasificacion_confianza,
          a.imagen_url,
          a.video_url,
          a.fuente_id,
          f.titulo AS fuente_nombre,
          f.url_feed AS fuente_url
         FROM articulos_publicados a
          INNER JOIN fuentes_rss f ON a.fuente_id = f.id
          WHERE f.usuario_id = ? AND (a.descartado = 0 OR a.descartado IS NULL)
          ORDER BY a.fecha_publicacion DESC, a.id DESC
          LIMIT 1000000 OFFSET 0`,
        [userId]
      );
      return NextResponse.json(rowsLegacy.map(repararFilaArticulo));
    }

    const { where, params, orderBy } = construirFiltros(searchParams, userId, {});
    const [[conteo]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       ${where}`,
      params
    );
    const total = Number(conteo?.total) || 0;
    const [rows] = await db.query(
      `SELECT
        a.id,
        a.titulo,
        a.resumen,
        a.url_original,
        a.fecha_publicacion,
        a.leido,
        a.guardado,
        a.categoria,
        a.clasificacion_metodo,
        a.clasificacion_confianza,
        a.imagen_url,
        a.video_url,
        a.fuente_id,
        f.titulo AS fuente_nombre,
        f.url_feed AS fuente_url
       FROM articulos_publicados a
        INNER JOIN fuentes_rss f ON a.fuente_id = f.id
        ${where}
        ${orderBy}
        LIMIT ? OFFSET ?`,
      [...params, limite, desplazamiento]
    );
    const articulos = rows.map(repararFilaArticulo);
    const totalPaginas = Math.max(Math.ceil(total / limite), 1);
    return NextResponse.json({
      articles: articulos,
      total,
      page: Math.min(pagina, totalPaginas),
      limit: limite,
      totalPages: totalPaginas,
      hasMore: desplazamiento + articulos.length < total,
    });
  } catch (error) {
    console.error("Error al obtener datos:", error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const body = await req.json();
    const { id, leido, guardado, titulo, categoria, tipo } = body;

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    if (tipo === "fuente") {
      const [result] = await db.query(
        "UPDATE fuentes_rss SET titulo = COALESCE(?, titulo), categoria = COALESCE(?, categoria) WHERE id = ? AND usuario_id = ?",
        [titulo, categoria, id, userId]
      );
      if (result.affectedRows === 0) {
        return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
      }
      return NextResponse.json({ message: "Fuente actualizada correctamente" });
    }

    // Ownership: el artículo debe pertenecer a una fuente del usuario.
    const [[propio]] = await db.query(
      `SELECT a.id FROM articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       WHERE a.id = ? AND f.usuario_id = ?`,
      [id, userId]
    );
    if (!propio) {
      return NextResponse.json({ error: "Artículo no encontrado o no autorizado" }, { status: 404 });
    }

    if (leido !== undefined) {
      await db.query("UPDATE articulos_publicados SET leido = ? WHERE id = ?", [leido ? 1 : 0, id]);
    }
    if (guardado !== undefined) {
      await db.query("UPDATE articulos_publicados SET guardado = ? WHERE id = ?", [guardado ? 1 : 0, id]);
    }
    if (categoria !== undefined) {
      const categoriaValida = CATEGORIAS_DISPONIBLES.find(
        (nombre) => normalizarCategoria(nombre) === normalizarCategoria(String(categoria))
      );
      if (!categoriaValida) {
        return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
      }
      await db.query(
        "UPDATE articulos_publicados SET categoria = ?, clasificacion_metodo = 'manual', clasificacion_confianza = 1 WHERE id = ?",
        [categoriaValida, id]
      );
      return NextResponse.json({ message: "Categoría actualizada", categoria: categoriaValida });
    }

    return NextResponse.json({ message: "Artículo actualizado" });
  } catch (error) {
    console.error("Error al actualizar:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req) {
  let connection;
  try {
    const session = await auth();
    const userId = Number(await resolverUsuarioId(req, session));
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const tipo = searchParams.get("tipo");
    const deleteAll = searchParams.get("delete_all");

    if (deleteAll === "true") {
      // Alcance por pestaña (lista blanca): el borrado masivo solo descarta
      // las noticias de la sección activa, nunca toda la cuenta. Sin ?tab se
      // asume la pestaña de pendientes ("todas").
      const alcanceTab = searchParams.get("tab") || "todas";
      if (!["todas", "leidas", "guardadas"].includes(alcanceTab)) {
        return NextResponse.json({ error: "Pestaña no válida" }, { status: 400 });
      }
      const alcanceTabCondicion =
        alcanceTab === "guardadas"
          ? "AND a.guardado = 1"
          : alcanceTab === "leidas"
            ? "AND a.leido = 1"
            : "AND a.leido = 0 AND (a.guardado = 0 OR a.guardado IS NULL)";
      connection = await db.getConnection();
      await connection.beginTransaction();
      await connection.query(
        `UPDATE articulos_publicados a
         INNER JOIN fuentes_rss f ON a.fuente_id = f.id
         SET a.descartado = 1
         WHERE f.usuario_id = ? ${alcanceTabCondicion}`,
        [userId]
      );
      await connection.commit();
      return NextResponse.json({ message: "Todas las publicaciones fueron descartadas", tab: alcanceTab });
    }

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    if (tipo === "fuente") {
      connection = await db.getConnection();
      await connection.beginTransaction();
      await connection.query(
        `DELETE a FROM articulos_publicados a
         INNER JOIN fuentes_rss f ON a.fuente_id = f.id
         WHERE a.fuente_id = ? AND f.usuario_id = ?`,
        [id, userId]
      );
      const [result] = await connection.query(
        "DELETE FROM fuentes_rss WHERE id = ? AND usuario_id = ?",
        [id, userId]
      );
      if (result.affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
      }
      await connection.commit();
      return NextResponse.json({ message: "Fuente y sus artículos eliminados por completo" });
    }

    const [result] = await db.query(
      `UPDATE articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       SET a.descartado = 1
       WHERE a.id = ? AND f.usuario_id = ?`,
      [id, userId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Artículo no encontrado o no autorizado" }, { status: 404 });
    }
    return NextResponse.json({ message: "Artículo descartado" });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error("Error al eliminar:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}

function repararTextoMalDecodificado(texto = "") {
  if (!/[ÃÂâ€™�]/.test(texto)) return texto;

  try {
    const bytes = Uint8Array.from([...texto].map((caracter) => caracter.charCodeAt(0)));
    const reparado = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return reparado.includes("�") ? texto : reparado;
  } catch (error) {
    return texto;
  }
}

function normalizarCategoria(valor = "") {
  return valor
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function repararFilaArticulo(row) {
  return {
    ...row,
    titulo: repararTextoMalDecodificado(row.titulo),
    resumen: repararTextoMalDecodificado(row.resumen),
    fuente_nombre: repararTextoMalDecodificado(row.fuente_nombre),
  };
}

// Escapa comodines de LIKE para que la búsqueda sea literal.
function escaparLike(valor = "") {
  return valor.replace(/[\\%_]/g, (m) => `\\${m}`);
}

// Construye WHERE/params/ORDER para el feed con filtros de pestaña,
// búsqueda, categorías, fuentes, estado IA y orden. Todo parametrizado;
// el orden y el estado IA van por lista blanca para no interpolar input
// crudo en SQL.
function construirFiltros(searchParams, userId, { ignorarCategorias = false } = {}) {
  const condiciones = ["f.usuario_id = ?", "(a.descartado = 0 OR a.descartado IS NULL)"];
  const params = [userId];

  const tab = searchParams.get("tab") || "todas";
  if (tab === "guardadas") {
    condiciones.push("a.guardado = 1");
  } else if (tab === "leidas") {
    condiciones.push("a.leido = 1");
  } else {
    condiciones.push("a.leido = 0 AND (a.guardado = 0 OR a.guardado IS NULL)");
  }

  const q = (searchParams.get("q") || "").trim();
  if (q) {
    const patron = `%${escaparLike(q)}%`;
    condiciones.push("(a.titulo LIKE ? OR a.resumen LIKE ?)");
    params.push(patron, patron);
  }

  const fuentes = (searchParams.get("fuentes") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fuentes.length > 0) {
    condiciones.push(`a.fuente_id IN (${fuentes.map(() => "?").join(",")})`);
    params.push(...fuentes);
  }

  if (!ignorarCategorias) {
    const categorias = (searchParams.get("categorias") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (categorias.length > 0) {
      condiciones.push(`a.categoria IN (${categorias.map(() => "?").join(",")})`);
      params.push(...categorias);
    }
  }

  // Estado de categorización por IA (lista blanca): 'con_ia' solo Gemini,
  // 'sin_ia' solo pendientes de IA. 'manual' (corregida por el usuario) solo
  // aparece en 'todas': no fue procesada por IA ni está pendiente de ella.
  const estadoIA = searchParams.get("ia") || "todas";
  if (estadoIA === "con_ia") {
    condiciones.push("a.clasificacion_metodo = 'gemini'");
  } else if (estadoIA === "sin_ia") {
    condiciones.push("a.clasificacion_metodo = 'sin-ia'");
  }

  const orden = searchParams.get("orden") || "recientes";
  const orderBy =
    orden === "az"
      ? "ORDER BY a.titulo ASC, a.id ASC"
      : orden === "za"
        ? "ORDER BY a.titulo DESC, a.id DESC"
        : orden === "antiguas"
          ? "ORDER BY a.fecha_publicacion ASC, a.id ASC"
          : "ORDER BY a.fecha_publicacion DESC, a.id DESC";

  return { where: `WHERE ${condiciones.join(" AND ")}`, params, orderBy };
}

const SIN_CLASIFICACION = { categoria: "General", metodo: "sin-ia", confianza: 0.1 };

// Modelos probados en orden: el lite primero por ser el más rápido, luego el alterno.
const MODELOS_GEMINI = ["gemini-3.5-flash-lite", "gemini-2.5-flash"];
// Groq (contrato OpenAI-compatible): alto throughput en tier gratuito, ideal
// para clasificación por lotes. Modelos sobreescribibles con IA_MODELOS.
const MODELOS_GROQ = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

// Proveedor de IA para clasificación (variables de entorno):
// IA_PROVEEDOR=groq usa GROQ_API_KEY; cualquier otro valor (o ausente) usa
// Gemini con GEMINI_API_KEY. IA_API_KEY genérica tiene prioridad sobre ambas
// e IA_MODELOS ("a,b,c") sustituye la lista por defecto del proveedor.
function configIA() {
  const proveedor = String(process.env.IA_PROVEEDOR || "gemini").trim().toLowerCase();
  const modelosPropios = String(process.env.IA_MODELOS || "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  if (proveedor === "groq") {
    return {
      proveedor: "groq",
      etiqueta: "Groq",
      apiKey: process.env.IA_API_KEY || process.env.GROQ_API_KEY || "",
      modelos: modelosPropios.length > 0 ? modelosPropios : MODELOS_GROQ,
      baseUrl: "https://api.groq.com/openai/v1",
    };
  }
  return {
    proveedor: "gemini",
    etiqueta: "Gemini",
    apiKey: process.env.IA_API_KEY || process.env.GEMINI_API_KEY || "",
    modelos: modelosPropios.length > 0 ? modelosPropios : MODELOS_GEMINI,
    baseUrl: null,
  };
}
const GEMINI_LOTE_TAMANO = 12;
const GEMINI_LOTE_MAX_TOKENS = 1200;
// Tope por llamada a Gemini: con el fail-fast ante 429, el peor caso por
// petición ronda 2 llamadas y debe caber holgado en el maxDuration (60 s)
// del serverless. La espera de cuota la hace el cliente entre lotes.
const GEMINI_LOTE_TIMEOUT_MS = 20000;

function construirInstruccionLote(noticias = []) {
  const listado = noticias
    .map((noticia, indice) => `[${indice}] Título: ${(noticia.titulo || "").slice(0, 300)}\n[${indice}] Resumen: ${(noticia.resumen || "").slice(0, 250)}`)
    .join("\n");
  return `Eres un clasificador de noticias. Clasifica CADA una de las siguientes noticias eligiendo la ÚNICA categoría del catálogo que mejor la describa.

Catálogo de categorías:
${CATALOGO_PROMPT}

Reglas:
- Responde únicamente un arreglo JSON válido con esta forma exacta: [{"i":0,"categoria":"<nombre exacto de una categoría del catálogo>","confianza":0.9}]
- Incluye un objeto por cada noticia, con su índice "i".
- "confianza" es un número entre 0 y 1 que indica qué tan seguro estás.
- No inventes ni combines categorías; usa exactamente un nombre del catálogo.

Noticias:
${listado}`;
}

function extraerArregloPropuesta(texto = "") {
  const limpio = texto.replace(/^```json\s*|\s*```$/g, "").trim();
  const validar = (fragmento) => {
    const arreglo = JSON.parse(fragmento);
    if (!Array.isArray(arreglo)) throw new Error("La IA no devolvió un arreglo JSON válido");
    return arreglo;
  };
  try {
    return validar(limpio);
  } catch {
    const coincidencia = limpio.match(/\[[\s\S]*\]/);
    if (coincidencia) return validar(coincidencia[0]);
    throw new Error("La IA no devolvió un arreglo JSON válido");
  }
}

function extraerEsperaReintento(texto = "") {
  const coincidencia = texto.match(/retry in ([\d.]+)s/i);
  const segundos = coincidencia ? Number(coincidencia[1]) : NaN;
  if (!Number.isFinite(segundos)) return 12000;
  return Math.min(Math.max(segundos * 1000, 1000), 60000);
}

// Concurrencia acotada estilo p-limit sin dependencias: N workers consumen la cola.
async function mapWithConcurrency(items = [], limite = 4, fn) {
  const cola = [...items];
  const workers = Array.from({ length: Math.min(limite, cola.length) }, async () => {
    while (cola.length > 0) {
      const item = cola.shift();
      await fn(item);
    }
  });
  await Promise.all(workers);
}

// Refresca todas las fuentes de un usuario (ETag/304, solo-nuevas, purga).
// Exportada para reutilizarla desde el cron (/api/cron/refresh) sin duplicar lógica.
export async function refrescarFuentesDeUsuario(userId, { restoreToday = false } = {}) {
  const limiteFecha = new Date();
  limiteFecha.setDate(limiteFecha.getDate() - 7);
  limiteFecha.setHours(0, 0, 0, 0);
  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  let fuentes;
  try {
    [fuentes] = await db.query(
      "SELECT id, url_feed, titulo, etag, last_modified, pagina_origen FROM fuentes_rss WHERE usuario_id = ?",
      [userId]
    );
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
    [fuentes] = await db.query(
      "SELECT id, url_feed, titulo, etag, last_modified FROM fuentes_rss WHERE usuario_id = ?",
      [userId]
    );
  }
  if (!fuentes || fuentes.length === 0) {
    return { vacia: true, nuevos: 0, pendientes: 0, omitidas: 0, restaurados: 0, purgados: 0 };
  }

  // Origen + flag full-page por fuente (tolerante a BDs sin las columnas):
  // las 'web' se refrescan re-scrapeando la página convertida, y cualquier
  // fuente con convert_full_page=1 usa el crawler multipágina completo
  // sobre pagina_origen (o el link del sitio si no hay origen guardado).
  // El ensure nunca rompe el refresco/cron: si falla, todo se trata como rss.
  let mapaOrigen = new Map();
  let mapaFullPage = new Map();
  try {
    await ensureFuentesOrigenSchema();
    mapaOrigen = await mapaOrigenFuentes(fuentes.map((fuente) => fuente.id));
  } catch {
    // Sin columna de origen: refresco nativo para todas.
  }
  try {
    await ensureFuentesFullPageSchema();
    mapaFullPage = await mapaFullPageFuentes(fuentes.map((fuente) => fuente.id));
  } catch {
    // Sin columna full-page: extracción estándar para todas.
  }

  let nuevos = 0;
  let pendientes = 0;
  let omitidas = 0;
  const existentes = await obtenerClasificacionesExistentes(fuentes.map((fuente) => fuente.id));
  await mapWithConcurrency(fuentes, 4, async (fuente) => {
    try {
      const resultado = await obtenerFeedFuente(
        {
          ...fuente,
          origen: mapaOrigen.get(fuente.id) || "rss",
          convert_full_page: mapaFullPage.get(fuente.id) ? 1 : 0,
        },
        { omitirOrigenDb: true }
      );
      if (resultado?.sinCambios) {
        await actualizarValidadoresFuente(fuente.id, null, null);
        omitidas++;
        return;
      }
      const feed = resultado?.feed;
      if (feed?.items && feed.items.length > 0) {
        const clasificaciones = await prepararClasificaciones(fuente.id, feed.items, existentes, { omitirIA: true });
        const { insertados } = await persistirArticulos(fuente.id, feed.items, clasificaciones, limiteFecha);
        nuevos += insertados;
        pendientes += extraerPendientes(clasificaciones).length;
        await actualizarValidadoresFuente(fuente.id, resultado?.etag, resultado?.lastModified);
      }
    } catch (e) {
      console.error(`[RSS REFRESH ERROR] Fuente ID ${fuente.id}:`, e.message);
    }
  });

  let restaurados = 0;
  if (restoreToday) {
    const [rows] = await db.query(
      `UPDATE articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       SET a.descartado = 0
       WHERE f.usuario_id = ? AND a.descartado = 1 AND a.fecha_publicacion >= ?`,
      [userId, inicioHoy]
    );
    restaurados = rows.affectedRows || 0;
  }
  const purgados = await purgarArticulosAntiguos({ userId });
  return { vacia: false, nuevos, pendientes, omitidas, restaurados, purgados };
}

async function llamarModeloGemini(apiKey, modelo, textoPrompt, maxTokens, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          generationConfig: { temperature: 0, maxOutputTokens: maxTokens },
          contents: [{
            parts: [{
              text: textoPrompt,
            }],
          }],
        }),
      }
    );

    if ([400, 401, 403].includes(response.status)) {
      throw new Error(`Gemini rechazó la solicitud (HTTP ${response.status}); se aborta la cadena de modelos`, { cause: { fatal: true, codigo: "auth" } });
    }
    if (response.status === 429) {
      const cuerpo = await response.text().catch(() => "");
      throw new Error(`Gemini sin cuota en ${modelo} (HTTP 429)`, { cause: { esperaMs: extraerEsperaReintento(cuerpo), codigo: "cuota" } });
    }
    if (!response.ok) throw new Error(`Gemini respondió HTTP ${response.status} con ${modelo}`);
    const data = await response.json();
    const textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!textoRespuesta) throw new Error(`Gemini no devolvió contenido con ${modelo}`);
    return textoRespuesta;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Llamada OpenAI-compatible (/chat/completions): Groq y cualquier nube con
// el mismo contrato. 401/403 = clave rechazada (fatal); 429 = cuota con
// Retry-After; otros 4xx (p. ej. modelo retirado) prueban el siguiente.
async function llamarModeloChat(cfg, apiKey, modelo, textoPrompt, maxTokens, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: modelo,
        messages: [{ role: "user", content: textoPrompt }],
        temperature: 0,
        max_tokens: maxTokens,
      }),
    });
    if ([401, 403].includes(response.status)) {
      throw new Error(`${cfg.etiqueta} rechazó la clave (HTTP ${response.status}); se aborta la cadena de modelos`, { cause: { fatal: true, codigo: "auth" } });
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const cuerpo = await response.text().catch(() => "");
      const esperaMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(Math.max(retryAfter * 1000, 1000), 120000)
        : extraerEsperaReintento(cuerpo);
      throw new Error(`${cfg.etiqueta} sin cuota en ${modelo} (HTTP 429)`, { cause: { esperaMs, codigo: "cuota" } });
    }
    if (!response.ok) throw new Error(`${cfg.etiqueta} respondió HTTP ${response.status} con ${modelo}`);
    const data = await response.json().catch(() => null);
    const textoRespuesta = data?.choices?.[0]?.message?.content?.trim();
    if (!textoRespuesta) throw new Error(`${cfg.etiqueta} no devolvió contenido con ${modelo}`);
    return textoRespuesta;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function ejecutarCadenaIA(apiKey, textoPrompt, maxTokens, timeoutMs) {
  const cfg = configIA();
  const clave = cfg.apiKey || apiKey;
  let ultimoError = new Error(`${cfg.etiqueta} no respondió correctamente`);
  for (const modelo of cfg.modelos) {
    try {
      if (cfg.proveedor === "groq") {
        return await llamarModeloChat(cfg, clave, modelo, textoPrompt, maxTokens, timeoutMs);
      }
      return await llamarModeloGemini(clave, modelo, textoPrompt, maxTokens, timeoutMs);
    } catch (error) {
      ultimoError = error;
      if (error?.cause?.fatal) break;
      // Sin espera ni reintento dentro de la petición: la cuota es por
      // proyecto (no por modelo) y dormir aquí agota el maxDuration del
      // serverless. Se propaga el hint y el cliente espera entre lotes.
      if (error?.cause?.esperaMs) break;
      console.warn(`Clasificación con ${modelo} falló; probando siguiente modelo:`, ultimoError.message);
    }
  }
  throw ultimoError;
}

function validarPropuestaCategoria(propuesta) {
  const nombre = propuesta && typeof propuesta.categoria === "string" ? propuesta.categoria : "";
  const categoriaValida = CATEGORIAS_DISPONIBLES.find(
    (categoria) => normalizarCategoria(categoria) === normalizarCategoria(nombre)
  );
  if (!categoriaValida) return null;
  const confianzaNumerica = Number(propuesta.confianza);
  return {
    categoria: categoriaValida,
    metodo: "gemini",
    confianza: Number.isFinite(confianzaNumerica) ? Math.max(0, Math.min(1, confianzaNumerica)) : 0.5,
  };
}

async function clasificarLoteConIA(apiKey, noticias) {
  const resultados = new Array(noticias.length);
  let esperaSugeridaMs = 0;
  // Primer código de fallo del lote para diagnóstico ('auth' | 'cuota' |
  // 'red' | 'respuesta'). Permite al cliente explicar por qué nada se
  // clasificó en vez de mostrar un genérico.
  let falloCodigo = null;
  const grupos = new Map();
  noticias.forEach((noticia, indice) => {
    const key = `${(noticia.titulo || "").trim()}\u0000${(noticia.resumen || "").trim()}`;
    const cached = cacheClasificacionGet(key);
    if (cached) {
      resultados[indice] = cached;
      return;
    }
    if (!grupos.has(key)) {
      grupos.set(key, { titulo: noticia.titulo || "", resumen: noticia.resumen || "", key, indices: [] });
    }
    grupos.get(key).indices.push(indice);
  });

  const unicos = [...grupos.values()];
  for (let inicio = 0; inicio < unicos.length; inicio += GEMINI_LOTE_TAMANO) {
    const lote = unicos.slice(inicio, inicio + GEMINI_LOTE_TAMANO);
    try {
      const texto = await ejecutarCadenaIA(apiKey, construirInstruccionLote(lote), GEMINI_LOTE_MAX_TOKENS, GEMINI_LOTE_TIMEOUT_MS);
      const propuestas = extraerArregloPropuesta(texto);
      const porIndice = new Map();
      for (const propuesta of propuestas) {
        if (propuesta && Number.isInteger(Number(propuesta.i))) porIndice.set(Number(propuesta.i), propuesta);
      }
      lote.forEach((item, posicion) => {
        const validada = validarPropuestaCategoria(porIndice.get(posicion));
        const resultado = validada || { ...SIN_CLASIFICACION };
        if (validada) cacheClasificacionSet(item.key, resultado);
        item.indices.forEach((indice) => {
          resultados[indice] = resultado;
        });
      });
    } catch (error) {
      console.warn("Clasificación por lote falló; se usará 'General':", error.message);
      if (error?.cause?.esperaMs) {
        esperaSugeridaMs = Math.max(esperaSugeridaMs, error.cause.esperaMs);
      }
      if (!falloCodigo) {
        const codigo = error?.cause?.codigo;
        if (codigo === "auth" || codigo === "cuota") {
          falloCodigo = codigo;
        } else if (error?.name === "AbortError") {
          falloCodigo = "red";
        } else if (/HTTP 40[013]/.test(error?.message || "")) {
          falloCodigo = "auth";
        } else if (/429|cuota/i.test(error?.message || "")) {
          falloCodigo = "cuota";
        } else {
          falloCodigo = "respuesta";
        }
      }
      lote.forEach((item) => {
        item.indices.forEach((indice) => {
          resultados[indice] = { ...SIN_CLASIFICACION };
        });
      });
    }
  }
  return { resultados, esperaMs: esperaSugeridaMs, fallo: falloCodigo };
}

async function obtenerClasificacionesExistentes(fuenteIds = []) {
  const mapa = new Map();
  const ids = [...new Set(fuenteIds.filter((id) => id !== undefined && id !== null))];
  if (ids.length === 0) return mapa;
  const [filas] = await db.query(
    `SELECT fuente_id, url_original, categoria, clasificacion_metodo, clasificacion_confianza, imagen_url, video_url
     FROM articulos_publicados WHERE fuente_id IN (?)`,
    [ids]
  );
  for (const fila of filas) {
    const confianza = Number(fila.clasificacion_confianza);
    mapa.set(`${fila.fuente_id}\u0000${fila.url_original}`, {
      categoria: fila.categoria || "General",
      metodo: fila.clasificacion_metodo || "sin-ia",
      confianza: Number.isFinite(confianza) ? confianza : 0.5,
      video: fila.video_url || "",
    });
  }
  return mapa;
}

function extraerImagenUrl(item = {}) {
  const esUrlImagen = (valor) =>
    typeof valor === "string" &&
    /^https?:\/\//i.test(valor.trim()) &&
    !/^data:/i.test(valor.trim()) &&
    /\.(jpe?g|png|webp|gif|avif|bmp)(\?|#|$)/i.test(valor.trim());

  const enclosure = item.enclosure;
  if (enclosure && typeof enclosure.url === "string" && /^https?:\/\//i.test(enclosure.url.trim())) {
    const tipo = String(enclosure.type || "").toLowerCase();
    if (!tipo || tipo.startsWith("image/") || esUrlImagen(enclosure.url)) {
      return enclosure.url.trim();
    }
  }

  const mediaCandidates = [
    item["media:content"]?.$?.url,
    Array.isArray(item["media:content"]) ? item["media:content"][0]?.$?.url : null,
    item["media:thumbnail"]?.$?.url,
    item.image?.url,
    item.itunes?.image,
  ];
  for (const url of mediaCandidates) {
    if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) return url.trim();
  }

  const html = item.content || item["content:encoded"] || "";
  if (typeof html === "string") {
    const coincidencia = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (coincidencia && esUrlImagen(coincidencia[1])) return coincidencia[1].trim();
  }
  return "";
}

function normalizarItemNoticia(item = {}) {
  const link = limpiarUrlNoticia(item.link || item.guid || item.id || "");
  if (!link) return null;
  const rawResumen = item.contentSnippet || item.summary || item.content || item.description || "";
  return {
    link,
    titulo: item.title || "Sin título",
    resumen: rawResumen.replace(/<[^>]*>?/gm, "").substring(0, 300),
    imagen: extraerImagenUrl(item),
    video: extraerVideoUrl(item),
  };
}

async function prepararClasificaciones(fuenteId, items = [], existentes = new Map(), { omitirIA = false } = {}) {
  const resultados = new Array(items.length).fill(null);
  const nuevos = [];
  items.forEach((item, posicion) => {
    const normalizado = normalizarItemNoticia(item);
    if (!normalizado) return;
    const previo = existentes.get(`${fuenteId}\u0000${normalizado.link}`);
    if (previo && previo.metodo !== "sin-ia") {
      resultados[posicion] = { ...previo, link: normalizado.link, titulo: normalizado.titulo, resumen: normalizado.resumen, imagen: normalizado.imagen, video: normalizado.video || previo.video || "", esNuevo: false };
    } else {
      nuevos.push({ posicion, ...normalizado });
    }
  });

  const apiKey = configIA().apiKey;
  let resultadosIA = nuevos.map(() => ({ ...SIN_CLASIFICACION }));
  if (apiKey && nuevos.length > 0 && !omitirIA) {
    resultadosIA = (await clasificarLoteConIA(apiKey, nuevos)).resultados;
  }
  nuevos.forEach((nuevo, k) => {
    const clasificacion = resultadosIA[k] || { ...SIN_CLASIFICACION };
    resultados[nuevo.posicion] = {
      categoria: clasificacion.categoria,
      metodo: clasificacion.metodo,
      confianza: clasificacion.confianza,
      link: nuevo.link,
      titulo: nuevo.titulo,
      resumen: nuevo.resumen,
      imagen: nuevo.imagen,
      video: nuevo.video || "",
      esNuevo: true,
    };
  });
  return resultados;
}

function calcularFechaPublicacion(item = {}, limiteFecha) {
  let fechaPub = new Date();
  if (item.pubDate && !isNaN(Date.parse(item.pubDate))) {
    fechaPub = new Date(item.pubDate);
  } else if (item.isoDate && !isNaN(Date.parse(item.isoDate))) {
    fechaPub = new Date(item.isoDate);
  }

  if (isNaN(fechaPub.getTime()) || fechaPub < limiteFecha) {
    fechaPub = new Date();
  }
  return fechaPub;
}

async function bulkUpdateArticulos(fuenteId, filas, { conCategoria = false } = {}) {
  if (filas.length === 0) return;
  const params = [];
  const agregarCasos = (obtenerValor) => {
    for (const fila of filas) params.push(fila.link, obtenerValor(fila));
    return `CASE url_original ${filas.map(() => "WHEN ? THEN ?").join(" ")} END`;
  };
  const asignaciones = [
    `titulo = ${agregarCasos((fila) => fila.titulo)}`,
    `resumen = ${agregarCasos((fila) => fila.resumen)}`,
    `fecha_publicacion = ${agregarCasos((fila) => fila.fechaPub)}`,
    `imagen_url = ${agregarCasos((fila) => fila.imagen || null)}`,
  ];
  if (conCategoria) {
    asignaciones.push(
      `categoria = ${agregarCasos((fila) => fila.categoria)}`,
      `clasificacion_metodo = ${agregarCasos((fila) => fila.metodo)}`,
      `clasificacion_confianza = ${agregarCasos((fila) => fila.confianza)}`,
      // Solo en filas nuevas: no pisar videos persistidos bajo demanda.
      `video_url = ${agregarCasos((fila) => fila.video || null)}`
    );
  }
  asignaciones.push("descartado = 0");
  const sql = `UPDATE articulos_publicados SET ${asignaciones.join(", ")}
    WHERE fuente_id = ? AND url_original IN (${filas.map(() => "?").join(", ")})`;
  params.push(fuenteId, ...filas.map((fila) => fila.link));
  await db.query(sql, params);
}

async function persistirArticulos(fuenteId, items = [], clasificaciones = [], limiteFecha, { soloInsertar = false } = {}) {
  const filas = [];
  items.forEach((item, indice) => {
    const clasificacion = clasificaciones[indice];
    if (!clasificacion) return;
    filas.push({ ...clasificacion, fechaPub: calcularFechaPublicacion(item, limiteFecha) });
  });
  if (filas.length === 0) return { insertados: 0 };

  const [insertRes] = await db.query(
    `INSERT IGNORE INTO articulos_publicados
     (fuente_id, titulo, resumen, url_original, fecha_publicacion, categoria, clasificacion_metodo, clasificacion_confianza, imagen_url, video_url, leido, guardado, descartado)
     VALUES ${filas.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)").join(", ")}`,
    filas.flatMap((fila) => [fuenteId, fila.titulo, fila.resumen, fila.link, fila.fechaPub, fila.categoria, fila.metodo, fila.confianza, fila.imagen || null, fila.video || null])
  );

  if (!soloInsertar) {
    await bulkUpdateArticulos(fuenteId, filas.filter((fila) => !fila.esNuevo), { conCategoria: false });
    await bulkUpdateArticulos(fuenteId, filas.filter((fila) => fila.esNuevo), { conCategoria: true });
  }
  return { insertados: insertRes.affectedRows || 0 };
}

async function bulkUpdateCategoriasPorId(filas = []) {
  if (filas.length === 0) return 0;
  const params = [];
  const agregarCasos = (obtenerValor) => {
    for (const fila of filas) params.push(fila.id, obtenerValor(fila));
    return `CASE id ${filas.map(() => "WHEN ? THEN ?").join(" ")} END`;
  };
  const sql = `UPDATE articulos_publicados SET
    categoria = ${agregarCasos((fila) => fila.categoria)},
    clasificacion_metodo = ${agregarCasos((fila) => fila.metodo)},
    clasificacion_confianza = ${agregarCasos((fila) => fila.confianza)}
    WHERE id IN (${filas.map(() => "?").join(", ")})`;
  params.push(...filas.map((fila) => fila.id));
  const [resultado] = await db.query(sql, params);
  return resultado.affectedRows || 0;
}

async function purgarArticulosAntiguos({ userId = null, fuenteId = null } = {}) {
  const limiteDescarte = new Date();
  limiteDescarte.setDate(limiteDescarte.getDate() - 7);
  const limiteLeidos = new Date();
  limiteLeidos.setDate(limiteLeidos.getDate() - 60);

  const alcanceFuente = fuenteId ? "AND a.fuente_id = ?" : "";
  const alcanceUsuario = userId ? "AND f.usuario_id = ?" : "";
  const consultas = [
    [`DELETE a FROM articulos_publicados a
      INNER JOIN fuentes_rss f ON a.fuente_id = f.id
      WHERE (a.guardado = 0 OR a.guardado IS NULL) AND a.descartado = 1 AND a.fecha_publicacion < ?
      ${alcanceFuente} ${alcanceUsuario}`, limiteDescarte],
    [`DELETE a FROM articulos_publicados a
      INNER JOIN fuentes_rss f ON a.fuente_id = f.id
      WHERE (a.guardado = 0 OR a.guardado IS NULL) AND (a.descartado = 0 OR a.descartado IS NULL) AND a.leido = 1 AND a.fecha_publicacion < ?
      ${alcanceFuente} ${alcanceUsuario}`, limiteLeidos],
  ];

  let purgados = 0;
  for (const [sql, limite] of consultas) {
    const params = [limite];
    if (fuenteId) params.push(fuenteId);
    if (userId) params.push(userId);
    const [resultado] = await db.query(sql, params);
    purgados += resultado.affectedRows || 0;
  }
  return purgados;
}

function extraerPendientes(clasificaciones = []) {
  const vistos = new Set();
  const pendientes = [];
  for (const clasificacion of clasificaciones) {
    if (!clasificacion?.esNuevo || vistos.has(clasificacion.link)) continue;
    vistos.add(clasificacion.link);
    pendientes.push({ link: clasificacion.link, titulo: clasificacion.titulo, resumen: clasificacion.resumen });
  }
  return pendientes;
}

const normalizacionArticulosPromises = new Map();

async function normalizarArticulosExistentes(userId) {
  if (!normalizacionArticulosPromises.has(userId)) {
    const normalizacionArticulosPromise = (async () => {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        const [filas] = await connection.query(
          `SELECT a.id, a.fuente_id, a.url_original, a.leido, a.guardado, a.descartado
           FROM articulos_publicados a
           INNER JOIN fuentes_rss f ON f.id = a.fuente_id
           WHERE f.usuario_id = ?
           ORDER BY a.fuente_id ASC, a.id ASC
           FOR UPDATE`,
          [userId]
        );
        const grupos = new Map();
        for (const fila of filas) {
          const urlCanonica = limpiarUrlNoticia(fila.url_original);
          if (!urlCanonica) continue;
          const clave = `${fila.fuente_id}\u0000${urlCanonica}`;
          if (!grupos.has(clave)) grupos.set(clave, { urlCanonica, filas: [] });
          grupos.get(clave).filas.push(fila);
        }

        for (const grupo of grupos.values()) {
          const [principal, ...duplicadas] = grupo.filas;
          if (duplicadas.length > 0) {
            await connection.query(
              "DELETE FROM articulos_publicados WHERE id IN (?)",
              [duplicadas.map((fila) => fila.id)]
            );
          }
          const leido = Math.max(...grupo.filas.map((fila) => Number(fila.leido) || 0));
          const guardado = Math.max(...grupo.filas.map((fila) => Number(fila.guardado) || 0));
          const descartado = Math.min(...grupo.filas.map((fila) => Number(fila.descartado) || 0));
          if (
            principal.url_original !== grupo.urlCanonica ||
            Number(principal.leido) !== leido ||
            Number(principal.guardado) !== guardado ||
            Number(principal.descartado) !== descartado
          ) {
            await connection.query(
              `UPDATE articulos_publicados
               SET url_original = ?, leido = ?, guardado = ?, descartado = ?
               WHERE id = ?`,
              [grupo.urlCanonica, leido, guardado, descartado, principal.id]
            );
          }
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    })().catch((error) => {
      normalizacionArticulosPromises.delete(userId);
      throw error;
    });
    normalizacionArticulosPromises.set(userId, normalizacionArticulosPromise);
  }
  return normalizacionArticulosPromises.get(userId);
}