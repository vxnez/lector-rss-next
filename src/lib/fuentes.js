// src/lib/fuentes.js — Catálogo de tipografías de la app y persistencia (cliente).
// Momo Trust Display es la predeterminada absoluta; el usuario alterna entre
// las 5 desde Ajustes > Lectura. Se aplica vía dataset.fuente en <html> +
// --fuente-app en CSS (ver globals.css). Patrón espejo de lib/temas.js.
export const FUENTES = [
  { id: "readex", nombre: "Readex Pro", variable: "--font-readex", weights: [400, 500, 600, 700] },
  { id: "momo", nombre: "Momo Trust Display", variable: "--font-momo", weights: [400] },
  { id: "line", nombre: "LINE Seed JP", variable: "--font-line", weights: [400, 700] },
  { id: "calsans", nombre: "Cal Sans", variable: "--font-calsans", weights: [400] },
  { id: "pressstart", nombre: "Press Start 2P", variable: "--font-pressstart", weights: [400] },
];

export const FUENTE_POR_DEFECTO = "readex";
const CLAVE_FUENTE = "lector_fuente_app";

// Tamaño base global de texto (px): escala toda la app porque las
// utilidades tipográficas usan rem anclado al font-size del <html>.
export const FUENTE_PX_DEFECTO = 16;
export const FUENTE_PX_MIN = 12;
export const FUENTE_PX_MAX = 24;
const CLAVE_FUENTE_PX = "lector_fuente_px";

export function normalizarFuentePx(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return FUENTE_PX_DEFECTO;
  return Math.min(Math.max(Math.round(n), FUENTE_PX_MIN), FUENTE_PX_MAX);
}

export function fuentePxInicial() {
  try {
    return normalizarFuentePx(window.localStorage.getItem(CLAVE_FUENTE_PX));
  } catch {
    return FUENTE_PX_DEFECTO;
  }
}

// Aplica el tamaño base al <html> (los rem de Tailwind escalan con él) +
// persistencia. No dispara refetch: es solo presentación.
export function aplicarFuentePx(px) {
  const normalizado = normalizarFuentePx(px);
  try {
    document.documentElement.style.setProperty("--font-size-base", `${normalizado}px`);
    window.localStorage.setItem(CLAVE_FUENTE_PX, String(normalizado));
  } catch {
    // Sin DOM/almacenamiento: no se puede aplicar ni persistir.
  }
  return normalizado;
}

export function esFuenteValida(id) {
  return FUENTES.some((f) => f.id === id);
}

export function fuenteGuardada() {
  return fuenteInicial();
}

export function fuenteInicial() {
  try {
    const guardada = window.localStorage.getItem(CLAVE_FUENTE);
    if (esFuenteValida(guardada)) return guardada;
  } catch {
    // Sin almacenamiento: predeterminada absoluta.
  }
  return FUENTE_POR_DEFECTO;
}

// Aplica la fuente al <html> (dataset para el CSS) + persistencia.
export function aplicarFuente(id) {
  const fuente = FUENTES.find((f) => f.id === id) || FUENTES[0];
  try {
    document.documentElement.dataset.fuente = fuente.id;
    window.localStorage.setItem(CLAVE_FUENTE, fuente.id);
  } catch {
    // Sin DOM/almacenamiento: no se puede aplicar ni persistir.
  }
  return fuente;
}
