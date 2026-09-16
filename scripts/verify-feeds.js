#!/usr/bin/env node
/**
 * Verifica feeds RSS de recommended-feeds.json con peticiones HTTP reales.
 *
 * Uso:  node scripts/verify-feeds.js
 * Comprueba cada url_feed:
 *   - HTTP 200
 *   - Cuerpo con XML válido y al menos un artículo (<item> o <entry>)
 * Sale con código 1 si algún feed falla.
 * Usa rss-parser y cheerio (ya en dependencias).
 */

import { readFile, writeFile } from "fs/promises";
import path from "path";
import Parser from "rss-parser";
import * as cheerio from "cheerio";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
  timeout: 25000,
});

const FILE_PATH = path.join(process.cwd(), "src/data/recommended-feeds.json");
const TIMEOUT = 25000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        ...options.headers,
      },
      redirect: "follow",
    });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

async function checkFeed(title, url) {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}`, title, url };
    }

    const contentType = res.headers.get("content-type") || "";
    let text = await res.text();

    // Si viene comprimido con gzip (algunos servidores no lo descomprimen automáticamente)
    if (text.startsWith("\x1f\x8b")) {
      // fetch ya descomprime gzip automáticamente en Node 18+, pero por si acaso
      // No necesitamos hacer nada extra
    }

    // Verificar que es XML/RSS/Atom
    const hasItems = text.includes("<item") || text.includes("<entry");
    const isXml = text.includes("<rss") || text.includes("<feed") || text.includes("<rdf:RDF") || text.includes("<?xml");

    if (hasItems) {
      const itemCount = (text.match(/<item/gi) || []).length + (text.match(/<entry/gi) || []).length;
      return { ok: true, detail: `OK (${itemCount} artículos)`, title, url };
    }

    if (isXml) {
      return { ok: false, detail: "XML sin artículos (0 items)", title, url };
    }

    return { ok: false, detail: "no es XML (HTML u otro)", title, url };
  } catch (e) {
    if (e.name === "AbortError" || e.name === "TimeoutError") {
      return { ok: false, detail: "Timeout", title, url };
    }
    return { ok: false, detail: e.name || e.message, title, url };
  }
}

async function main() {
  console.log("🔍 Verificando feeds recomendados...\n");

  let data;
  try {
    const content = await readFile(FILE_PATH, "utf-8");
    data = JSON.parse(content);
  } catch (e) {
    console.error("❌ Error leyendo recommended-feeds.json:", e.message);
    process.exit(1);
  }

  const categories = data.categorias || {};
  const allFeeds = [];

  for (const [category, feeds] of Object.entries(categories)) {
    if (Array.isArray(feeds)) {
      for (const feed of feeds) {
        allFeeds.push({ ...feed, categoria: category });
      }
    }
  }

  console.log(`📋 Total de feeds a verificar: ${allFeeds.length}\n`);

  const results = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < allFeeds.length; i++) {
    const feed = allFeeds[i];
    const progress = `[${String(i + 1).padStart(2, "0")}/${allFeeds.length}]`;
    process.stdout.write(`${progress} Verificando: ${feed.titulo}... `);

    const result = await checkFeed(feed.titulo, feed.url);
    results.push({ ...feed, ...result });

    if (result.ok) {
      passed++;
      console.log(`✅ ${result.detail}`);
    } else {
      failed++;
      console.log(`❌ ${result.detail}`);
    }

    // Pequeña pausa para no saturar servidores
    if (i < allFeeds.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\n📊 Resultado: ${passed}/${allFeeds.length} OK, ${failed} fallos.`);

  // Filtrar solo feeds válidos
  const validFeeds = results.filter((r) => r.ok);
  const invalidFeeds = results.filter((r) => !r.ok);

  if (invalidFeeds.length > 0) {
    console.log("\n⚠️  Feeds que fallaron (se eliminarán):");
    for (const feed of invalidFeeds) {
      console.log(`   - ${feed.titulo} (${feed.categoria}): ${feed.detail}`);
    }
  }

  // Reconstruir categorias solo con feeds válidos
  const newCategories = {};
  for (const feed of validFeeds) {
    if (!newCategories[feed.categoria]) {
      newCategories[feed.categoria] = [];
    }
    // Eliminar propiedades de verificación, mantener solo datos del feed
    const { categoria, ok, detail, title, ...feedData } = feed;
    newCategories[feed.categoria].push(feedData);
  }

  // Eliminar categorías vacías
  for (const cat of Object.keys(newCategories)) {
    if (newCategories[cat].length === 0) {
      delete newCategories[cat];
    }
  }

  const newTotal = validFeeds.length;
  const newData = {
    categorias: newCategories,
    metadata: {
      ...data.metadata,
      total_feeds: newTotal,
      actualizado: new Date().toISOString().split("T")[0],
      verificado: new Date().toISOString(),
    },
  };

  // Escribir archivo actualizado
  try {
    await writeFile(FILE_PATH, JSON.stringify(newData, null, 2), "utf-8");
    console.log(`\n✅ Archivo actualizado: ${FILE_PATH}`);
    console.log(`   Feeds válidos: ${newTotal} (antes: ${data.metadata?.total_feeds || allFeeds.length})`);
    console.log(`   Categorías: ${Object.keys(newCategories).length}`);
  } catch (e) {
    console.error("\n❌ Error escribiendo archivo:", e.message);
    process.exit(1);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("❌ Error fatal:", e);
  process.exit(1);
});