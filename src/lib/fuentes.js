// src/lib/fuentes.js — Catálogo de tipografías de la app y persistencia (cliente).
// Momo Trust Display es la predeterminada absoluta; el usuario alterna entre
// las 5 desde Ajustes > Lectura. Se aplica vía dataset.fuente en <html> +
// --fuente-app en CSS (ver globals.css). Patrón espejo de lib/temas.js.
export const FUENTES = [
  { id: "momo", nombre: "Momo Trust Display", variable: "--font-momo", weights: [400] },
  { id: "line", nombre: "LINE Seed JP", variable: "--font-line", weights: [400, 700] },
  { id: "readex", nombre: "Readex Pro", variable: "--font-readex", weights: [400, 500, 600, 700] },
  { id: "calsans", nombre: "Cal Sans", variable: "--font-calsans", weights: [400] },
  { id: "pressstart", nombre: "Press Start 2P", variable: "--font-pressstart", weights: [400] },
];

export const FUENTE_POR_DEFECTO = "momo";
const CLAVE_FUENTE = "lector_fuente_app";

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
