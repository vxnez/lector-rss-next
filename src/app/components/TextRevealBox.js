// src/app/components/TextRevealBox.js — Revelado palabra por palabra ligado al scroll.
// Equivalente nativo de skiper70 "Text reveal box" (Skiper UI — licencia free
// con atribución; inspirado en nvg8.io). Sin dependencias: el scroller escribe
// una var CSS (--reveal-p, 0..1) y cada palabra calcula su opacidad en puro
// CSS, sin re-renders durante el scroll. Respeta movimiento reducido.
"use client";

import { useEffect, useMemo, useRef } from "react";

function normalizarPalabra(palabra) {
  return String(palabra || "")
    .replace(/^[^a-záéíóúñü0-9]+|[^a-záéíóúñü0-9]+$/gi, "")
    .toLowerCase();
}

export default function TextRevealBox({
  texto,
  highlight = "",
  highlightTextClass = "",
  highlightBgClass = "",
  className = "",
  scrollerRef,
}) {
  const cajaRef = useRef(null);
  const palabras = useMemo(
    () => String(texto || "").split(/\s+/).filter(Boolean),
    [texto]
  );
  const marca = normalizarPalabra(highlight);
  const hlTexto = highlightTextClass || "text-[var(--accent-ink)]";
  const hlFondo = highlightBgClass || "bg-[var(--accent)]/25";

  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja) return undefined;
    const candidato = scrollerRef?.current;
    const scroller =
      candidato && candidato.scrollHeight > candidato.clientHeight + 1
        ? candidato
        : null;
    const actualizar = () => {
      let p = 1;
      if (scroller) {
        const max = scroller.scrollHeight - scroller.clientHeight;
        p = max > 0 ? Math.min(Math.max(scroller.scrollTop / max, 0), 1) : 1;
      } else if (typeof window !== "undefined") {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        p = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 1;
      }
      caja.style.setProperty("--reveal-p", String(p));
    };
    actualizar();
    const objetivo = scroller || window;
    objetivo.addEventListener("scroll", actualizar, { passive: true });
    window.addEventListener("resize", actualizar);
    return () => {
      objetivo.removeEventListener("scroll", actualizar);
      window.removeEventListener("resize", actualizar);
    };
  }, [scrollerRef, palabras.length]);

  return (
    <div ref={cajaRef} className={`reveal-box ${className}`}>
      {palabras.map((palabra, i) => {
        const esMarca = marca !== "" && normalizarPalabra(palabra) === marca;
        return (
          <span key={i}>
            <span
              aria-hidden={false}
              className={`reveal-word${esMarca ? ` rounded px-0.5 ${hlTexto} ${hlFondo}` : ""}`}
              style={{ "--i": i, "--n": palabras.length }}
            >
              {palabra}
            </span>
            {i < palabras.length - 1 ? " " : ""}
          </span>
        );
      })}
    </div>
  );
}
