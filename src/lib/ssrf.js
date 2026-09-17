// src/lib/ssrf.js — Guardia de egreso para los fetch server-side.
//
// Toda URL (inicial y cada redirección) debe usar http/https y resolver a
// IP pública: se rechazan loopback, RFC1918, link-local, CGNAT, multicast,
// reservadas y ::ffff mapeadas a rangos privados. Las redirecciones se
// siguen manualmente para revalidar cada salto (tope de saltos).
// Además se limita el tamaño del cuerpo para no amplificar memoria.
//
// Límite conocido: entre la validación DNS y la conexión, fetch resuelve
// de nuevo (TOCTOU/DNS-rebinding). Esto bloquea objetivos internos directos
// y cadenas de redirects simples; no sustituye un fetcher con IP pineada.
import dns from "node:dns/promises";

export const MAX_FETCH_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;

function ipv4APartes(ip) {
  const partes = ip.split(".");
  if (partes.length !== 4) return null;
  const octetos = partes.map((p) => Number(p));
  if (octetos.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
  return octetos;
}

function esIPv4Publica(ip) {
  const o = ipv4APartes(ip);
  if (!o) return false;
  const [a, b] = o;
  if (a === 10) return false; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return false; // 172.16.0.0/12
  if (a === 192 && b === 168) return false; // 192.168.0.0/16
  if (a === 127) return false; // loopback
  if (a === 0) return false; // 0.0.0.0/8
  if (a === 169 && b === 254) return false; // link-local (incl. metadata cloud)
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT 100.64.0.0/10
  if (a === 192 && b === 0 && (o[2] === 0 || o[2] === 2)) return false; // 192.0.0.0/24, TEST-NET-1
  if (a === 192 && b === 88 && o[2] === 99) return false; // 6to4 relay
  if (a === 192 && b >= 18 && b <= 19) return false; // benchmark 192.18.0.0/15
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmark 198.18.0.0/15
  if (a === 198 && b === 51 && o[2] === 100) return false; // TEST-NET-2
  if (a === 203 && b === 0 && o[2] === 113) return false; // TEST-NET-3
  if (a >= 224 && a <= 239) return false; // multicast
  if (a >= 240) return false; // reservadas/clase E
  return true;
}

function esIPv6Publica(ip) {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return false;
  if (v.startsWith("fe80:")) return false; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return false; // unique local
  if (v.startsWith("ff")) return false; // multicast
  const mapeada = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapeada) return esIPv4Publica(mapeada[1]);
  if (v.includes(".")) return false; // otras formas mixtas: denegar por defecto
  return true;
}

export function esIpPublica(ip) {
  if (typeof ip !== "string") return false;
  if (ip.includes(":")) return esIPv6Publica(ip);
  return esIPv4Publica(ip);
}

export async function assertUrlPublica(urlHref) {
  let url;
  try {
    url = new URL(urlHref);
  } catch {
    throw new Error("URL no válida.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Protocolo no válido.");
  }
  let registros;
  try {
    registros = await dns.lookup(url.hostname, { all: true });
  } catch {
    throw new Error("No se pudo resolver el host.");
  }
  if (!registros || registros.length === 0 || registros.some((r) => !esIpPublica(r.address))) {
    throw new Error("Host no permitido.");
  }
  return url.href;
}

// Fetch con redirecciones manuales revalidadas salto por salto.
// Devuelve { res, urlFinal }. Lanza Error con mensaje genérico.
export async function fetchPublico(urlInicial, { headers = {}, timeoutMs = 8000 } = {}) {
  let actual = urlInicial;
  for (let salto = 0; salto <= MAX_REDIRECTS; salto += 1) {
    await assertUrlPublica(actual);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(actual, { headers, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
    const destino = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && destino) {
      await res.arrayBuffer().catch(() => {});
      if (salto === MAX_REDIRECTS) throw new Error("Demasiadas redirecciones.");
      try {
        actual = new URL(destino, actual).href;
      } catch {
        return { res, urlFinal: actual };
      }
      continue;
    }
    return { res, urlFinal: actual };
  }
  throw new Error("Demasiadas redirecciones.");
}

export async function leerBufferLimitado(res, maxBytes = MAX_FETCH_BYTES) {
  const declarado = Number(res.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > maxBytes) {
    throw new Error("Respuesta demasiado grande.");
  }
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error("Respuesta demasiado grande.");
  }
  return buffer;
}

export async function leerTextoLimitado(res, maxBytes = MAX_FETCH_BYTES) {
  const buffer = await leerBufferLimitado(res, maxBytes);
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}
