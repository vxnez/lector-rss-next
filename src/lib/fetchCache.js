// src/lib/fetchCache.js — Caché client-side para GETs del dashboard.
// Tres mecanismos, sin librerías:
// 1) Deduplicación de vuelos: dos llamadas idénticas en curso comparten una
//    sola petición (los toggles disparan refetch imperativo + efecto a la vez).
// 2) TTL por endpoint: fuentes/facetas/páginas se sirven de memoria y la UI
//    pinta instantáneo (stale-while-revalidate en page.js).
// 3) Versión global: cada mutación (bumpCacheVersion) invalida todo lo
//    cacheado para no mostrar conteos/categorías obsoletos. También se sube
//    al cambiar de usuario para no filtrar datos entre cuentas.
// Solo GET JSON. La señal de aborto cancela la espera del llamante, no el
// vuelo compartido (los demás siguen recibiendo su respuesta).

const vuelos = new Map(); // clave -> Promise
const memoria = new Map(); // clave -> { datos, expira }
const MAX_ENTRADAS = 100;

let version = 0;

export function bumpCacheVersion() {
  version += 1;
  // Poda perezosa de versiones viejas para acotar memoria.
  if (memoria.size > MAX_ENTRADAS) {
    const prefijo = `${version}|`;
    for (const clave of memoria.keys()) {
      if (!clave.startsWith(prefijo)) memoria.delete(clave);
      if (memoria.size <= MAX_ENTRADAS) break;
    }
  }
}

function claveDe(url) {
  return `${version}|${url}`;
}

function esperarAborto(signal) {
  if (!signal) return null;
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((_, rechazar) => {
    signal.addEventListener("abort", () => rechazar(new DOMException("Aborted", "AbortError")), {
      once: true,
    });
  });
}

/**
 * GET JSON con dedupe + TTL. Devuelve undefined si la respuesta no es ok o
 * la petición se aborta (los llamantes conservan su estado anterior).
 */
export async function fetchJson(url, { ttlMs = 0, signal } = {}) {
  const clave = claveDe(url);
  const ahora = Date.now();
  const hit = memoria.get(clave);
  if (hit && hit.expira > ahora) return hit.datos;

  let vuelo = vuelos.get(clave);
  if (!vuelo) {
    vuelo = (async () => {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return undefined;
      const datos = await res.json().catch(() => undefined);
      if (ttlMs > 0 && datos !== undefined) {
        memoria.set(clave, { datos, expira: Date.now() + ttlMs });
        if (memoria.size > MAX_ENTRADAS) {
          memoria.delete(memoria.keys().next().value);
        }
      }
      return datos;
    })();
    vuelos.set(clave, vuelo);
    vuelo.finally(() => {
      if (vuelos.get(clave) === vuelo) vuelos.delete(clave);
    }).catch(() => {});
  }

  const carrera = esperarAborto(signal);
  try {
    return carrera ? await Promise.race([vuelo, carrera]) : await vuelo;
  } catch (err) {
    if (err?.name === "AbortError") return undefined;
    throw err;
  }
}

/** Lee la entrada fresca sin red (para pintar instantáneo). */
export function leerCache(url) {
  const hit = memoria.get(claveDe(url));
  if (hit && hit.expira > Date.now()) return hit.datos;
  return undefined;
}

/** Precarga silenciosa (para prefetch de páginas vecinas). Nunca lanza. */
export function prefetchJson(url, { ttlMs = 30000 } = {}) {
  fetchJson(url, { ttlMs }).catch(() => {});
}
