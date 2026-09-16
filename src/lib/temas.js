// src/lib/temas.js — Catálogo de temas y persistencia (cliente).
import { actualizarFavicon } from "./favicon";
export const TEMAS = [
  { id: "medianoche", nombre: "Medianoche", claro: false, bg: "#070b12", accent: "#27a9e8" },
  { id: "duna", nombre: "Duna", claro: false, bg: "#211f1f", accent: "#c47d50" },
  { id: "mineral", nombre: "Mineral", claro: false, bg: "#1d2b26", accent: "#bdd9d7" },
  { id: "bosque", nombre: "Bosque", claro: false, bg: "#132a22", accent: "#28b330" },
  { id: "ebano", nombre: "Ébano", claro: false, bg: "#191827", accent: "#36b4ae" },
  { id: "celeste", nombre: "Celeste", claro: true, bg: "#e6e7da", accent: "#5c6850" },
  { id: "menta", nombre: "Menta", claro: true, bg: "#e2ede9", accent: "#2c4a3e" },
  { id: "celadon", nombre: "Celadón", claro: true, bg: "#e0f0dd", accent: "#277636" },
];

export const TEMA_POR_DEFECTO = "medianoche";
const CLAVE_TEMA = "lector_tema";

// Color de la barra del navegador por tema (meta theme-color).
export const THEME_COLORS = {
  medianoche: "#070b12",
  duna: "#211f1f",
  mineral: "#1d2b26",
  bosque: "#132a22",
  ebano: "#191827",
  celeste: "#e6e7da",
  menta: "#e2ede9",
  celadon: "#e0f0dd",
};

export function esTemaValido(id) {
  return TEMAS.some((t) => t.id === id);
}

export function temaGuardado() {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TEMA);
    return esTemaValido(guardado) ? guardado : TEMA_POR_DEFECTO;
  } catch {
    return TEMA_POR_DEFECTO;
  }
}

// Aplica el tema al <html>: dataset para el CSS + persistencia + theme-color.
export function aplicarTema(id) {
  const tema = TEMAS.find((t) => t.id === id) || TEMAS[0];
  try {
    document.documentElement.dataset.theme = tema.id;
    if (tema.claro) document.documentElement.dataset.temaClaro = "1";
    else delete document.documentElement.dataset.temaClaro;
    window.localStorage.setItem(CLAVE_TEMA, tema.id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[tema.id] || tema.bg);
    actualizarFavicon(tema.accent);
  } catch {
    // Sin DOM/almacenamiento: no se puede aplicar ni persistir.
  }
  return tema;
}
