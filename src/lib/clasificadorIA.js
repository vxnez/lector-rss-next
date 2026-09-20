// src/lib/clasificadorIA.js — Clasificación por lotes con IA (Gemini/Groq).
// Solo servidor: nunca importar desde componentes cliente ("use client").
// Sin MySQL directo: recibe {id, titulo, resumen} y devuelve resultados que el
// llamante persiste vía API interna (PATCH /api/data/articulos/:id).
// Porteado del pipeline pre-migración: catálogo cerrado, cadena de modelos con
// fail-fast ante 429, caché en memoria solo de éxitos.
import { CATALOGO_PROMPT, CATEGORIAS_DISPONIBLES } from "./categoryClassifier";

const CLASIFICACION_CACHE_MAX = 2000;
const clasificacionCache = new Map();

function cacheClasificacionGet(key) {
  const hit = clasificacionCache.get(key);
  if (hit) {
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

export const SIN_CLASIFICACION = { categoria: "General", metodo: "sin-ia", confianza: 0.1 };

const MODELOS_GEMINI = ["gemini-3.5-flash-lite", "gemini-2.5-flash"];
// (Los llama-3.x fueron dados de baja por Groq el 16/08/2026; estos son los vigentes.)
const MODELOS_GROQ = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"];

export function configIA() {
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

const GEMINI_LOTE_TAMANO = 24;
const GEMINI_LOTE_MAX_TOKENS = 2200;
// Tope por llamada: con fail-fast ante 429, el peor caso por petición ronda 2
// llamadas y cabe holgado en el maxDuration (60 s) del serverless. La espera
// de cuota la hace el cliente entre lotes.
const GEMINI_LOTE_TIMEOUT_MS = 20000;

function normalizarCategoriaLocal(valor = "") {
  return String(valor || "")
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

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
      throw new Error(`Gemini rechazó la solicitud (HTTP ${response.status}); se aborta la cadena de modelos`, {
        cause: { fatal: true, codigo: "auth" },
      });
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
        // Clasificar titulares es trivial: razonamiento mínimo para responder
        // en segundos en vez de decenas de segundos.
        reasoning_effort: "low",
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
    if (!response.ok) {
      // Modelo retirado o inexistente: se prueba el siguiente y, si ninguno
      // sirve, diag 'modelo'.
      const cuerpoError = await response.text().catch(() => "");
      if (response.status === 404 || /model_not_found|does not exist|decommissioned|deprecated/i.test(cuerpoError)) {
        throw new Error(`${cfg.etiqueta} retiró el modelo ${modelo} (HTTP ${response.status})`, { cause: { codigo: "modelo" } });
      }
      throw new Error(`${cfg.etiqueta} respondió HTTP ${response.status} con ${modelo}`);
    }
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
    (categoria) => normalizarCategoriaLocal(categoria) === normalizarCategoriaLocal(nombre)
  );
  if (!categoriaValida) return null;
  const confianzaNumerica = Number(propuesta.confianza);
  return {
    categoria: categoriaValida,
    metodo: "gemini",
    confianza: Number.isFinite(confianzaNumerica) ? Math.max(0, Math.min(1, confianzaNumerica)) : 0.5,
  };
}

export async function clasificarLoteConIA(apiKey, noticias) {
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
        const mensaje = error?.message || "";
        if (codigo === "auth" || codigo === "cuota" || codigo === "modelo") {
          falloCodigo = codigo;
        } else if (error?.name === "AbortError") {
          falloCodigo = "red";
        } else if (/HTTP 40[013]/.test(mensaje)) {
          falloCodigo = "auth";
        } else if (/429|cuota/i.test(mensaje)) {
          falloCodigo = "cuota";
        } else if (/HTTP 404|model_not_found|does not exist|decommissioned|deprecated/i.test(mensaje)) {
          falloCodigo = "modelo";
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
