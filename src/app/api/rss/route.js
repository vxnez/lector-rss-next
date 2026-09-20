// src/app/api/rss/route.js — Proxy a la API interna (sin MySQL directo).
// El dashboard carga vía API_URL: GET lista/filtra, PUT marca, DELETE descarta,
// POST da de alta (descubrimiento local + POST /api/data/fuentes).
// El refresco y la clasificación IA los ejecuta el backend; aquí se delega.
import { auth } from "@/auth";
import {
  createFuente,
  deleteFuente,
  getArticulos,
  getFuentes,
  getStats,
  marcarArticulo,
  patchFuente,
  refreshFuentes,
} from "@/lib/api";
import { sendPushToUser } from "@/lib/push";
import { resolverUsuarioId } from "@/lib/invitado";
import { NextResponse } from "next/server";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { CATEGORIAS_DISPONIBLES } from "@/lib/categoryClassifier";
import { fetchPublico, leerBufferLimitado, leerTextoLimitado } from "@/lib/ssrf";
import { convertirPaginaAFeed } from "@/lib/webToRss";

export const maxDuration = 60;

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
});

const imagenPaginaCache = new Map();

// Stub de compatibilidad: el cron antiguo importaba esta función desde aquí.
export async function refrescarFuentesDeUsuario() {
  return { vacia: true, nuevos: 0, pendientes: 0, omitidas: 0, restaurados: 0, purgados: 0 };
}

// ---------- Utilidades puras (sin DB) ----------

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

function esTrackerMultimedia(img, abs) {
  const texto = `${img.attr("src") || ""} ${img.attr("data-src") || ""} ${img.attr("alt") || ""} ${img.attr("class") || ""} ${abs || ""}`.toLowerCase();
  if (/pixel|beacon|\/track|tracking|analytics|spacer|transparent|blank|1x1|clear\.gif|dot\.gif/i.test(texto)) return true;
  const w = parseInt(img.attr("width") || "0", 10);
  const h = parseInt(img.attr("height") || "0", 10);
  if ((w === 1 && h <= 1) || (h === 1 && w <= 1)) return true;
  return false;
}

function esUrlVideoDirecta(valor) {
  if (typeof valor !== "string") return false;
  const v = valor.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  return /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i.test(v);
}

const HEADERS_BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/xhtml+xml, */*;q=0.8",
  Referer: "https://www.google.com/",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

const HEADERS_ALT = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/xhtml+xml, */*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

async function obtenerHtmlPagina(url, etiqueta = "media") {
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
    if (!res.ok || !/html/i.test(contentType)) return null;
    const html = await leerTextoLimitado(res);
    return { html, baseFinal: urlFinal || url };
  } catch {
    return null;
  }
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

async function extraerVideoDePagina(url) {
  const vacio = { video: "", poster: "" };
  const pagina = await obtenerHtmlPagina(url);
  if (!pagina) return vacio;
  const $ = cheerio.load(pagina.html);
  const yt = pagina.html.match(/(?:youtube\.com\/(?:embed\/|v\/|shorts\/)|youtube-nocookie\.com\/embed\/|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return { video: "", poster: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg` };
  return vacio;
}

async function extraerImagenDirecta(url) {
  const pagina = await obtenerHtmlPagina(url, "imagen");
  if (!pagina) return null;
  const { html, baseFinal } = pagina;
  try {
    const $ = cheerio.load(html);
    const meta = $('meta[property="og:image"]').attr("content") || $('meta[name="twitter:image"]').attr("content");
    if (meta) {
      try {
        const abs = new URL(meta.trim(), baseFinal).href;
        if (/^https?:\/\//i.test(abs)) return abs;
      } catch {
        // Seguir con el fallback.
      }
    }
    const img = $("article img, main img, figure img").first();
    if (img.length) {
      const src = img.attr("src") || img.attr("data-src");
      const abs = absolverUrlMultimedia(src, baseFinal);
      if (abs && !esTrackerMultimedia(img, abs)) return abs;
    }
    return null;
  } catch {
    return null;
  }
}

function limpiarUrl(urlRaw) {
  const valor = urlRaw?.trim();
  if (!valor) return "";
  try {
    return new URL(/^https?:\/\//i.test(valor) ? valor : `https://${valor}`).href;
  } catch {
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
  const fuentes = (await getFuentes(userId).catch(() => [])) || [];
  return fuentes.find((f) => objetivos.has(normalizarUrlComparacion(f.url_feed || ""))) || null;
}

function derivarNombreFuente(feed = {}, urlFinal = "") {
  let nombre = String(feed.title || "").replace(/\s+/g, " ").trim();
  nombre = nombre
    .replace(/\s*[|•·–—/-]\s*(latest[^|•·–—/-]*|últimas[^|•·–—/-]*|ultimas[^|•·–—/-]*)$/i, "")
    .replace(/\s*\b(latest articles|latest news|latest updates|rss feed|atom feed|feed)\s*$/i, "")
    .trim();
  if (nombre && nombre.length <= 40) return nombre;
  try {
    const etiqueta = new URL(feed.link || urlFinal || "").hostname.replace(/^www\./i, "").split(".")[0];
    if (etiqueta) return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
  } catch {
    // Sin sitio válido.
  }
  return nombre ? `${nombre.slice(0, 37).trim()}…` : "Fuente RSS";
}

const RSS_TIMEOUT_MS = 8000;
const HTML_TIMEOUT_MS = 12000;
const MAX_FEED_CANDIDATES = 80;

async function fetchConFallback(url, { timeoutMs = RSS_TIMEOUT_MS, validadores = {} } = {}) {
  const armar = (base) => {
    const headers = { ...base };
    if (validadores.etag) headers["If-None-Match"] = validadores.etag;
    if (validadores.lastModified) headers["If-Modified-Since"] = validadores.lastModified;
    return headers;
  };
  const pedir = (base) => fetchPublico(url, { headers: armar(base), timeoutMs });
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
  const { res, urlFinal } = await fetchConFallback(url, { timeoutMs, validadores });
  if (res.status === 304) return { sinCambios: true, urlFinal };
  if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
  const buffer = await leerBufferLimitado(res);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buffer));
  return { text, urlFinal, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified") };
}

async function intentarParsearFeed(url, validadores = {}) {
  try {
    const respuesta = await obtenerTextoDecodificado(url, RSS_TIMEOUT_MS, validadores);
    if (respuesta.sinCambios) return { sinCambios: true, urlFinal: respuesta.urlFinal };
    const contenido = respuesta.text.trim();
    let feed;
    if (contenido.startsWith("{")) {
      const json = JSON.parse(contenido);
      if (Array.isArray(json.items)) {
        feed = { title: json.title || "Fuente RSS", items: json.items.map((i) => ({ title: i.title, link: i.url })) };
      }
    } else {
      feed = await parser.parseString(contenido);
    }
    if (feed?.items?.length > 0) {
      return { feed, urlFinal: respuesta.urlFinal, etag: respuesta.etag, lastModified: respuesta.lastModified };
    }
  } catch {
    return null;
  }
  return null;
}

function agregarCandidato(candidatos, href, baseUrl, prioridad = 0) {
  if (!href || candidatos.length >= MAX_FEED_CANDIDATES) return;
  const valor = String(href).trim();
  if (!valor || /^(javascript:|mailto:|tel:|#)/i.test(valor)) return;
  try {
    const url = new URL(valor, baseUrl);
    if (!/^https?:$/.test(url.protocol)) return;
    url.hash = "";
    if (!candidatos.some((c) => c.url === url.href)) candidatos.push({ url: url.href, prioridad });
  } catch {
    // Enlace malformado: se ignora.
  }
}

function extraerCandidatosDesdeHtml(html, urlBase) {
  const candidatos = [];
  const $ = cheerio.load(html, { decodeEntities: true });
  $("link[href]").each((_, el) => {
    const href = $(el).attr("href");
    const type = ($(el).attr("type") || "").toLowerCase();
    agregarCandidato(candidatos, href, urlBase, /rss|atom|feed/.test(type) ? 100 : 80);
  });
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (/rss|atom|feed|xml/i.test(`${href} ${$(el).text()}`)) agregarCandidato(candidatos, href, urlBase, 70);
  });
  return candidatos;
}

function obtenerRutasFeed(urlLimpia) {
  const entrada = new URL(urlLimpia);
  const origen = entrada.origin;
  return ["/feed/", "/feed", "/rss/", "/rss", "/atom", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml"].map(
    (r) => new URL(r, origen).href
  );
}

async function buscarPrimerFeed(candidatos) {
  const ordenados = [...candidatos].sort((a, b) => b.prioridad - a.prioridad).slice(0, MAX_FEED_CANDIDATES);
  for (const c of ordenados) {
    const r = await intentarParsearFeed(c.url);
    if (r) return r;
  }
  return null;
}

async function buscarFeedRSS(urlIngresada, { forzarWeb = false } = {}) {
  const urlLimpia = limpiarUrl(urlIngresada);
  if (!urlLimpia) throw new Error("La URL es obligatoria.");
  if (forzarWeb) {
    const conversion = await convertirPaginaAFeed(urlLimpia);
    if (conversion?.sinCambios || !conversion?.feed) throw new Error("No se pudo convertir la página a RSS.");
    return { feed: conversion.feed, urlFinal: conversion.urlFinal, convertida: true, paginas: conversion.paginas || 1 };
  }
  const directo = await intentarParsearFeed(urlLimpia);
  if (directo) return directo;
  const candidatos = [];
  try {
    const { res, urlFinal } = await fetchConFallback(urlLimpia, { timeoutMs: HTML_TIMEOUT_MS });
    if (res.ok) {
      const html = await leerTextoLimitado(res);
      extraerCandidatosDesdeHtml(html, urlFinal || urlLimpia).forEach((c) => candidatos.push(c));
    }
  } catch (err) {
    console.warn("Error leyendo la página para descubrir RSS:", err.message);
  }
  obtenerRutasFeed(urlLimpia).forEach((u) => agregarCandidato(candidatos, u, urlLimpia, 40));
  const descubierto = await buscarPrimerFeed(candidatos);
  if (descubierto) return descubierto;
  const conversion = await convertirPaginaAFeed(urlLimpia);
  if (conversion?.sinCambios || !conversion?.feed) throw new Error("No se pudo detectar un feed RSS válido en esta URL.");
  return { feed: conversion.feed, urlFinal: conversion.urlFinal, convertida: true, paginas: conversion.paginas || 1 };
}

// ---------- Normalización de respuestas del backend ----------

function extraerLista(res) {
  if (Array.isArray(res)) return { items: res, total: res.length, exacto: false };
  const items = res?.articles || res?.articulos || res?.data || res?.items || [];
  const crudo = res?.total ?? res?.count;
  // Sin total del backend no hay última página conocida: se infiere hasMore
  // por bloque lleno (ver rama paginada). `exacto` lo señala.
  if (crudo === undefined || crudo === null) {
    return { items: Array.isArray(items) ? items : [], total: Array.isArray(items) ? items.length : 0, exacto: false };
  }
  const total = Number(crudo) || (Array.isArray(items) ? items.length : 0);
  return { items: Array.isArray(items) ? items : [], total, exacto: true };
}

function repararTextoMalDecodificado(texto = "") {
  if (typeof texto !== "string" || !/[ÃÂ�]/.test(texto)) return texto;
  try {
    const bytes = Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));
    const reparado = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return reparado.includes("�") ? texto : reparado;
  } catch {
    return texto;
  }
}

function repararFilaArticulo(row) {
  return {
    ...row,
    titulo: repararTextoMalDecodificado(row.titulo ?? row.title ?? ""),
    resumen: repararTextoMalDecodificado(row.resumen ?? row.summary ?? ""),
    fuente_nombre: repararTextoMalDecodificado(row.fuente_nombre ?? row.fuente ?? ""),
  };
}

function normalizarCategoria(valor = "") {
  return String(valor || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function filtrosDesdeTab(tab) {
  if (tab === "guardadas") return { guardado: 1 };
  if (tab === "leidas") return { leido: 1 };
  return { leido: 0 };
}

function ordenExterno(orden) {
  if (orden === "antiguas") return { order: "fecha_publicacion", dir: "ASC" };
  if (orden === "az") return { order: "titulo", dir: "ASC" };
  if (orden === "za") return { order: "titulo", dir: "DESC" };
  return { order: "fecha_publicacion", dir: "DESC" };
}

// ---------- Handlers ----------

export async function POST(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));

    if (body.action === "clasificar_pendientes") {
      return NextResponse.json({ clasificados: 0, restantes: 0, reintentarEn: 0, diag: null });
    }

    if (body.action === "refresh_source" || body.action === "refresh") {
      // Refresco real en el backend (ingesta). Sin fuente_id = todas.
      const fuenteId = body.source_id ?? body.fuente_id ?? body.id ?? null;
      try {
        const r = await refreshFuentes(userId, fuenteId, { timeoutMs: 55000 });
        const nuevos = Number(r?.nuevos) || 0;
        const omitidas = Number(r?.omitidas) || 0;
        const actualizadas = Number(r?.actualizadas ?? r?.fuentes) || 0;
        if (nuevos > 0) {
          // P2: avisar al usuario (best-effort, no rompe la respuesta).
          await sendPushToUser(userId, {
            title: "RSS Dashboard",
            body: `${nuevos} noticias nuevas`,
            url: "/",
          }).catch((err) => console.warn("Push tras refresh falló:", err?.message || err));
        }
        return NextResponse.json({
          message:
            nuevos > 0
              ? `Actualización completa: ${nuevos} noticias nuevas`
              : "Fuentes actualizadas sin novedades",
          nuevos,
          restaurados: 0,
          pendientes: 0,
          omitidas,
          purgados: 0,
          actualizadas,
          detalle: r?.detalle || undefined,
        });
      } catch (error) {
        console.error(
          "Error en refresh vía backend:",
          error?.status ? `status=${error.status}` : "",
          error?.message || error
        );
        const detalle = error?.data?.error || error?.data?.message || error?.message;
        const status = Number(error?.status) === 429 ? 429 : 500;
        return NextResponse.json(
          {
            error: "No se pudo refrescar desde el backend",
            ...(typeof detalle === "string" ? { detalle: detalle.slice(0, 300) } : {}),
          },
          { status }
        );
      }
    }

    const { url_feed } = body;
    if (!url_feed) return NextResponse.json({ error: "La URL es obligatoria" }, { status: 400 });

    const duplicadaEntrada = await buscarFuenteDuplicada(userId, [url_feed]);
    if (duplicadaEntrada) {
      return NextResponse.json(
        { error: `Esta fuente RSS ya está registrada en tu cuenta como "${duplicadaEntrada.titulo}".` },
        { status: 409 }
      );
    }

    const { feed, urlFinal, convertida, paginas } = await buscarFeedRSS(url_feed, {
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

    try {
      await createFuente({
        usuario_id: userId,
        titulo: derivarNombreFuente(feed, urlFinal),
        url_feed: urlFinal || limpiarUrl(url_feed),
        categoria: body.categoria?.trim() || "General",
      });
    } catch (error) {
      if (Number(error?.status) === 409) {
        return NextResponse.json(
          { error: "Esta fuente RSS ya está registrada en tu cuenta." },
          { status: 409 }
        );
      }
      throw error;
    }

    const totalNuevas = feed.items.length;
    if (convertida) {
      return NextResponse.json(
        { message: "Página convertida a RSS y agregada con éxito", nuevos: totalNuevas, pendientes: 0, convertida: true, paginas: paginas || 1 },
        { status: 201 }
      );
    }
    return NextResponse.json({ message: "Fuente agregada con éxito", nuevos: totalNuevas, pendientes: 0 }, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/rss vía API:", error?.message || error);
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
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo");

    if (tipo === "fuentes") {
      const fuentes = (await getFuentes(userId).catch(() => [])) || [];
      return NextResponse.json(
        (Array.isArray(fuentes) ? fuentes : []).map((f) => ({
          ...f,
          convertFullPage: Number(f.convert_full_page) === 1 || f.convertFullPage === true,
        }))
      );
    }

    if (tipo === "categorias") return NextResponse.json(CATEGORIAS_DISPONIBLES);

    if (tipo === "imagen") {
      const cruda = (searchParams.get("url") || "").trim();
      let verificada = "";
      try {
        const urlObj = new URL(cruda);
        if (!/^https?:$/.test(urlObj.protocol)) throw new Error("protocolo");
        verificada = urlObj.href;
      } catch {
        return NextResponse.json({ imagen: null });
      }
      if (imagenPaginaCache.has(verificada)) {
        const c = imagenPaginaCache.get(verificada) || {};
        return NextResponse.json({ imagen: c.imagen || null, video: c.video || null });
      }
      const encontrada = await extraerImagenDirecta(verificada);
      let medios;
      if (encontrada) medios = { imagen: encontrada, video: null };
      else {
        const emb = await extraerVideoDePagina(verificada);
        medios = { imagen: emb.poster || null, video: emb.video || null };
      }
      imagenPaginaCache.set(verificada, medios);
      if (imagenPaginaCache.size > 500) imagenPaginaCache.delete(imagenPaginaCache.keys().next().value);
      return NextResponse.json(medios);
    }

    // Conteos por fuente para el gestor (el backend no manda articulos_count):
    // un solo bulk y agrupado local. Topado en 1000 (ver `truncado`).
    if (tipo === "conteo_fuentes") {
      const res = await getArticulos({ usuario_id: userId, limit: 1000, offset: 0 }).catch(() => []);
      const { items } = extraerLista(res);
      const counts = {};
      for (const a of items || []) {
        const fid = a?.fuente_id ?? a?.fuenteId;
        if (fid === undefined || fid === null) continue;
        counts[String(fid)] = (counts[String(fid)] || 0) + 1;
      }
      return NextResponse.json({ counts, truncado: (items || []).length >= 1000 });
    }

    if (tipo === "conteos") {      const stats = await getStats(userId).catch(() => null);
      const articulos = Number(stats?.articulos ?? stats?.total ?? 0) || 0;
      const pendientes = Number(stats?.no_leidos ?? stats?.pendientes ?? 0) || 0;
      let guardadas = Number(stats?.guardadas ?? stats?.guardados ?? 0) || 0;
      if (!guardadas) {
        try {
          const g = await getArticulos({ usuario_id: userId, limit: 1, offset: 0, guardado: 1 });
          guardadas = Number(g?.total ?? (Array.isArray(g) ? g.length : 0)) || 0;
        } catch {
          guardadas = 0;
        }
      }
      return NextResponse.json({
        pendientes,
        leidas: Math.max(articulos - pendientes, 0),
        guardadas,
      });
    }

    if (tipo === "facetas") {
      const tab = searchParams.get("tab") || "todas";
      const q = (searchParams.get("q") || "").trim();
      const fuentesFiltro = (searchParams.get("fuentes") || "").split(",").map((s) => s.trim()).filter(Boolean);
      const ia = searchParams.get("ia") || "todas";
      const base = filtrosDesdeTab(tab);
      const res = await getArticulos({ usuario_id: userId, limit: 1000, offset: 0, q: q || undefined, ...base });
      let { items } = extraerLista(res);
      if (fuentesFiltro.length > 0) {
        const set = new Set(fuentesFiltro.map(String));
        items = items.filter((a) => set.has(String(a.fuente_id)));
      }
      if (ia === "con_ia") items = items.filter((a) => a.clasificacion_metodo === "gemini");
      else if (ia === "sin_ia") items = items.filter((a) => (a.clasificacion_metodo || "sin-ia") === "sin-ia");
      const mapa = new Map();
      for (const a of items) {
        const cat = repararTextoMalDecodificado(a.categoria || "General");
        mapa.set(cat, (mapa.get(cat) || 0) + 1);
      }
      return NextResponse.json([...mapa.entries()].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => a.categoria.localeCompare(b.categoria, "es")));
    }

    const limiteParam = searchParams.get("limit");
    const paginaParam = searchParams.get("page");
    const usaPaginacion = limiteParam !== null || paginaParam !== null;
    const limite = Math.min(Math.max(Number(limiteParam) || 30, 1), 100);
    const pagina = Math.max(Number(paginaParam) || 1, 1);
    const desplazamiento =
      searchParams.get("offset") !== null
        ? Math.max(Number(searchParams.get("offset")) || 0, 0)
        : (pagina - 1) * limite;

    const tab = searchParams.get("tab") || "todas";
    const q = (searchParams.get("q") || "").trim();
    const categorias = (searchParams.get("categorias") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const fuentesFiltro = (searchParams.get("fuentes") || "").split(",").map((s) => s.trim()).filter(Boolean);
    const ia = searchParams.get("ia") || "todas";
    const orden = searchParams.get("orden") || "recientes";
    const { order, dir } = ordenExterno(orden);
    const base = filtrosDesdeTab(tab);
    const categoriaUnica = categorias.length === 1 ? categorias[0] : undefined;
    const necesitaLocal = fuentesFiltro.length > 0 || categorias.length > 1 || ia !== "todas";

    if (!usaPaginacion && !necesitaLocal && categorias.length === 0) {
      const res = await getArticulos({ usuario_id: userId, limit: 1000, offset: 0, q: q || undefined, ...base, order, dir });
      const { items } = extraerLista(res);
      return NextResponse.json(items.map(repararFilaArticulo));
    }

    if (necesitaLocal) {
      const res = await getArticulos({ usuario_id: userId, limit: 1000, offset: 0, q: q || undefined, categoria: categoriaUnica, ...base, order, dir });
      let { items, exacto } = extraerLista(res);
      // El bulk va topado en 1000: si vino lleno, el total filtrado es cota
      // inferior y puede haber más páginas (el frontend retrocede solo si la
      // página extra llega vacía).
      const topeBulk = items.length >= 1000;
      if (topeBulk) exacto = false;
      if (fuentesFiltro.length > 0) {
        const set = new Set(fuentesFiltro.map(String));
        items = items.filter((a) => set.has(String(a.fuente_id)));
      }
      if (categorias.length > 1) {
        const set = new Set(categorias);
        items = items.filter((a) => set.has(a.categoria));
      }
      if (ia === "con_ia") items = items.filter((a) => a.clasificacion_metodo === "gemini");
      else if (ia === "sin_ia") items = items.filter((a) => (a.clasificacion_metodo || "sin-ia") === "sin-ia");
      if (orden === "az") items.sort((a, b) => String(a.titulo).localeCompare(String(b.titulo, "es")));
      else if (orden === "za") items.sort((a, b) => String(b.titulo).localeCompare(String(a.titulo), "es"));
      const total = items.length;
      // Total inexacto y bloque final lleno: se ofrece la página siguiente
      // aunque "total" no la vea (retroceso automático si llega vacía).
      const hayMasLocal = !exacto && total > 0 && total % limite === 0;
      const totalPaginas = hayMasLocal ? pagina + 1 : Math.max(Math.ceil(total / limite), 1);
      const paginaSegura = Math.min(pagina, totalPaginas);
      const slice = items.slice((paginaSegura - 1) * limite, (paginaSegura - 1) * limite + limite).map(repararFilaArticulo);
      return NextResponse.json({ articles: slice, total, page: paginaSegura, limit: limite, totalPages: totalPaginas, hasMore: hayMasLocal || (paginaSegura - 1) * limite + slice.length < total });
    }

    const res = await getArticulos({
      usuario_id: userId,
      limit: limite,
      offset: desplazamiento,
      q: q || undefined,
      categoria: categoriaUnica,
      ...base,
      order,
      dir,
    });
    const { items, total, exacto } = extraerLista(res);
    const articulos = items.map(repararFilaArticulo);
    // Sin total del backend: bloque lleno => puede haber siguiente (ver arriba).
    const hayMas = exacto
      ? desplazamiento + articulos.length < total
      : articulos.length >= limite;
    const totalPaginas = exacto
      ? Math.max(Math.ceil(total / limite), 1)
      : (hayMas ? pagina + 1 : Math.max(pagina, 1));
    return NextResponse.json({
      articles: articulos,
      total: exacto ? total : desplazamiento + articulos.length,
      page: Math.min(pagina, totalPaginas),
      limit: limite,
      totalPages: totalPaginas,
      hasMore: hayMas,
    });
  } catch (error) {
    console.error("Error al obtener datos vía API:", error?.message || error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const body = await req.json();
    const { id, leido, guardado, titulo, categoria, tipo } = body;

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    if (tipo === "fuente") {
      try {
        await patchFuente(id, { usuario_id: userId, ...(titulo ? { titulo } : {}), ...(categoria ? { categoria } : {}) });
      } catch (error) {
        if (Number(error?.status) === 404) {
          return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
        }
        throw error;
      }
      return NextResponse.json({ message: "Fuente actualizada correctamente" });
    }

    const patch = {};
    if (leido !== undefined) patch.leido = leido ? 1 : 0;
    if (guardado !== undefined) patch.guardado = guardado ? 1 : 0;
    if (categoria !== undefined) {
      const valida = CATEGORIAS_DISPONIBLES.find((n) => normalizarCategoria(n) === normalizarCategoria(String(categoria)));
      if (!valida) return NextResponse.json({ error: "Categoría no válida" }, { status: 400 });
      patch.categoria = valida;
    }
    try {
      const r = await marcarArticulo(id, userId, patch);
      if (categoria !== undefined) return NextResponse.json({ message: "Categoría actualizada", categoria: patch.categoria });
      return NextResponse.json(r || { message: "Artículo actualizado" });
    } catch (error) {
      if (Number(error?.status) === 404) {
        return NextResponse.json({ error: "Artículo no encontrado o no autorizado" }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error al actualizar vía API:", error?.message || error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    const userId = Number(await resolverUsuarioId(req, session));
    if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const tipo = searchParams.get("tipo");
    const deleteAll = searchParams.get("delete_all");

    if (deleteAll === "true") {
      const alcanceTab = searchParams.get("tab") || "todas";
      if (!["todas", "leidas", "guardadas"].includes(alcanceTab)) {
        return NextResponse.json({ error: "Pestaña no válida" }, { status: 400 });
      }
      const base = filtrosDesdeTab(alcanceTab);
      const res = await getArticulos({ usuario_id: userId, limit: 1000, offset: 0, ...base }).catch(() => []);
      const { items } = extraerLista(res);
      await Promise.all(items.map((a) => marcarArticulo(a.id, userId, { descartado: 1 }).catch(() => null)));
      return NextResponse.json({ message: "Todas las publicaciones fueron descartadas", tab: alcanceTab });
    }

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    if (tipo === "fuente") {
      try {
        await deleteFuente(id, userId);
      } catch (error) {
        if (Number(error?.status) === 404) {
          return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
        }
        throw error;
      }
      return NextResponse.json({ message: "Fuente y sus artículos eliminados por completo" });
    }

    try {
      await marcarArticulo(id, userId, { descartado: 1 });
    } catch (error) {
      if (Number(error?.status) === 404) {
        return NextResponse.json({ error: "Artículo no encontrado o no autorizado" }, { status: 404 });
      }
      throw error;
    }
    return NextResponse.json({ message: "Artículo descartado" });
  } catch (error) {
    console.error("Error al eliminar vía API:", error?.message || error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
