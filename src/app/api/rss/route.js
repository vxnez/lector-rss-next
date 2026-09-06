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
  return clasificarCategoriaPonderada(titulo, resumen);
  const texto = `${titulo} ${resumen}`.toLowerCase();

  // --- CIENCIA Y ESPACIO ---
  if (/espacio|nasa|esa|spacex|bepicolombo|mercurio|saturno|marte|planeta|galaxia|universo|cientifico|investigacion cientifica|astronomia|astrofisica|fisica|quimica|biologia|fosil|especie invasora|arqueologia|estudio revela|hallazgo cientifico|laboratorio/.test(texto)) {
    return "Ciencia";
  }


  const CATEGORIAS_ARTICULOS = [
    { nombre: "Inteligencia Artificial", palabras: ["inteligencia artificial", "machine learning", "aprendizaje automatico", "chatgpt", "openai", "gemini", "claude", "deepseek", "copilot", "modelo de lenguaje", "chatbot", "algoritmo generativo"] },
    { nombre: "Ciberseguridad", palabras: ["ciberseguridad", "ciberataque", "hackeo", "hacker", "ransomware", "malware", "phishing", "vulnerabilidad", "robo de datos", "brecha de seguridad", "contraseña", "privacidad digital"] },
    { nombre: "Videojuegos", palabras: ["videojuego", "gaming", "gamer", "nintendo", "playstation", "ps5", "xbox", "steam", "valve", "esports", "e-sports", "game pass", "zelda", "mario", "fortnite", "minecraft", "call of duty"] },
    { nombre: "Celulares", palabras: ["smartphone", "celular", "telefono movil", "movil", "iphone", "ipad", "ios", "android", "xiaomi", "samsung galaxy", "oppo", "vivo", "huawei", "honor", "motorola", "snapdragon", "mediatek", "smartwatch", "wearable"] },
    { nombre: "Computadoras", palabras: ["computadora", "ordenador", "pc", "laptop", "portatil", "windows", "linux", "ubuntu", "macos", "macbook", "gpu", "cpu", "procesador", "tarjeta grafica", "nvidia", "amd", "intel", "hardware", "periferico", "monitor", "teclado mecanico"] },
    { nombre: "Tecnología", palabras: ["tecnologia", "internet", "fibra optica", "software", "programacion", "codigo", "app", "aplicacion", "redes sociales", "tiktok", "instagram", "facebook", "google", "meta", "satelite", "robotica", "dron", "gadgets"] },
    { nombre: "Ciencia y Espacio", palabras: ["nasa", "esa", "spacex", "espacio", "astronomia", "astrofisica", "planeta", "galaxia", "universo", "marte", "luna", "agujero negro", "fisica", "quimica", "biologia", "fosil", "laboratorio", "investigacion cientifica", "hallazgo cientifico", "arqueologia"] },
    { nombre: "Política", palabras: ["gobierno", "presidente", "primer ministro", "ministro", "congreso", "senado", "parlamento", "elecciones", "candidato", "partido politico", "ley", "decreto", "politica", "diplomacia", "milei", "trump", "biden", "putin", "zelenski", "union europea", "otan", "geopolitica", "embajada"] },
    { nombre: "Economía y Finanzas", palabras: ["economia", "inflacion", "banco central", "banco", "empleo", "desempleo", "mercado", "empresa", "startup", "hacienda", "impuesto", "bolsa", "acciones", "wall street", "finanzas", "dinero", "inversion", "criptomoneda", "bitcoin", "ethereum", "pib", "hipoteca"] },
    { nombre: "Deportes", palabras: ["futbol", "futbol americano", "touchdown", "liga", "real madrid", "barcelona", "champions league", "copa del mundo", "mundial", "deporte", "tenis", "atleta", "seleccion", "formula 1", "f1", "baloncesto", "nba", "beisbol", "mlb", "boxeo", "ufc", "rally", "ciclismo", "olimpiadas"] },
    { nombre: "Salud y Medicina", palabras: ["salud", "hospital", "medico", "virus", "bacteria", "enfermedad", "infeccion", "trasplante", "medicina", "doctor", "farmaco", "medicamento", "clinica", "psicologia", "salud mental", "ansiedad", "depresion", "cancer", "vacuna", "oms", "sintoma", "tratamiento"] },
    { nombre: "Fitness y Nutrición", palabras: ["ejercicio", "entrenamiento", "fitness", "nutricion", "dieta", "gimnasio", "musculo", "bienestar fisico", "correr", "running", "cardio", "proteina", "perder peso", "adelgazar"] },
    { nombre: "Medio Ambiente", palabras: ["medio ambiente", "ecologia", "reciclaje", "cambio climatico", "calentamiento global", "sostenibilidad", "sustentable", "naturaleza", "contaminacion", "energia renovable", "energia solar", "fauna silvestre", "especies en peligro", "ecosistema", "deforestacion"] },
    { nombre: "Cultura y Arte", palabras: ["cultura", "arte", "pintura", "museo", "literatura", "libro", "novela", "poesia", "teatro", "arquitectura", "exposicion", "escultura", "patrimonio"] },
    { nombre: "Cine y Series", palabras: ["cine", "pelicula", "serie", "streaming", "netflix", "hbo", "disney", "oscar", "premios goya", "actor", "actriz", "director de cine", "trailer"] },
    { nombre: "Música", palabras: ["musica", "concierto", "banda", "album", "cantante", "festival musical", "gira", "cancion", "rapero", "salsa", "rock"] },
    { nombre: "Sociedad y Sucesos", palabras: ["sociedad", "suceso", "tribunal", "juez", "sentencia", "delito", "policia", "guardia civil", "detenido", "asesinato", "robo", "accidente", "bomberos", "rescate", "manifestacion", "huelga", "protesta", "inmigracion", "refugiados", "derechos humanos"] },
    { nombre: "Gastronomía", palabras: ["gastronomia", "cocina", "receta", "restaurante", "chef", "comida", "bebida", "vino", "cerveza", "postre", "reposteria"] },
    { nombre: "Viajes y Turismo", palabras: ["viaje", "turismo", "turista", "hotel", "vuelo", "aerolinea", "destino turistico", "mochilero", "excursion", "senderismo", "guia de viajes", "vacaciones"] },
    { nombre: "Motor", palabras: ["automovil", "coche", "vehiculo", "motor", "motocicleta", "moto", "electrico", "tesla", "volkswagen", "toyota", "concesionario", "formula 1"] },
    { nombre: "Educación", palabras: ["educacion", "universidad", "escuela", "colegio", "estudiante", "profesor", "docente", "beca", "examen", "investigacion academica", "campus"] },
    { nombre: "Moda y Belleza", palabras: ["moda", "belleza", "cosmetica", "maquillaje", "perfume", "ropa", "desfile", "diseñador", "piel", "cabello"] },
    { nombre: "Hogar y Vida Diaria", palabras: ["hogar", "casa", "rutina", "vida cotidiana", "habitos", "decoracion", "bricolaje", "jardineria", "limpieza del hogar", "mascotas", "perros", "gatos"] },
    { nombre: "Ciencia Ficción y Fantasía", palabras: ["ciencia ficcion", "sci-fi", "fantasia epica", "star wars", "star trek", "marvel", "dc comics", "superheroe", "tolkien", "señor de los anillos", "juego de rol", "dungeons and dragons"] },
  ];

  function normalizarTexto(texto = "") {
    return texto
      .toLocaleLowerCase("es")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9ñ\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clasificarCategoriaPonderada(titulo = "", resumen = "") {
    const tituloNormalizado = normalizarTexto(titulo);
    const resumenNormalizado = normalizarTexto(resumen);
    const resultados = CATEGORIAS_ARTICULOS.map((categoria, indice) => {
      const puntuacion = categoria.palabras.reduce((total, palabra) => {
        const palabraNormalizada = normalizarTexto(palabra);
        const coincidenciaTitulo = tituloNormalizado.includes(palabraNormalizada);
        const coincidenciaResumen = resumenNormalizado.includes(palabraNormalizada);
        return total + (coincidenciaTitulo ? 5 : 0) + (coincidenciaResumen ? 1 : 0);
      }, 0);

      return { nombre: categoria.nombre, puntuacion, indice };
    });

    resultados.sort((a, b) => b.puntuacion - a.puntuacion || a.indice - b.indice);
    return resultados[0].puntuacion > 0 ? resultados[0].nombre : "General";
  }
  // --- CELULARES Y DISPOSITIVOS MÓVILES ---
  if (/movil(es)?|telefono(s)?|smartphone(s)?|celular(es)?|ios|android|xiaomi|samsung|apple|iphone|poco|oppo|vivo|huawei|honor|motorola|snapdragon|mediatek|bootloader|custom rom|apple watch|smartwatch(es)?|wearable(s)?|tableta(s)?|ipad/.test(texto)) {
    return "Celulares";
  }

  // --- COMPUTADORAS Y HARDWARE ---
  if (/computadora(s)?|pc|laptop(s)?|portatil(es)?|windows|linux|ubuntu|debian|macos|macbook|gpu|cpu|procesador(es)?|tarjeta grafica|nvidia|amd|intel|hardware|componentes|perifericos|teclado mecanico|mouse|monitor(es)?|kindle|e-reader/.test(texto)) {
    return "Computadoras";
  }

  // --- POLÍTICA NACIONAL E INTERNACIONAL ---
  if (/gobierno|sanchez|feijoo|presidente|primer ministro|ministro(s)?|congreso|senado|parlamento|elecciones|candidato(s)?|partido politico|ley(es)?|decreto|politica|diplomacia|marruecos|ceuta|melilla|milei|trump|biden|putin|zelenski|union europea|otan|geopolitica|guerra|conflicto armado|embajada/.test(texto)) {
    return "Política";
  }

  // --- ECONOMÍA Y FINANZAS ---
  if (/economia|inflacion|banco(s)?|banco central|empleo|desempleo|mercado(s)?|empresa(s)?|startup(s)?|hacienda|impuesto(s)?|bolsa( de valores)?|acciones|wall street|finanzas|crisis economica|dinero|inversion(es)?|criptomoneda(s)?|bitcoin|ethereum|pib/.test(texto)) {
    return "Economía";
  }

  // --- DEPORTES ---
  if (/futbol|fútbol americano|touchdown|liga|real madrid|barcelona|champions league|copa del mundo|mundial|deporte(s)?|tenis|atleta(s)?|seleccion|formula 1|f1|baloncesto|nba|beisbol|mlb|boxeo|ufc|rally|ciclis(mo|tas)|olimpiadas|juegos olimpicos/.test(texto)) {
    return "Deportes";
  }

  // --- SALUD Y MEDICINA ---
  if (/salud|hospital(es)?|medico(s)?|virus|bacterias|enfermedad(es)?|infeccion|trasplante|medicina|doctor(es)?|farmaco(s)?|medicamento(s)?|clinica(s)?|psicologia|salud mental|ansiedad|depresion|cancer|vacuna(s)?|OMS/.test(texto)) {
    return "Salud";
  }

  // --- CUIDADO FÍSICO Y FITNESS ---
  if (/ejercicio|entrenamiento|fitness|nutricion|dieta(s)?|gimnasio|musculo(s)?|bienestar fisico|correr|running|cardio|proteina(s)?|perder peso|adelgazar/.test(texto)) {
    return "Cuidado físico";
  }

  // --- CUIDADO AMBIENTAL Y ECOLOGÍA ---
  if (/ambiental|medio ambiente|ecologia|reciclaje|cambio climatico|calentamiento global|sostenibilidad|sustentable|naturaleza|contaminacion|energia renovable|energia solar|fauna silvestre|especies en peligro|ecosistema/.test(texto)) {
    return "Cuidado ambiental";
  }

  // --- CULTURA, ARTE Y ENTRETENIMIENTO ---
  if (/cultura|arte|pintura|museo(s)?|literatura|libro(s)?|novela(s)?|poesia|cine|pelicula(s)?|serie(s)?|streaming|netflix|hbo|disney|oscar|premios goya|musica|concierto(s)?|banda(s)?|album|cantant(e|es)|festival|teatro|arquitectura/.test(texto)) {
    return "Cultura y Entretenimiento";
  }

  // --- VIDEOJUEGOS Y GAMING ---
  if (/videojuego(s)?|gaming|gamer(s)?|nintendo|playstation|ps5|xbox|steam|valve|epic games|twitch|esports|gamepass|zelda|mario|call of duty|fortnite|juego indie/.test(texto)) {
    return "Videojuegos";
  }

  // --- SOCIEDAD Y SUCESOS ---
  if (/sociedad|sucesos|tribunales|juez|sentencia|delito|policia|guardia civil|detenido(s)?|asesinato|robo|investigacion policial|accidente(s)?|bomberos|rescate|manifestacion|huelga|protesta|inmigracion|refugiados|derechos humanos/.test(texto)) {
    return "Sociedad y Sucesos";
  }

  // --- CIENCIA FICCIÓN Y FANTASY ---
  if (/ciencia ficcion|sci-fi|fantasy|fantasia epica|star wars|star trek|marvel|dc comics|superheroe(s)?|tolkien|el señor de los anillos|wargame(s)?|juego de rol|dnd|dungeons and dragons/.test(texto)) {
    return "Ciencia Ficción y Fantasía";
  }

  // --- GASTRONOMÍA Y COCINA ---
  if (/gastronomia|cocina(r)?|receta(s)?|restaurante(s)?|chef|comida|bebida|vino(s)?|cerveza artesanal|postre(s)?|reposteria|nutricion culinaria/.test(texto)) {
    return "Gastronomía";
  }

  // --- VIAJES Y TURISMO ---
  if (/viaje(s)?|turismo|turista(s)?|hotel(es)?|vuelo(s)?|aerolinea(s)?|destino turistico|mochilero|excursion|senderismo|guia de viajes|vacaciones/.test(texto)) {
    return "Viajes";
  }

  // --- USO PERSONAL Y ACCESORIOS (GADGETS) ---
  if (/accesorio(s)?|gadget(s)?|audifonos|auricular(es)?|cascos inalambricos|bluetooth|mochila(s)?|guantes inteligentes|reloj(es)? analogicos|billetera(s)?|gafas de sol|maleta(s)?/.test(texto)) {
    return "Uso personal";
  }

  // --- VIDA DIARIA Y HOGAR ---
  if (/rutina(s)?|hogar|casa|reencuentro familiar|consejo(s)?|tips|vida cotidiana|habitos|decoracion|bricolaje|jardineria|limpieza del hogar|mascotas|perros|gatos/.test(texto)) {
    return "Vida diaria";
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
                 SET categoria = ?, descartado = 0 
                 WHERE url_original = ? AND fuente_id = ?`,
               [categoriaArticulo, linkNormalizado, source_id]
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
                   SET categoria = ?, descartado = 0 
                   WHERE url_original = ? AND fuente_id = ?`,
                  [categoriaArticulo, linkNormalizado, fuente.id]
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
        a.fuente_id,
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