// src/app/api/rss/route.js
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import {
  CATALOGO_PROMPT,
  CATEGORIAS_DISPONIBLES,
} from "@/lib/categoryClassifier";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
});

const clasificacionCache = new Map();
let classificationSchemaPromise;

async function ensureClassificationSchema() {
  if (!classificationSchemaPromise) {
    classificationSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'articulos_publicados'
           AND COLUMN_NAME IN ('clasificacion_metodo', 'clasificacion_confianza')`
      );
      const existing = new Set(columns.map((column) => column.COLUMN_NAME));
      if (!existing.has("clasificacion_metodo")) {
        await db.query("ALTER TABLE articulos_publicados ADD COLUMN clasificacion_metodo VARCHAR(20) NOT NULL DEFAULT 'sin-ia'");
      }
      if (!existing.has("clasificacion_confianza")) {
        await db.query("ALTER TABLE articulos_publicados ADD COLUMN clasificacion_confianza DECIMAL(4,3) NOT NULL DEFAULT 0.500");
      }
    })().catch((error) => {
      classificationSchemaPromise = undefined;
      throw error;
    });
  }
  return classificationSchemaPromise;
}

const HEADERS_BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/xhtml+xml, */*;q=0.8",
  Referer: "https://www.google.com/",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

function limpiarUrlNoticia(rawUrl) {
  if (!rawUrl) return "";
  try {
    const urlObj = new URL(rawUrl.trim());
    urlObj.searchParams.delete("utm_source");
    urlObj.searchParams.delete("utm_medium");
    urlObj.searchParams.delete("utm_campaign");
    urlObj.searchParams.delete("utm_term");
    urlObj.searchParams.delete("utm_content");
    return urlObj.toString();
  } catch (e) {
    return rawUrl.trim();
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

const RSS_TIMEOUT_MS = 8000;
const HTML_TIMEOUT_MS = 12000;
const MAX_FEED_CANDIDATES = 80;

async function obtenerTextoDecodificado(url, timeoutMs = RSS_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: HEADERS_BROWSER,
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);

    const buffer = await res.arrayBuffer();
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
      urlFinal: res.url || url,
      contentType,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error("La solicitud excedió el tiempo límite de espera (timeout)");
    }
    throw err;
  }
}

async function intentarParsearFeed(url) {
  try {
    const respuesta = await obtenerTextoDecodificado(url);
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
      return { feed, urlFinal: respuesta.urlFinal };
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

async function buscarFeedRSS(urlIngresada) {
  const urlLimpia = limpiarUrl(urlIngresada);
  if (!urlLimpia) throw new Error("La URL es obligatoria.");

  const feedDirecto = await intentarParsearFeed(urlLimpia);
  if (feedDirecto) return feedDirecto;

  const candidatos = [];
  let urlPagina = urlLimpia;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HTML_TIMEOUT_MS);
    const res = await fetch(urlLimpia, {
      headers: HEADERS_BROWSER,
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    urlPagina = res.url || urlLimpia;

    const enlacesHeader = res.headers.get("link") || "";
    for (const coincidencia of enlacesHeader.matchAll(/<([^>]+)>\s*;[^,]*rel\s*=\s*["']?([^,;"']+)["']?[^,]*/gi)) {
      const relacion = coincidencia[2].toLowerCase();
      if (/alternate|feed|self/.test(relacion)) {
        agregarCandidato(candidatos, coincidencia[1], urlPagina, 95);
      }
    }

    if (res.ok && /html|xhtml|text\//i.test(res.headers.get("content-type") || "text/html")) {
      const html = await res.text();
      extraerCandidatosDesdeHtml(html, urlPagina).forEach((candidato) => candidatos.push(candidato));
    }
  } catch (err) {
    console.warn("Error leyendo la página para descubrir RSS:", err.message);
  }

  obtenerRutasFeed(urlPagina).forEach((url) => agregarCandidato(candidatos, url, urlPagina, 40));
  const feedDescubierto = await buscarPrimerFeed(candidatos);
  if (feedDescubierto) return feedDescubierto;

  throw new Error("No se pudo detectar un feed RSS válido en esta URL.");
}

export async function POST(req) {
  try {
    const session = await auth();
    const userId = session?.user?.id || 1;

    const body = await req.json().catch(() => ({}));
    await ensureClassificationSchema();

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
        const feed = await intentarParsearFeed(url);
        let pendientes = 0;
        if (feed?.items && feed.items.length > 0) {
          const existentes = await obtenerClasificacionesExistentes([source_id]);
          const clasificaciones = await prepararClasificaciones(source_id, feed.items, existentes, { omitirIA: true });
          await persistirArticulos(source_id, feed.items, clasificaciones, limiteFecha);
          pendientes = clasificarPendientesEnSegundoPlano(source_id, extraerPendientes(clasificaciones));
        }
        const [restauradosFuente] = await db.query(
          `UPDATE articulos_publicados
           SET descartado = 0
           WHERE fuente_id = ? AND descartado = 1 AND fecha_publicacion >= ?`,
          [source_id, inicioHoy]
        );
        return NextResponse.json({ message: "Fuente individual actualizada correctamente", restaurados: restauradosFuente.affectedRows || 0, pendientes });
      } catch (e) {
        console.error(`[RSS REFRESH SOURCE ERROR] Fuente ID ${source_id}:`, e.message);
        return NextResponse.json({ error: e.message || "No se pudo actualizar la fuente seleccionada" }, { status: 500 });
      }
    }
    
    if (body.action === "refresh") {
      const [fuentes] = await db.query(
        "SELECT id, url_feed, titulo FROM fuentes_rss WHERE usuario_id = ?",
        [userId]
      );

      if (!fuentes || fuentes.length === 0) {
        return NextResponse.json({ message: "No hay fuentes registradas para actualizar", nuevos: 0 });
      }

      let totalNuevas = 0;
      let totalPendientes = 0;
      const existentes = await obtenerClasificacionesExistentes(fuentes.map((fuente) => fuente.id));
      await Promise.all(fuentes.map(async (fuente) => {
        try {
          const feed = await intentarParsearFeed(fuente.url_feed);
          if (feed?.items && feed.items.length > 0) {
            const clasificaciones = await prepararClasificaciones(fuente.id, feed.items, existentes, { omitirIA: true });
            const { insertados } = await persistirArticulos(fuente.id, feed.items, clasificaciones, limiteFecha);
            totalNuevas += insertados;
            totalPendientes += clasificarPendientesEnSegundoPlano(fuente.id, extraerPendientes(clasificaciones));
          }
        } catch (e) {
          console.error(`[RSS REFRESH ERROR] Fuente ID ${fuente.id}:`, e.message);
        }
      }));
      let totalRestaurados = 0;
      if (body.restore_today) {
        const [restaurados] = await db.query(
          `UPDATE articulos_publicados a
           INNER JOIN fuentes_rss f ON a.fuente_id = f.id
           SET a.descartado = 0
           WHERE f.usuario_id = ? AND a.descartado = 1 AND a.fecha_publicacion >= ?`,
          [userId, inicioHoy]
        );
        totalRestaurados = restaurados.affectedRows || 0;
      }
      return NextResponse.json({ message: "Feeds actualizados y restaurados correctamente", nuevos: totalNuevas, restaurados: totalRestaurados, pendientes: totalPendientes });
    }

    const { url_feed } = body;
    if (!url_feed) {
      return NextResponse.json({ error: "La URL es obligatoria" }, { status: 400 });
    }

    const { feed, urlFinal } = await buscarFeedRSS(url_feed);

    if (!feed.items || feed.items.length === 0) {
      throw new Error("La URL es válida, pero no contiene artículos RSS disponibles.");
    }

    const [resFuente] = await db.query(
      "INSERT INTO fuentes_rss (usuario_id, titulo, url_feed, categoria) VALUES (?, ?, ?, ?)",
      [userId, feed.title || "Fuente RSS", urlFinal, body.categoria?.trim() || "General"]
    );

    const fuenteId = resFuente.insertId;

    const clasificaciones = await prepararClasificaciones(fuenteId, feed.items, new Map(), { omitirIA: true });
    const { insertados } = await persistirArticulos(fuenteId, feed.items, clasificaciones, limiteFecha, { soloInsertar: true });
    const totalNuevas = insertados;

    if (totalNuevas === 0) {
      await db.query("DELETE FROM fuentes_rss WHERE id = ? AND usuario_id = ?", [fuenteId, userId]);
      throw new Error("El feed no contiene artículos con enlaces válidos para mostrar.");
    }

    const pendientes = clasificarPendientesEnSegundoPlano(fuenteId, extraerPendientes(clasificaciones));

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
    const userId = session?.user?.id || 1;
    await ensureClassificationSchema();
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo");

    if (tipo === "fuentes") {
      const [fuentes] = await db.query(
        "SELECT id, titulo, url_feed, categoria FROM fuentes_rss WHERE usuario_id = ? ORDER BY id DESC",
        [userId]
      );
      return NextResponse.json(fuentes);
    }

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
        a.fuente_id,
        f.titulo AS fuente_nombre,
        f.url_feed AS fuente_url
       FROM articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       WHERE f.usuario_id = ? AND (a.descartado = 0 OR a.descartado IS NULL)
       ORDER BY a.fecha_publicacion DESC, a.id DESC`,
      [userId]
    );
    const filasReparadas = rows.map((row) => ({
      ...row,
      titulo: repararTextoMalDecodificado(row.titulo),
      resumen: repararTextoMalDecodificado(row.resumen),
      fuente_nombre: repararTextoMalDecodificado(row.fuente_nombre),
    }));
    return NextResponse.json(filasReparadas);
  } catch (error) {
    console.error("Error al obtener datos:", error);
    return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { id, leido, guardado, titulo, categoria, tipo } = body;

    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    if (tipo === "fuente") {
      await db.query(
        "UPDATE fuentes_rss SET titulo = COALESCE(?, titulo), categoria = COALESCE(?, categoria) WHERE id = ?",
        [titulo, categoria, id]
      );
      return NextResponse.json({ message: "Fuente actualizada correctamente" });
    }

    if (leido !== undefined) {
      await db.query("UPDATE articulos_publicados SET leido = ? WHERE id = ?", [leido ? 1 : 0, id]);
    }
    if (guardado !== undefined) {
      await db.query("UPDATE articulos_publicados SET guardado = ? WHERE id = ?", [guardado ? 1 : 0, id]);
    }

    return NextResponse.json({ message: "Artículo actualizado" });
  } catch (error) {
    console.error("Error al actualizar:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req) {
  const connection = await db.getConnection();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const tipo = searchParams.get("tipo");
    const deleteAll = searchParams.get("delete_all");

    if (deleteAll === "true") {
      const session = await auth();
      const userId = session?.user?.id ? Number(session.user.id) : 1;
      
      await connection.beginTransaction();
      try {
        await connection.query(
          `UPDATE articulos_publicados a 
           INNER JOIN fuentes_rss f ON a.fuente_id = f.id 
           SET a.descartado = 1 
           WHERE f.usuario_id = ?`,
          [userId]
        );
        await connection.commit();
      } catch (txError) {
        await connection.rollback();
        throw txError;
      } finally {
        connection.release();
      }
      return NextResponse.json({ message: "Todas las publicaciones fueron descartadas" });
    }

    if (!id) {
      connection.release();
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    if (tipo === "fuente") {
      await connection.beginTransaction();
      try {
        await connection.query("DELETE FROM articulos_publicados WHERE fuente_id = ?", [id]);
        await connection.query("DELETE FROM fuentes_rss WHERE id = ?", [id]);
        await connection.commit();
      } catch (txError) {
        await connection.rollback();
        throw txError;
      } finally {
        connection.release();
      }
      return NextResponse.json({ message: "Fuente y sus artículos eliminados por completo" });
    }

    connection.release();
    await db.query("UPDATE articulos_publicados SET descartado = 1 WHERE id = ?", [id]);
    return NextResponse.json({ message: "Artículo descartado" });
  } catch (error) {
    console.error("Error al eliminar:", error);
    connection.release();
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
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

const SIN_CLASIFICACION = { categoria: "General", metodo: "sin-ia", confianza: 0.1 };

// Modelos probados en orden: si uno fue retirado, está saturado o sin cuota, se intenta con el siguiente.
const MODELOS_GEMINI = ["gemini-2.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"];
const GEMINI_LOTE_TAMANO = 12;
const GEMINI_LOTE_MAX_TOKENS = 1200;
const GEMINI_LOTE_TIMEOUT_MS = 15000;

function construirInstruccionLote(noticias = []) {
  const listado = noticias
    .map((noticia, indice) => `[${indice}] Título: ${(noticia.titulo || "").slice(0, 300)}\n[${indice}] Resumen: ${(noticia.resumen || "").slice(0, 500)}`)
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
    if (!Array.isArray(arreglo)) throw new Error("Gemini no devolvió un arreglo JSON válido");
    return arreglo;
  };
  try {
    return validar(limpio);
  } catch {
    const coincidencia = limpio.match(/\[[\s\S]*\]/);
    if (coincidencia) return validar(coincidencia[0]);
    throw new Error("Gemini no devolvió un arreglo JSON válido");
  }
}

function extraerEsperaReintento(texto = "") {
  const coincidencia = texto.match(/retry in ([\d.]+)s/i);
  const segundos = coincidencia ? Number(coincidencia[1]) : NaN;
  if (!Number.isFinite(segundos)) return 12000;
  return Math.min(Math.max(segundos * 1000, 1000), 60000);
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      throw new Error(`Gemini rechazó la solicitud (HTTP ${response.status}); se aborta la cadena de modelos`, { cause: "fatal" });
    }
    if (response.status === 429) {
      const cuerpo = await response.text().catch(() => "");
      throw new Error(`Gemini sin cuota en ${modelo} (HTTP 429)`, { cause: { esperaMs: extraerEsperaReintento(cuerpo) } });
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

async function ejecutarCadenaGemini(apiKey, textoPrompt, maxTokens, timeoutMs) {
  let ultimoError = new Error("Gemini no respondió correctamente");
  for (const modelo of MODELOS_GEMINI) {
    try {
      return await llamarModeloGemini(apiKey, modelo, textoPrompt, maxTokens, timeoutMs);
    } catch (error) {
      ultimoError = error;
      if (error?.cause === "fatal") break;
      const esperaMs = error?.cause?.esperaMs;
      if (esperaMs) {
        console.warn(`Cuota excedida en ${modelo}; reintentando en ${Math.round(esperaMs / 1000)}s...`);
        await esperar(esperaMs);
        try {
          return await llamarModeloGemini(apiKey, modelo, textoPrompt, maxTokens, timeoutMs);
        } catch (errorReintento) {
          ultimoError = errorReintento;
          if (errorReintento?.cause === "fatal") break;
        }
      }
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
  const grupos = new Map();
  noticias.forEach((noticia, indice) => {
    const key = `${(noticia.titulo || "").trim()}\u0000${(noticia.resumen || "").trim()}`;
    const cached = clasificacionCache.get(key);
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
      const texto = await ejecutarCadenaGemini(apiKey, construirInstruccionLote(lote), GEMINI_LOTE_MAX_TOKENS, GEMINI_LOTE_TIMEOUT_MS);
      const propuestas = extraerArregloPropuesta(texto);
      const porIndice = new Map();
      for (const propuesta of propuestas) {
        if (propuesta && Number.isInteger(Number(propuesta.i))) porIndice.set(Number(propuesta.i), propuesta);
      }
      lote.forEach((item, posicion) => {
        const validada = validarPropuestaCategoria(porIndice.get(posicion));
        const resultado = validada || { ...SIN_CLASIFICACION };
        if (validada) clasificacionCache.set(item.key, resultado);
        item.indices.forEach((indice) => {
          resultados[indice] = resultado;
        });
      });
    } catch (error) {
      console.warn("Clasificación por lote falló; se usará 'General':", error.message);
      lote.forEach((item) => {
        item.indices.forEach((indice) => {
          resultados[indice] = { ...SIN_CLASIFICACION };
        });
      });
    }
  }
  return resultados;
}

async function obtenerClasificacionesExistentes(fuenteIds = []) {
  const mapa = new Map();
  const ids = [...new Set(fuenteIds.filter((id) => id !== undefined && id !== null))];
  if (ids.length === 0) return mapa;
  const [filas] = await db.query(
    `SELECT fuente_id, url_original, categoria, clasificacion_metodo, clasificacion_confianza
     FROM articulos_publicados WHERE fuente_id IN (?)`,
    [ids]
  );
  for (const fila of filas) {
    const confianza = Number(fila.clasificacion_confianza);
    mapa.set(`${fila.fuente_id}\u0000${fila.url_original}`, {
      categoria: fila.categoria || "General",
      metodo: fila.clasificacion_metodo || "sin-ia",
      confianza: Number.isFinite(confianza) ? confianza : 0.5,
    });
  }
  return mapa;
}

function normalizarItemNoticia(item = {}) {
  const link = limpiarUrlNoticia(item.link || item.guid || item.id || "");
  if (!link) return null;
  const rawResumen = item.contentSnippet || item.summary || item.content || item.description || "";
  return {
    link,
    titulo: item.title || "Sin título",
    resumen: rawResumen.replace(/<[^>]*>?/gm, "").substring(0, 300),
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
      resultados[posicion] = { ...previo, link: normalizado.link, titulo: normalizado.titulo, resumen: normalizado.resumen, esNuevo: false };
    } else {
      nuevos.push({ posicion, ...normalizado });
    }
  });

  const apiKey = process.env.GEMINI_API_KEY;
  let resultadosIA = nuevos.map(() => ({ ...SIN_CLASIFICACION }));
  if (apiKey && nuevos.length > 0 && !omitirIA) {
    resultadosIA = await clasificarLoteConIA(apiKey, nuevos);
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

async function bulkUpdateArticulos(fuenteId, filas, { conCategoria = false, soloCategoria = false } = {}) {
  if (filas.length === 0) return;
  const params = [];
  const agregarCasos = (obtenerValor) => {
    for (const fila of filas) params.push(fila.link, obtenerValor(fila));
    return `CASE url_original ${filas.map(() => "WHEN ? THEN ?").join(" ")} END`;
  };
  const asignaciones = [];
  if (!soloCategoria) {
    asignaciones.push(
      `titulo = ${agregarCasos((fila) => fila.titulo)}`,
      `resumen = ${agregarCasos((fila) => fila.resumen)}`,
      `fecha_publicacion = ${agregarCasos((fila) => fila.fechaPub)}`
    );
  }
  if (conCategoria || soloCategoria) {
    asignaciones.push(
      `categoria = ${agregarCasos((fila) => fila.categoria)}`,
      `clasificacion_metodo = ${agregarCasos((fila) => fila.metodo)}`,
      `clasificacion_confianza = ${agregarCasos((fila) => fila.confianza)}`
    );
  }
  if (!soloCategoria) asignaciones.push("descartado = 0");
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
     (fuente_id, titulo, resumen, url_original, fecha_publicacion, categoria, clasificacion_metodo, clasificacion_confianza, leido, guardado, descartado)
     VALUES ${filas.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)").join(", ")}`,
    filas.flatMap((fila) => [fuenteId, fila.titulo, fila.resumen, fila.link, fila.fechaPub, fila.categoria, fila.metodo, fila.confianza])
  );

  if (!soloInsertar) {
    await bulkUpdateArticulos(fuenteId, filas.filter((fila) => !fila.esNuevo), { conCategoria: false });
    await bulkUpdateArticulos(fuenteId, filas.filter((fila) => fila.esNuevo), { conCategoria: true });
  }
  return { insertados: insertRes.affectedRows || 0 };
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

function clasificarPendientesEnSegundoPlano(fuenteId, pendientes = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || pendientes.length === 0) return 0;
  clasificarLoteConIA(apiKey, pendientes)
    .then((resultados) => {
      const filas = [];
      pendientes.forEach((pendiente, indice) => {
        const resultado = resultados[indice];
        if (resultado?.metodo === "gemini") filas.push({ ...pendiente, ...resultado });
      });
      if (filas.length === 0) return null;
      return bulkUpdateArticulos(fuenteId, filas, { soloCategoria: true });
    })
    .catch((error) => console.error(`[IA FONDO] Fuente ID ${fuenteId}:`, error.message));
  return pendientes.length;
}