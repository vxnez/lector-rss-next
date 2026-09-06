// src/app/api/rss/route.js
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import Parser from "rss-parser";
import * as cheerio from "cheerio";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  },
});

const HEADERS_BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

function clasificarCategoriaPorTexto(titulo = "", resumen = "") {
  const texto = `${titulo} ${resumen}`.toLowerCase();

  if (/espacio|nasa|bepicolombo|mercurio|saturno|planeta|universo|cientifico|investigacion cientifica|astronomia|fisica|quimica|estudio revela/.test(texto)) {
    return "Ciencia";
  }
  if (/movil|moviles|telefono|telefonos|smartphone|celulares|celular|ios|android|xiaomi|samsung|apple|iphone|poco|snapdragon|mediatek|bootloader|apple watch|smartwatch/.test(texto)) {
    return "Celulares";
  }
  if (/computadora|computadoras|pc|laptop|portatil|windows|linux|macbook|gpu|cpu|procesador|hardware|kindle/.test(texto)) {
    return "Computadoras";
  }
  if (/gobierno|sanchez|feijoo|presidente|ministro|congreso|elecciones|partido|ley|politica|parlamento|marruecos|ceuta|melilla|diplomacia|milei/.test(texto)) {
    return "Política";
  }
  if (/ambiental|medio ambiente|ecologia|reciclaje|cambio climatico|sostenibilidad|sustentable|naturaleza|contaminacion|verde/.test(texto)) {
    return "Cuidado ambiental";
  }
  if (/ejercicio|entrenamiento|fitness|nutricion|dieta|gimnasio|muscular|bienestar fisico|correr/.test(texto)) {
    return "Cuidado físico";
  }
  if (/futbol|liga|real madrid|barcelona|champions|deporte|tenis|atleta|seleccion|mundial|formula 1|baloncesto/.test(texto)) {
    return "Deportes";
  }
  if (/salud|hospital|medico|virus|enfermedad|trasplante|medicina|doctor|farmaco|clinica/.test(texto)) {
    return "Salud";
  }
  if (/economia|inflacion|banco|empleo|mercado|empresa|hacienda|bolsa|finanzas|crisis|dinero|inversiones/.test(texto)) {
    return "Economía";
  }
  if (/accesorio|gadget|audifonos|auricular|bluetooth|mochila|guantes inteligentes/.test(texto)) {
    return "Uso personal";
  }
  if (/rutina|hogar|cocina|casa|consejo|tips|vida cotidiana|habitos/.test(texto)) {
    return "Vida diaria";
  }
  if (/ia|inteligencia artificial|chatgpt|openai|software|app|aplicacion|ciber|red|internet|tecnologia|codigo|programacion|algoritmo|camaras de vigilancia/.test(texto)) {
    return "Tecnología";
  }

  return "General";
}

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
  let url = urlRaw.trim();
  url = url.replace(/^(https?:?\/*)?/, "");
  return `https://${url}`;
}

async function obtenerTextoDecodificado(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { 
      headers: HEADERS_BROWSER, 
      redirect: "follow",
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`Error HTTP: ${res.status}`);
    
    const buffer = await res.arrayBuffer();
    let decoder = new TextDecoder("utf-8", { fatal: false });
    let text = decoder.decode(buffer);
    
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("iso-8859-1") || contentType.includes("windows-1252")) {
      try {
        const latinDecoder = new TextDecoder("windows-1252");
        text = latinDecoder.decode(buffer);
      } catch (e) {}
    }
    
    return text;
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
    const xmlText = await obtenerTextoDecodificado(url);
    const feed = await parser.parseString(xmlText);
    if (feed && feed.items && feed.items.length > 0) {
      return feed;
    }
  } catch (e) {
    try {
      const feed = await parser.parseURL(url);
      if (feed && feed.items && feed.items.length > 0) return feed;
    } catch (parseErr) {}
  }
  return null;
}

async function buscarFeedRSS(urlIngresada) {
  const urlLimpia = limpiarUrl(urlIngresada);

  let feed = await intentarParsearFeed(urlLimpia);
  if (feed) return { feed, urlFinal: urlLimpia };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(urlLimpia, { 
      headers: HEADERS_BROWSER, 
      redirect: "follow",
      signal: controller.signal 
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      const rssHref =
        $('link[type="application/rss+xml"]').attr("href") ||
        $('link[type="application/atom+xml"]').attr("href");

      if (rssHref) {
        const urlAbsoluta = new URL(rssHref, urlLimpia).href;
        feed = await intentarParsearFeed(urlAbsoluta);
        if (feed) return { feed, urlFinal: urlAbsoluta };
      }

      const enlaces = $("a[href]").map((_, el) => $(el).attr("href")).get();
      for (const href of enlaces) {
        if (href.endsWith(".xml") || href.includes("/rss") || href.includes("/feed")) {
          try {
            const urlAbsoluta = new URL(href, urlLimpia).href;
            feed = await intentarParsearFeed(urlAbsoluta);
            if (feed) return { feed, urlFinal: urlAbsoluta };
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    console.warn("Error leyendo HTML:", err.message);
  }

  const origin = new URL(urlLimpia).origin;
  const candidatos = [
    `${urlLimpia}/index.xml`,
    `${origin}/rss/feed.xml`,
    `${origin}/feeds/rss.xml`,
    `${origin}/mundo/rss.xml`,
    `${origin}/rss.xml`,
    `${origin}/index.xml`,
    `${origin}/feed`,
    `${origin}/rss`,
  ];

  for (const ruta of candidatos) {
    feed = await intentarParsearFeed(ruta);
    if (feed) return { feed, urlFinal: ruta };
  }

  throw new Error("No se pudo detectar un feed RSS válido en esta URL.");
}

export async function POST(req) {
  try {
    const session = await auth();
    const userId = session?.user?.id || 1;

    const body = await req.json().catch(() => ({}));

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
        if (feed?.items && feed.items.length > 0) {
          for (const item of feed.items) {
            const linkNormalizado = limpiarUrlNoticia(item.link || item.guid || item.id || "");
            if (!linkNormalizado) continue;

            const rawResumen = item.contentSnippet || item.summary || item.content || item.description || "";
            const resumenLimpio = rawResumen.replace(/<[^>]*>?/gm, "").substring(0, 300);
            
            let fechaPub = new Date();
            if (item.pubDate && !isNaN(Date.parse(item.pubDate))) {
              fechaPub = new Date(item.pubDate);
            } else if (item.isoDate && !isNaN(Date.parse(item.isoDate))) {
              fechaPub = new Date(item.isoDate);
            }

            if (isNaN(fechaPub.getTime()) || fechaPub < limiteFecha) {
              fechaPub = new Date();
            }

            const categoriaArticulo = clasificarCategoriaPorTexto(item.title || "", resumenLimpio);

            const [result] = await db.query(
              `INSERT IGNORE INTO articulos_publicados 
               (fuente_id, titulo, resumen, url_original, fecha_publicacion, categoria, leido, guardado, descartado) 
               VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`,
              [source_id, item.title || "Sin título", resumenLimpio, linkNormalizado, fechaPub, categoriaArticulo]
            );

            if (result.affectedRows === 0) {
              await db.query(
                `UPDATE articulos_publicados 
                 SET descartado = 0 
                 WHERE url_original = ? AND fuente_id = ?`,
                [linkNormalizado, source_id]
              );
            }
          }
        }
        return NextResponse.json({ message: "Fuente individual actualizada correctamente" });
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
      for (const fuente of fuentes) {
        try {
          const feed = await intentarParsearFeed(fuente.url_feed);
          if (feed?.items && feed.items.length > 0) {
            for (const item of feed.items) {
              const linkNormalizado = limpiarUrlNoticia(item.link || item.guid || item.id || "");
              if (!linkNormalizado) continue;

              const rawResumen = item.contentSnippet || item.summary || item.content || item.description || "";
              const resumenLimpio = rawResumen.replace(/<[^>]*>?/gm, "").substring(0, 300);
              
              let fechaPub = new Date();
              if (item.pubDate && !isNaN(Date.parse(item.pubDate))) {
                fechaPub = new Date(item.pubDate);
              } else if (item.isoDate && !isNaN(Date.parse(item.isoDate))) {
                fechaPub = new Date(item.isoDate);
              }

              if (isNaN(fechaPub.getTime()) || fechaPub < limiteFecha) {
                fechaPub = new Date();
              }

              const categoriaArticulo = clasificarCategoriaPorTexto(item.title || "", resumenLimpio);

              const [result] = await db.query(
                `INSERT IGNORE INTO articulos_publicados 
                 (fuente_id, titulo, resumen, url_original, fecha_publicacion, categoria, leido, guardado, descartado) 
                 VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`,
                [fuente.id, item.title || "Sin título", resumenLimpio, linkNormalizado, fechaPub, categoriaArticulo]
              );

              if (result.affectedRows > 0) {
                totalNuevas++;
              } else {
                await db.query(
                  `UPDATE articulos_publicados 
                   SET descartado = 0 
                   WHERE url_original = ? AND fuente_id = ?`,
                  [linkNormalizado, fuente.id]
                );
              }
            }
          }
        } catch (e) {
          console.error(`[RSS REFRESH ERROR] Fuente ID ${fuente.id}:`, e.message);
        }
      }
      return NextResponse.json({ message: "Feeds actualizados y restaurados correctamente", nuevos: totalNuevas });
    }

    const { url_feed } = body;
    if (!url_feed) {
      return NextResponse.json({ error: "La URL es obligatoria" }, { status: 400 });
    }

    const { feed, urlFinal } = await buscarFeedRSS(url_feed);

    const [resFuente] = await db.query(
      "INSERT INTO fuentes_rss (usuario_id, titulo, url_feed, categoria) VALUES (?, ?, ?, ?)",
      [userId, feed.title || "Fuente RSS", urlFinal, "General"]
    );

    const fuenteId = resFuente.insertId;

    if (feed.items && feed.items.length > 0) {
      for (const item of feed.items) {
        const linkNormalizado = limpiarUrlNoticia(item.link || item.guid || item.id || "");
        if (!linkNormalizado) continue;

        const rawResumen = item.contentSnippet || item.summary || item.content || item.description || "";
        const resumenLimpio = rawResumen.replace(/<[^>]*>?/gm, "").substring(0, 300);
        
        let fechaPub = new Date();
        if (item.pubDate && !isNaN(Date.parse(item.pubDate))) {
          fechaPub = new Date(item.pubDate);
        } else if (item.isoDate && !isNaN(Date.parse(item.isoDate))) {
          fechaPub = new Date(item.isoDate);
        }

        if (isNaN(fechaPub.getTime()) || fechaPub < limiteFecha) {
          fechaPub = new Date();
        }

        const categoriaArticulo = clasificarCategoriaPorTexto(item.title || "", resumenLimpio);

        await db.query(
          `INSERT IGNORE INTO articulos_publicados 
           (fuente_id, titulo, resumen, url_original, fecha_publicacion, categoria, leido, guardado, descartado) 
           VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`,
          [fuenteId, item.title || "Sin título", resumenLimpio, linkNormalizado, fechaPub, categoriaArticulo]
        );
      }
    }

    return NextResponse.json({ message: "Fuente agregada con éxito" }, { status: 201 });
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
        f.titulo AS fuente_nombre
       FROM articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       WHERE f.usuario_id = ? AND (a.descartado = 0 OR a.descartado IS NULL)
       ORDER BY a.fecha_publicacion DESC, a.id DESC`,
      [userId]
    );
    return NextResponse.json(rows);
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