// src/lib/temas.js — Catálogo de temas y persistencia (cliente).
// 12 temas simétricos: 6 oscuros + 6 claros. La transición visual la aporta
// la clase `tema-anim` en <html> (ver globals.css); aquí solo se alterna.
import { actualizarFavicon } from "./favicon";
export const TEMAS = [
  { id: "medianoche", nombre: "Medianoche", claro: false, bg: "#060b14", accent: "#38bdf8" },
  { id: "duna", nombre: "Duna", claro: false, bg: "#201d1b", accent: "#d08a52" },
  { id: "mineral", nombre: "Mineral", claro: false, bg: "#1b2229", accent: "#a8cbbf" },
  { id: "bosque", nombre: "Bosque", claro: false, bg: "#0f241c", accent: "#34d399" },
  { id: "ebano", nombre: "Ébano", claro: false, bg: "#0e0d16", accent: "#45c4b8" },
  { id: "obsidiana", nombre: "Obsidiana", claro: false, bg: "#0c0b09", accent: "#d4a24e" },
  { id: "celeste", nombre: "Celeste", claro: true, bg: "#f7f5f0", accent: "#0f766e" },
  { id: "menta", nombre: "Menta", claro: true, bg: "#f6f9f4", accent: "#2f6b3c" },
  { id: "celadon", nombre: "Celadón", claro: true, bg: "#f1f3ec", accent: "#3f7a44" },
  { id: "marfil", nombre: "Marfil", claro: true, bg: "#f3ede1", accent: "#8a5a2b" },
  { id: "vainilla", nombre: "Vainilla", claro: true, bg: "#faf3e3", accent: "#b45309" },
  { id: "alabastro", nombre: "Alabastro", claro: true, bg: "#ffffff", accent: "#3e7c5b" },
];

export const TEMA_POR_DEFECTO = "vainilla";
const CLAVE_TEMA = "lector_tema";

// Color de la barra del navegador por tema (meta theme-color).
export const THEME_COLORS = {
  medianoche: "#060b14",
  duna: "#201d1b",
  mineral: "#1b2229",
  bosque: "#0f241c",
  ebano: "#0e0d16",
  obsidiana: "#0c0b09",
  celeste: "#f7f5f0",
  menta: "#f6f9f4",
  celadon: "#f1f3ec",
  marfil: "#f3ede1",
  vainilla: "#faf3e3",
  alabastro: "#ffffff",
};

export function esTemaValido(id) {
  return TEMAS.some((t) => t.id === id);
}

export function temaGuardado() {
  return temaInicial();
}

// Tema del primer arranque (sin elección guardada): respeta
// prefers-color-scheme del SO (claro → menta, oscuro → medianoche).
// La elección manual posterior siempre gana y se persiste.
// (Legado: ya no decide el inicio; el defecto absoluto es Vainilla.)
export function temaPreferidoSistema() {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches
    ) {
      return "menta";
    }
  } catch {
    // Sin matchMedia: oscuro por defecto.
  }
  return TEMA_POR_DEFECTO;
}

export function temaInicial() {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TEMA);
    if (esTemaValido(guardado)) return guardado;
  } catch {
    // Sin almacenamiento: se cae a la preferencia del sistema.
  }
  // Sin elección guardada: Vainilla por defecto, sin excepción.
  return "vainilla";
}

// Aplica el tema al <html>: dataset para el CSS + persistencia + theme-color.
// Activa `tema-anim` ~350ms para una transición fluida de color (sin
// re-renders: solo variables CSS). Se omite con movimiento reducido.
export function aplicarTema(id) {
  const tema = TEMAS.find((t) => t.id === id) || TEMAS[0];
  try {
    const root = document.documentElement;
    const movimientoReducido =
      root.dataset.motion === "reduced" ||
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (!movimientoReducido) {
      root.classList.add("tema-anim");
      window.setTimeout(() => root.classList.remove("tema-anim"), 350);
    }
    root.dataset.theme = tema.id;
    if (tema.claro) root.dataset.temaClaro = "1";
    else delete root.dataset.temaClaro;
    window.localStorage.setItem(CLAVE_TEMA, tema.id);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[tema.id] || tema.bg);
    actualizarFavicon(tema.accent);
  } catch {
    // Sin DOM/almacenamiento: no se puede aplicar ni persistir.
  }
  return tema;
}
