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

export async function api(path, { method = "GET", body, query } = {}) {
  const base = baseUrl();
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const url = `${base}${path}${qs}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
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
export async function getUser(id) {
  return api(`/api/users/${encodeURIComponent(id)}`);
}

export async function getUserByEmail(email) {
  const correo = String(email || "").trim();
  if (!correo) return null;
  // Intento 1: filtro por query (si el backend lo soporta).
  try {
    const res = await api("/api/users", { query: { email: correo } });
    const lista = normalizarLista(res);
    if (Array.isArray(lista)) return lista.find((u) => u?.email === correo) || null;
    if (lista && typeof lista === "object" && lista.email) return lista;
  } catch (error) {
    // 401/403 = API_SECRET_KEY rechazado: no ocultar el fallo de auth,
    // el llamante debe fallar cerrado con diagnóstico claro.
    if (Number(error?.status) === 401 || Number(error?.status) === 403) throw error;
    // Se continúa con el listado completo.
  }
  // Intento 2: listado completo + búsqueda local.
  try {
    const res = await api("/api/users");
    const lista = normalizarLista(res);
    if (Array.isArray(lista)) return lista.find((u) => u?.email === correo) || null;
    return null;
  } catch (error) {
    if (Number(error?.status) === 404) return null;
    throw error;
  }
}

export async function createUser({ nombre, email, password, proveedor } = {}) {
  const body = { nombre, email, password };
  if (proveedor) body.proveedor = proveedor;
  return api("/api/users", { method: "POST", body });
}

export async function patchUser(id, patch = {}) {
  return api(`/api/users/${encodeURIComponent(id)}`, { method: "PATCH", body: patch });
}

export async function deleteUser(id) {
  return api(`/api/users/${encodeURIComponent(id)}`, { method: "DELETE" });
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

export async function deleteFuente(id, usuario_id) {
  const query = usuario_id !== undefined ? { usuario_id: String(usuario_id) } : undefined;
  return api(`/api/data/fuentes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    ...(query ? { query } : {}),
  });
}

// ---- Artículos ----
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
} = {}) {
  const query = { usuario_id: String(usuario_id) };
  if (limit !== undefined) query.limit = String(limit);
  if (offset !== undefined) query.offset = String(offset);
  if (q) query.q = q;
  if (categoria) query.categoria = categoria;
  if (leido !== undefined && leido !== null && leido !== "") query.leido = String(leido);
  if (guardado !== undefined && guardado !== null && guardado !== "") query.guardado = String(guardado);
  if (order) query.order = order;
  if (dir) query.dir = dir;
  return api("/api/data/articulos", { query });
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
