// src/lib/api.js — Wrapper servidor -> API interna (servxn).
// Solo servidor: nunca importar desde componentes cliente ("use client").
// Añade `x-api-key: process.env.API_SECRET_KEY` a `process.env.API_URL`.
// Sin MySQL directo: todo acceso a datos pasa por este fetch.
if (typeof window !== "undefined") {
  throw new Error("lib/api solo puede usarse en el servidor.");
}

function baseUrl() {
  const base = (process.env.API_URL || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("API_URL no configurado.");
  return base;
}

function apiKey() {
  let key = (process.env.API_SECRET_KEY || "").trim();
  // Tolerancia a secretos pegados con comillas envolventes en el dashboard.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  if (!key) throw new Error("API_SECRET_KEY no configurado.");
  return key;
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reintentoTras(res, intento) {
  const header = res.headers?.get?.("retry-after");
  const seg = Number(header);
  if (Number.isFinite(seg) && seg >= 0 && seg <= 60) return seg * 1000;
  return Math.min(1000 * 2 ** intento, 8000);
}

export async function api(path, { method = "GET", body, query, timeoutMs = 30000 } = {}) {
  const base = baseUrl();
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const url = `${base}${path}${qs}`;
  const metodo = String(method || "GET").toUpperCase();
  let ultimoError = null;
  for (let intento = 0; intento < 3; intento++) {
    const ctrl = new AbortController();
    const temporizador = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey(),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        signal: ctrl.signal,
      });
    } catch (error) {
      clearTimeout(temporizador);
      // Timeout o corte de red: reintentar solo GET; otros métodos fallan rápido
      // con diagnóstico en vez de colgar la function de Vercel hasta 60s.
      if (error?.name === "AbortError") {
        const err = new Error(`API timeout (${timeoutMs}ms) en ${path}`);
        err.status = 504;
        if (metodo === "GET" && intento < 2) {
          await esperar(Math.min(1000 * 2 ** intento, 4000));
          continue;
        }
        throw err;
      }
      throw error;
    }
    clearTimeout(temporizador);
    if (res.status !== 429 && res.status !== 502 && res.status !== 503 && res.status !== 504) {
      const texto = await res.text().catch(() => "");
      let data = null;
      try {
        data = texto ? JSON.parse(texto) : null;
      } catch {
        data = { raw: texto };
      }
      if (!res.ok) {
        const mensaje =
          data?.error?.message ||
          data?.error ||
          data?.message ||
          data?.mensaje ||
          `API ${res.status} en ${path}`;
        const err = new Error(typeof mensaje === "string" ? mensaje : `API ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }
    // 429/5xx: solo reintentar si es seguro (GET siempre; POST solo en 429 no procesado).
    const seguro = metodo === "GET" || res.status === 429;
    await res.body?.cancel?.().catch(() => {});
    if (!seguro || intento === 2) {
      const err = new Error(`API ${res.status} en ${path}`);
      err.status = res.status;
      throw err;
    }
    ultimoError = res.status;
    await esperar(reintentoTras(res, intento));
  }
  const err = new Error(`API ${ultimoError || "429"} en ${path}`);
  err.status = ultimoError || 429;
  throw err;
}

// Caché corto en memoria (por instancia serverless): evita martillar
// /api/users en cada callback de sesión/signIn y reduce 429 del backend.
const cacheUsuarios = new Map();
const TTL_MS = 45 * 1000;

function leerCache(clave) {
  const entrada = cacheUsuarios.get(clave);
  if (!entrada) return null;
  if (Date.now() > entrada.exp) {
    cacheUsuarios.delete(clave);
    return null;
  }
  return entrada.valor;
}

function guardarCache(clave, valor) {
  if (cacheUsuarios.size > 500) cacheUsuarios.clear();
  cacheUsuarios.set(clave, { valor, exp: Date.now() + TTL_MS });
}

export function invalidarUsuarioCache(id, email) {
  if (id !== undefined && id !== null) cacheUsuarios.delete(`id:${String(id)}`);
  if (email) cacheUsuarios.delete(`email:${String(email).toLowerCase()}`);
}

function normalizarLista(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.fuentes)) return res.fuentes;
  if (Array.isArray(res?.articulos)) return res.articulos;
  if (Array.isArray(res?.articles)) return res.articles;
  if (Array.isArray(res?.users)) return res.users;
  if (Array.isArray(res?.usuarios)) return res.usuarios;
  return res;
}

// ---- Salud (GET /api/health no requiere key; /api/health/db sí) ----
export async function getHealth() {
  const base = baseUrl();
  const res = await fetch(`${base}/api/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health ${res.status}`);
  return res.json().catch(() => ({ ok: true }));
}

// ---- Usuarios ----
export async function getUser(id, { force = false } = {}) {
  const clave = `id:${String(id)}`;
  if (!force) {
    const hit = leerCache(clave);
    if (hit) return hit;
  }
  const data = await api(`/api/users/${encodeURIComponent(id)}`);
  const usuario = data?.user || data?.usuario || data;
  if (usuario?.id || usuario?.email) {
    guardarCache(clave, usuario);
    if (usuario.email) guardarCache(`email:${String(usuario.email).toLowerCase()}`, usuario);
  }
  return data;
}

export async function getUserByEmail(email, { force = false } = {}) {
  const correo = String(email || "").trim();
  if (!correo) return null;
  const clave = `email:${correo.toLowerCase()}`;
  // Rutas de escritura (signIn/register) usan force:true: decidir crear sobre
  // un fantasma cacheado (p. ej. cuenta recién eliminada) abre la app con un
  // id que ya no existe y sin fila nueva en la BD.
  if (!force) {
    const hit = leerCache(clave);
    if (hit) return hit;
  }
  // El backend soporta `?email=` filtrado en SQL (verificado 2026-09-19).
  // Si no hay coincidencia se devuelve null sin lanzar el listado completo.
  try {
    const res = await api("/api/users", { query: { email: correo } });
    const lista = normalizarLista(res);
    let hallado = null;
    if (Array.isArray(lista)) hallado = lista.find((u) => u?.email === correo) || null;
    else if (lista && typeof lista === "object" && lista.email) hallado = lista;
    if (hallado) {
      guardarCache(clave, hallado);
      if (hallado.id !== undefined) guardarCache(`id:${String(hallado.id)}`, hallado);
      return hallado;
    }
    // Sin coincidencia por filtro: no lanzar el listado completo aquí.
    // El listado completo es el que dispara 429 en el backend con muchos
    // usuarios; devolver null deja que signIn cree la cuenta OAuth.
    return null;
  } catch (error) {
    // 401/403 = API_SECRET_KEY rechazado: no ocultar el fallo de auth,
    // el llamante debe fallar cerrado con diagnóstico claro.
    if (Number(error?.status) === 401 || Number(error?.status) === 403) throw error;
    // 429 persistente tras reintentos: no escalar al listado completo.
    if (Number(error?.status) === 429) {
      console.warn("getUserByEmail limitado por backend (429), se omite listado completo.");
      return null;
    }
    // Se continúa con el listado completo solo en errores no limitantes.
  }
  // Intento 2: listado completo + búsqueda local (solo si el filtro falló sin 429).
  try {
    const res = await api("/api/users");
    const lista = normalizarLista(res);
    let hallado = null;
    if (Array.isArray(lista)) hallado = lista.find((u) => u?.email === correo) || null;
    if (hallado) {
      guardarCache(clave, hallado);
      if (hallado.id !== undefined) guardarCache(`id:${String(hallado.id)}`, hallado);
    }
    return hallado;
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
}

export async function createUser({ nombre, email, password, proveedor } = {}) {
  const body = { nombre, email, password };
  if (proveedor) body.proveedor = proveedor;
  const data = await api("/api/users", { method: "POST", body });
  const usuario = data?.user || data?.usuario || data;
  if (usuario?.id || usuario?.email) invalidarUsuarioCache(usuario?.id, usuario?.email || email);
  else if (email) invalidarUsuarioCache(null, email);
  return data;
}

export async function patchUser(id, patch = {}) {
  const data = await api(`/api/users/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
  invalidarUsuarioCache(id, data?.user?.email || data?.usuario?.email || data?.email || patch?.email);
  return data;
}

export async function deleteUser(id) {
  const data = await api(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
  invalidarUsuarioCache(id, null);
  return data;
}

// ---- Auth ----
export async function login(email, password) {
  const data = await api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return data?.user || data?.usuario || data;
}

export async function requestRecover(email) {
  return api("/api/auth/recover/request", { method: "POST", body: { email } });
}

export async function verifyRecover(email, code, newPassword) {
  return api("/api/auth/recover/verify", {
    method: "POST",
    body: { email, code, newPassword },
  });
}

// ---- Fuentes ----
export async function getFuentes(usuario_id) {
  const data = await api("/api/data/fuentes", {
    query: { usuario_id: String(usuario_id) },
  });
  return normalizarLista(data);
}

export async function createFuente({ usuario_id, titulo, url_feed, categoria } = {}) {
  return api("/api/data/fuentes", {
    method: "POST",
    body: { usuario_id, titulo, url_feed, categoria: categoria || "General" },
  });
}

export async function patchFuente(id, patch = {}) {
  return api(`/api/data/fuentes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
  });
}

// Parche masivo atómico del backend: una transacción todo-o-nada.
// 200 {ok, actualizadas, convert_full_page}; 404 {not_found, faltan} sin
// aplicar nada (máx 100). Solo reintenta ante 429 (no procesado).
export async function patchFuentesBulk(ids, usuario_id, convert_full_page) {
  const lista = [...new Set(
    (Array.isArray(ids) ? ids : [ids])
      .map((v) => Number(String(v).trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  )];
  if (lista.length === 0) {
    const err = new Error("IDs de fuente requeridos");
    err.status = 400;
    throw err;
  }
  if (lista.length > 100) {
    const err = new Error("Máximo 100 fuentes por lote");
    err.status = 400;
    throw err;
  }
  return api("/api/data/fuentes", {
    method: "PATCH",
    body: { usuario_id: String(usuario_id), ids: lista, convert_full_page },
  });
}

export async function deleteFuente(id, usuario_id) {
  // Se envía usuario_id por query Y por body: el backend puede leer uno u
  // otro según el handler (algunos solo leen query, otros solo body).
  const uid = usuario_id !== undefined && usuario_id !== null ? String(usuario_id) : undefined;
  return api(`/api/data/fuentes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    ...(uid !== undefined ? { query: { usuario_id: uid }, body: { usuario_id: uid } } : {}),
  });
}

// Borrado masivo atómico del backend: una transacción todo-o-nada.
// 200 {ok, eliminadas, articulos_eliminados}; 404 {error:not_found, faltan}
// sin borrar nada. Solo reintenta ante 429 (no procesado), así que no hay
// riesgo de doble borrado en 502/504.
export async function deleteFuentesBulk(ids, usuario_id) {
  const lista = [...new Set(
    (Array.isArray(ids) ? ids : [ids])
      .map((v) => Number(String(v).trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  )];
  if (lista.length === 0) {
    const err = new Error("IDs de fuente requeridos");
    err.status = 400;
    throw err;
  }
  return api("/api/data/fuentes", {
    method: "DELETE",
    query: { usuario_id: String(usuario_id), ids: lista.join(",") },
  });
}

// ---- Refresh (ingesta del backend) ----
export async function refreshFuentes(usuario_id, fuente_id, { timeoutMs = 55000 } = {}) {
  const uid = String(usuario_id);
  // POST preferido; el backend también acepta GET como variante.
  const body = { usuario_id: uid };
  if (fuente_id !== undefined && fuente_id !== null) body.fuente_id = fuente_id;
  try {
    return await api("/api/data/refresh", { method: "POST", body, timeoutMs });
  } catch (error) {
    if ([404, 405, 501].includes(Number(error?.status))) {
      const query = { usuario_id: uid };
      if (fuente_id !== undefined && fuente_id !== null) query.fuente_id = String(fuente_id);
      return await api("/api/data/refresh", { query, timeoutMs });
    }
    throw error;
  }
}

// ---- Artículos ----
function listaVacia(res) {
  const items = Array.isArray(res) ? res : res?.articulos || res?.articles || res?.data || [];
  return !Array.isArray(items) || items.length === 0;
}

export async function getArticulos({
  usuario_id,
  limit = 30,
  offset = 0,
  q,
  categoria,
  leido,
  guardado,
  order = "fecha_publicacion",
  dir = "DESC",
  modo_busqueda,
  reintentarSinFulltext = false,
} = {}) {
  const armarQuery = (conFulltext) => {
    const query = { usuario_id: String(usuario_id) };
    if (limit !== undefined) query.limit = String(limit);
    if (offset !== undefined) query.offset = String(offset);
    if (q) query.q = q;
    if (categoria) query.categoria = categoria;
    if (leido !== undefined && leido !== null && leido !== "") query.leido = String(leido);
    if (guardado !== undefined && guardado !== null && guardado !== "") query.guardado = String(guardado);
    if (order) query.order = order;
    if (dir) query.dir = dir;
    if (conFulltext && modo_busqueda) query.modo_busqueda = modo_busqueda;
    return query;
  };
  const usaFulltext = reintentarSinFulltext && modo_busqueda === "fulltext" && Boolean(q);
  if (!usaFulltext) {
    return api("/api/data/articulos", { query: armarQuery(Boolean(modo_busqueda)) });
  }
  // Fulltext con fallback LIKE pre-DDL: si el backend falla o devuelve vacío
  // (p. ej. palabras ≤3 letras o subcadenas que NATURAL LANGUAGE no matchea),
  // se reintenta una vez sin el parámetro. Resultado final idéntico.
  try {
    const res = await api("/api/data/articulos", { query: armarQuery(true) });
    if (listaVacia(res)) {
      return api("/api/data/articulos", { query: armarQuery(false) });
    }
    return res;
  } catch {
    return api("/api/data/articulos", { query: armarQuery(false) });
  }
}

export async function marcarArticulo(articulo_id, usuario_id, patch = {}) {
  return api(`/api/data/articulos/${encodeURIComponent(articulo_id)}`, {
    method: "PATCH",
    body: { usuario_id, ...patch },
  });
}

// ---- Stats ----
export async function getStats(usuario_id) {
  return api("/api/data/stats", { query: { usuario_id: String(usuario_id) } });
}

// ---- Progreso IA (telemetría barata: 1 COUNT en el backend) ----
export async function getIAProgreso(usuario_id) {
  return api("/api/ia/progreso", {
    query: { usuario_id: String(usuario_id) },
    timeoutMs: 8000,
  });
}
