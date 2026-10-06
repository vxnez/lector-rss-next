// src/lib/temaAuth.js — Vainilla forzado en vistas de autenticación.
//
// Solo DOM (data-theme + theme-color): NO toca localStorage para no destruir
// la preferencia guardada del usuario. El dashboard la reaplica al montar
// (page.js: aplicarTema(tema) con temaInicial()), así que el forzado se
// autocorrige al entrar. Cubre /login, /register y /recuperar, que no
// inyectan public/tema-inicial.js (solo vive en el dashboard) y en una
// carga fresca pintaban el fallback oscuro del CSS base.
import { THEME_COLORS } from "./temas";

export const TEMA_AUTH = "vainilla";

export function forzarVainillaAuth() {
  try {
    const root = document.documentElement;
    root.dataset.theme = TEMA_AUTH;
    root.dataset.temaClaro = "1";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLORS[TEMA_AUTH]);
  } catch {
    // Sin DOM: nada que forzar.
  }
}
