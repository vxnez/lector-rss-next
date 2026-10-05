// src/lib/clavesIA.js — Claves de IA del usuario (solo este navegador).
// Nunca viajan al backend propio ni se guardan en BD: se adjuntan por
// petición a la route /api/rss, que las usa en vez de la key del servidor.
// Sin claves aquí, manda la key del servidor (IA_API_KEY/GEMINI_API_KEY).
"use client";

const CLAVE_STORAGE = "lector_ia_claves";

export const PROVEEDORES_IA_USUARIO = ["auto", "gemini", "groq"];

function limpiarProveedor(v) {
  const p = String(v || "").trim().toLowerCase();
  return PROVEEDORES_IA_USUARIO.includes(p) ? p : "auto";
}

function limpiarClave(v) {
  const s = String(v || "").trim();
  if (!s || s.length > 500) return "";
  return s;
}

export function leerClavesIA() {
  const base = { proveedor: "auto", gemini: "", groq: "" };
  try {
    if (typeof window === "undefined") return base;
    const crudo = window.localStorage.getItem(CLAVE_STORAGE);
    if (!crudo) return base;
    const d = JSON.parse(crudo);
    if (!d || typeof d !== "object") return base;
    return {
      proveedor: limpiarProveedor(d.proveedor),
      gemini: limpiarClave(d.gemini),
      groq: limpiarClave(d.groq),
    };
  } catch {
    return base;
  }
}

export function guardarClavesIA({ proveedor, gemini, groq } = {}) {
  const valor = {
    proveedor: limpiarProveedor(proveedor),
    gemini: limpiarClave(gemini),
    groq: limpiarClave(groq),
  };
  try {
    window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento: no persisten.
  }
  return valor;
}

// { proveedor, clave } listos para la petición, o {} si no hay claves.
// En "auto" con ambas, manda Gemini (paridad con el defecto del servidor).
export function authIA() {
  const c = leerClavesIA();
  if (c.proveedor === "gemini" && c.gemini) return { proveedor: "gemini", clave: c.gemini };
  if (c.proveedor === "groq" && c.groq) return { proveedor: "groq", clave: c.groq };
  if (c.gemini) return { proveedor: "gemini", clave: c.gemini };
  if (c.groq) return { proveedor: "groq", clave: c.groq };
  return {};
}

// Objeto listo para el body ({proveedor, clave_api} o {}) sin exponer
// la forma del storage a cada llamante.
export function paramsAuthIA() {
  const a = authIA();
  return a.clave ? { proveedor: a.proveedor, clave_api: a.clave } : {};
}
