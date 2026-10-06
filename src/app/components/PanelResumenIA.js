// src/app/components/PanelResumenIA.js — Resumen IA en panel lateral izquierdo.
// Espejo del índice derecho: fijo al borde (left-0) o flotante arrastrable +
// redimensionable, minimizable, en portal a <body> (fixed real a viewport),
// solo escritorio (xl+). Consume useResumenIA compartido con la sheet móvil.
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Pin, Move, RotateCw } from "lucide-react";
import { resumenPlano } from "./ResumenEstructurado";
import { useResumenIA } from "@/lib/hooks/useResumenIA";

const CLAVE_POS = "lector_resumen_pos";

function mensajeDiag(diag, t) {
  if (diag === "sin_clave") return t("lector.resumen_sin_clave");
  if (diag === "cuota") return t("lector.resumen_cuota");
  if (diag === "corto") return t("lector.resumen_corto");
  return t("lector.err_resumen");
}

export default function PanelResumenIA({ article, t }) {
  const [visible, setVisible] = useState(true);
  const [modo, setModo] = useState("fijo");
  const [pos, setPos] = useState(() => {
    try {
      const crudo = window.localStorage.getItem(CLAVE_POS);
      if (!crudo) return null;
      const p = JSON.parse(crudo);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      return {
        x: Math.min(Math.max(p.x, 8), Math.max(window.innerWidth - 120, 8)),
        y: Math.min(Math.max(p.y, 8), Math.max(window.innerHeight - 80, 8)),
      };
    } catch {
      return null;
    }
  });
  // En móvil el panel está oculto por CSS pero montado: no se infiere hasta
  // escritorio (la sheet móvil tiene su propia llamada).
  const [enEscritorio, setEnEscritorio] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 1280px)").matches
      : false
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mq = window.matchMedia("(min-width: 1280px)");
    const alCambiar = (e) => setEnEscritorio(e.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  const panelRef = useRef(null);
  const titulo = article?.titulo || "";
  const texto = resumenPlano(article?.resumen || "").slice(0, 2000);
  const { estado, puntos, diag, proveedor, reintentar } = useResumenIA(
    titulo,
    texto,
    visible && enEscritorio
  );

  const fijar = () => {
    try {
      const el = panelRef.current;
      if (el) {
        el.style.width = "";
        el.style.height = "";
      }
    } catch {
      // Las clases ya mandan.
    }
    setPos(null);
    setModo("fijo");
  };

  const iniciarArrastre = (event) => {
    if (modo !== "flotante") return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target && event.target.closest && event.target.closest("button")) return;
    event.preventDefault();
    const inicioX = event.clientX;
    const inicioY = event.clientY;
    const panel = event.currentTarget.closest("aside");
    const rect = panel ? panel.getBoundingClientRect() : null;
    if (!rect) return;
    const mover = (ev) => {
      const x = Math.min(Math.max(rect.left + (ev.clientX - inicioX), 8), window.innerWidth - 120);
      const y = Math.min(Math.max(rect.top + (ev.clientY - inicioY), 8), window.innerHeight - 80);
      setPos({ x, y });
      try {
        window.localStorage.setItem(CLAVE_POS, JSON.stringify({ x, y }));
      } catch {
        // Solo sesión.
      }
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  if (typeof document === "undefined") return null;
  if (!visible) {
    return createPortal(
      <button
        type="button"
        onClick={() => setVisible(true)}
        title={t("lector.resumen_ia")}
        aria-label={t("lector.resumen_ia")}
        className="btn-press fixed left-4 top-20 z-[60] hidden rounded-full border border-app-line bg-app-surface/70 p-2.5 text-app-muted shadow-xl backdrop-blur-md hover:text-app-fg xl:block"
      >
        <Sparkles size={15} />
      </button>,
      document.body
    );
  }

  return createPortal(
    <aside
      ref={panelRef}
      aria-label={t("lector.resumen_ia")}
      style={modo === "flotante" && pos ? { left: pos.x, top: pos.y, right: "auto" } : undefined}
      className={`fixed left-0 top-20 z-[60] hidden w-60 flex-col overflow-hidden rounded-r-2xl border border-l-0 border-app-line bg-app-surface/70 shadow-xl backdrop-blur-md xl:flex ${
        modo === "flotante"
          ? "max-h-[70dvh] min-h-[160px] max-w-[min(320px,calc(100vw-2rem))] min-w-[180px] resize overflow-auto rounded-l-2xl border-l"
          : "max-h-[calc(100dvh-7rem)]"
      }`}
    >
      <div
        onPointerDown={iniciarArrastre}
        className={`flex items-center gap-1.5 border-b border-app-line/70 px-3 py-2 ${
          modo === "flotante" ? "cursor-move touch-none select-none" : ""
        }`}
      >
        <Sparkles size={13} className="shrink-0 text-[var(--accent-ink)]" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-app-muted">
          {t("lector.resumen_ia")}
          {estado === "ok" && proveedor && ` · ${proveedor}`}
        </span>
        <button
          type="button"
          onClick={() => {
            if (modo === "fijo") setModo("flotante");
            else fijar();
          }}
          title={modo === "fijo" ? t("lector.indice_libre") : t("lector.indice_fijo")}
          aria-label={modo === "fijo" ? t("lector.indice_libre") : t("lector.indice_fijo")}
          aria-pressed={modo === "flotante"}
          className="btn-press shrink-0 rounded-md p-1 text-app-muted hover:bg-app-raised hover:text-app-fg"
        >
          {modo === "fijo" ? <Move size={13} /> : <Pin size={13} />}
        </button>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={t("comun.cerrar")}
          className="btn-press shrink-0 rounded-md p-1 text-app-muted hover:bg-app-raised hover:text-app-fg"
        >
          <X size={13} />
        </button>
      </div>
      <div className="scroll-sutil min-h-0 flex-1 overflow-y-auto p-3">
        {estado === "cargando" && (
          <div className="space-y-2.5" aria-label={t("lector.resumiendo")}>
            <p className="flex items-center gap-2 text-[11px] font-semibold text-app-muted">
              <Sparkles size={12} className="animate-pulse text-[var(--accent-ink)]" />
              {t("lector.resumiendo")}
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-9 rounded-lg" />
            ))}
          </div>
        )}
        {estado === "ok" && (
          <ul className="space-y-2">
            {puntos.map((p, i) => (
              <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-app-fg/95">
                <span aria-hidden="true" className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                <span className="min-w-0">{p}</span>
              </li>
            ))}
          </ul>
        )}
        {estado === "error" && diag === "sin_clave" ? (
          <div className="space-y-2">
            <p className="text-[12px] font-semibold leading-relaxed text-app-fg">
              {t("lector.resumen_configura")}
            </p>
            <p className="text-[11px] leading-relaxed text-app-muted">
              {t("lector.resumen_donde")}
            </p>
          </div>
        ) : (
          estado === "error" && (
            <div className="space-y-2.5">
              <p role="alert" className="text-[12px] leading-relaxed text-app-muted">
                {mensajeDiag(diag, t)}
              </p>
              <button
                type="button"
                onClick={reintentar}
                className="btn-press inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[var(--accent-strong)] px-3 py-1.5 text-[11px] font-semibold text-[var(--on-accent-strong)]"
              >
                <RotateCw size={12} />
                {t("lector.reintentar")}
              </button>
            </div>
          )
        )}
      </div>
    </aside>,
    document.body
  );
}
