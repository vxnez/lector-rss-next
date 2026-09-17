// src/lib/animaciones.js — Utilidades centrales de Anime.js (v4).
// Solo se animan propiedades GPU (transform y opacity). Nada de
// width/height/margin/top/left para evitar jank.
// Curvas: ease-out fuerte para entradas/respuestas, duraciones UI < 300ms
// salvo entradas escalonadas de lista. Respeta prefers-reduced-motion y
// el ajuste manual `lector_movimiento=reducido` (data-motion="reduced").
//
// API oficial v4 (import nombrado, sin default):
//   import { animate, stagger } from "animejs";

import { animate, stagger } from "animejs";

const EASE_ENTRADA = "outExpo"; // aprox. cubic-bezier(0.23, 1, 0.32, 1) del sistema
const EASE_MODAL = "outExpo";
const EASE_REBOTE_SUAVE = "outBack(1.4)"; // rebote ligero, sin exceso

export function movimientoReducidoActivo() {
  try {
    if (typeof document !== "undefined" && document.documentElement?.dataset?.motion === "reduced") {
      return true;
    }
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return true;
    }
    if (typeof window !== "undefined" && window.localStorage?.getItem("lector_movimiento") === "reducido") {
      return true;
    }
  } catch {
    // Sin matchMedia/almacenamiento: se anima por defecto.
  }
  return false;
}

/**
 * Entrada progresiva de tarjetas de noticias: fade-in + desplazamiento
 * vertical sutil con escalonado corto (30-50ms). Solo opacity/translate.
 * @param {HTMLElement} contenedor - grilla que contiene las tarjetas
 * @param {string} selector - selector de tarjetas dentro del contenedor
 */
export function animarEntradaTarjetas(contenedor, selector = ".tarjeta-noticia") {
  if (!contenedor || movimientoReducidoActivo()) return null;
  let tarjetas = [];
  try {
    tarjetas = Array.from(contenedor.querySelectorAll(selector));
  } catch {
    return null;
  }
  if (tarjetas.length === 0) return null;
  // Límite de escalonado: las tarjetas 9+ entran juntas para no ralentizar.
  try {
    return animate(tarjetas, {
      opacity: [0, 1],
      translateY: [14, 0],
      duration: 450,
      delay: stagger(40, { start: 0 }),
      ease: EASE_ENTRADA,
    });
  } catch {
    return null;
  }
}

/**
 * Apertura de modal de bienvenida/onboarding: overlay funde (opacity),
 * panel entra con escala 0.95->1 + translateY 10px->0 + opacity.
 */
export function animarAperturaModal(overlayEl, modalEl) {
  if (movimientoReducidoActivo()) return null;
  try {
    if (overlayEl) {
      animate(overlayEl, { opacity: [0, 1], duration: 180, ease: "outQuad" });
    }
    if (modalEl) {
      return animate(modalEl, {
        opacity: [0, 1],
        translateY: [10, 0],
        scale: [0.95, 1],
        duration: 280,
        ease: EASE_MODAL,
      });
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Cierre animado del modal (escala 1->0.96 + fade). Resuelve al terminar.
 * Si hay movimiento reducido, resuelve de inmediato.
 */
export function animarCierreModal(overlayEl, modalEl) {
  if (movimientoReducidoActivo()) return Promise.resolve();
  return new Promise((resolve) => {
    let terminado = false;
    const fin = () => {
      if (!terminado) {
        terminado = true;
        resolve();
      }
    };
    // Red de seguridad por si onComplete no dispara.
    const seguro = setTimeout(fin, 240);
    try {
      if (overlayEl) animate(overlayEl, { opacity: [1, 0], duration: 180, ease: "outQuad" });
      if (modalEl) {
        animate(modalEl, {
          opacity: [1, 0],
          translateY: [0, 8],
          scale: [1, 0.96],
          duration: 200,
          ease: "inQuad",
          onComplete: () => {
            clearTimeout(seguro);
            fin();
          },
        });
      } else {
        clearTimeout(seguro);
        fin();
      }
    } catch {
      clearTimeout(seguro);
      fin();
    }
  });
}

/**
 * Respuesta táctil en un botón: presiona a escala 0.96 (120ms) y suelta
 * con rebote ligero (spring suave). Solo transform. Devuelve limpieza.
 * @param {HTMLElement} el
 */
export function aplicarPressAnime(el) {
  if (!el || typeof el.addEventListener !== "function") return () => {};
  if (movimientoReducidoActivo()) return () => {};
  let presionado = false;

  const presionar = () => {
    if (presionado) return;
    presionado = true;
    try {
      animate(el, { scale: [1, 0.96], duration: 120, ease: "outQuad" });
    } catch {
      // Sin Anime.js disponible en este frame: el CSS :active cubre el feedback.
    }
  };
  const soltar = () => {
    if (!presionado) return;
    presionado = false;
    try {
      animate(el, { scale: [0.96, 1], duration: 220, ease: EASE_REBOTE_SUAVE });
    } catch {
      // Idem: fallback a la transición CSS de .btn-press.
    }
  };

  el.addEventListener("pointerdown", presionar);
  el.addEventListener("pointerup", soltar);
  el.addEventListener("pointerleave", soltar);
  el.addEventListener("pointercancel", soltar);
  return () => {
    el.removeEventListener("pointerdown", presionar);
    el.removeEventListener("pointerup", soltar);
    el.removeEventListener("pointerleave", soltar);
    el.removeEventListener("pointercancel", soltar);
  };
}

/**
 * Delegación global de microinteracciones para `.btn-press` dentro de un
 * alcance (por defecto todo el documento). Un solo par de listeners,
 * sin costo por botón. Devuelve limpieza. Ideal para llamarlo una vez
 * en el dashboard.
 * @param {ParentNode|Document} alcance
 */
export function inicializarMicrointeracciones(alcance) {
  const raiz = alcance || (typeof document !== "undefined" ? document : null);
  if (!raiz || typeof raiz.addEventListener !== "function") return () => {};
  if (movimientoReducidoActivo()) return () => {};

  const objetivo = (evento) => {
    try {
      const el = evento.target?.closest?.(".btn-press");
      return el && raiz.contains?.(el) ? el : null;
    } catch {
      return null;
    }
  };

  const alPresionar = (evento) => {
    const el = objetivo(evento);
    if (!el) return;
    try {
      animate(el, { scale: [1, 0.96], duration: 120, ease: "outQuad" });
    } catch {
      // Fallback CSS .btn-press:active.
    }
  };
  const alSoltar = (evento) => {
    const el = objetivo(evento);
    if (!el) return;
    try {
      animate(el, { scale: [0.96, 1], duration: 220, ease: EASE_REBOTE_SUAVE });
    } catch {
      // Fallback CSS.
    }
  };

  raiz.addEventListener("pointerdown", alPresionar, { passive: true });
  raiz.addEventListener("pointerup", alSoltar, { passive: true });
  raiz.addEventListener("pointercancel", alSoltar, { passive: true });
  return () => {
    raiz.removeEventListener("pointerdown", alPresionar);
    raiz.removeEventListener("pointerup", alSoltar);
    raiz.removeEventListener("pointercancel", alSoltar);
  };
}
