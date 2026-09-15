// src/lib/useBloquearScroll.js — Bloquea el scroll del fondo mientras un
// panel/modal está abierto y lo restaura al cerrar (con conteo por si se
// solapan dos capas). Solo DOM: no dispara avisos de setState en efectos.
import { useEffect } from "react";

let capas = 0;
let overflowPrevio = "";

export function useBloquearScroll(activo) {
  useEffect(() => {
    if (!activo) return undefined;
    if (typeof document === "undefined") return undefined;
    if (capas === 0) {
      overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    capas++;
    return () => {
      capas = Math.max(0, capas - 1);
      if (capas === 0 && typeof document !== "undefined") {
        document.body.style.overflow = overflowPrevio;
      }
    };
  }, [activo]);
}
