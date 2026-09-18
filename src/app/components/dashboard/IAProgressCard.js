// src/app/components/dashboard/IAProgressCard.js — Notificación persistente del
// progreso de categorización IA en segundo plano: contador en vivo
// (procesadas de total + pendientes), barra proporcional y cierre automático
// al finalizar con éxito. Los errores quedan fijos hasta descartarlos. Se
// puede minimizar a un badge compacto (con pulso mientras hay actividad) y
// re-expandir con un clic.
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, CheckCheck, AlertCircle, Minus } from "lucide-react";

const DIAG_VALIDOS = new Set(["sin_clave", "auth", "cuota", "red", "respuesta"]);

export default function IAProgressCard({ progreso, onCerrar, t }) {
  const [minimizada, setMinimizada] = useState(false);
  const estadoPrevio = useRef(progreso?.estado);

  // Desvanecido automático solo en éxito; el error persiste hasta cerrarlo.
  const terminada = progreso?.estado === "ok";
  useEffect(() => {
    if (!terminada) return undefined;
    const temporizador = setTimeout(() => onCerrar?.(), 6000);
    return () => clearTimeout(temporizador);
  }, [terminada, onCerrar]);

  // Una ejecución nueva re-expande la tarjeta.
  useEffect(() => {
    if (progreso?.estado === "en_curso" && estadoPrevio.current !== "en_curso") {
      setMinimizada(false);
    }
    estadoPrevio.current = progreso?.estado;
  }, [progreso?.estado]);

  if (!progreso) return null;

  const fallida = progreso.estado === "error";
  const enCurso = progreso.estado === "en_curso";
  const diag = DIAG_VALIDOS.has(progreso.diag) ? progreso.diag : null;

  if (minimizada) {
    return (
      <button
        type="button"
        onClick={() => setMinimizada(false)}
        title={t("ia_bar.expandir")}
        aria-label={`${t("ia_bar.expandir")}: ${t("ia_bar.titulo")}`}
        className="anim-toast fixed top-5 right-5 z-[70] grid h-11 w-11 place-content-center rounded-full border shadow-2xl toast-app"
      >
        <span className="relative" aria-hidden="true">
          <span className="text-violet-300 [html[data-tema-claro='1']_&]:text-violet-700">
            {fallida ? <AlertCircle size={18} /> : terminada ? <CheckCheck size={18} /> : <Sparkles size={18} />}
          </span>
          {enCurso && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" />
            </span>
          )}
        </span>
      </button>
    );
  }

  const total = Number(progreso.total) || 0;
  const procesadas = Number(progreso.procesadas) || 0;
  const pendientes = progreso.pendientes === null || progreso.pendientes === undefined
    ? null
    : Number(progreso.pendientes) || 0;
  const fraccion = total > 0 ? Math.max(0, Math.min(1, procesadas / total)) : 0;
  const indeterminado = total <= 0;

  const detalle = fallida
    ? (diag ? t(`avisos.ia_err_${diag}`) : t("avisos.ia_err"))
    : terminada
      ? (procesadas > 0 ? t("avisos.ia_ok", { n: procesadas }) : t("avisos.ia_sin_pendientes"))
      : pendientes === null
        ? t("ia_bar.lanzando")
        : t("ia_bar.avance", { a: procesadas, total, p: pendientes });

  return (
    <div
      role="status"
      aria-live="polite"
      translate="no"
      className="anim-toast notranslate fixed top-5 right-5 z-[70] w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border px-4 py-3 shadow-2xl toast-app"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0 text-violet-300 [html[data-tema-claro='1']_&]:text-violet-700" aria-hidden="true">
          {fallida ? <AlertCircle size={16} /> : terminada ? <CheckCheck size={16} /> : <Sparkles size={16} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {terminada ? t("ia_bar.ok") : t("ia_bar.titulo")}
          </p>
          <p className="mt-0.5 text-xs opacity-80">{detalle}</p>
          <div
            role="progressbar"
            aria-label={t("ia_bar.titulo")}
            aria-valuemin={0}
            aria-valuemax={indeterminado ? undefined : total}
            aria-valuenow={indeterminado ? undefined : procesadas}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-500/20 [html[data-tema-claro='1']_&]:bg-violet-600/20"
          >
            <div
              className={`h-full rounded-full bg-violet-500 [html[data-tema-claro='1']_&]:bg-violet-600 ${indeterminado ? "w-full animate-pulse" : "transition-[width] duration-500"}`}
              style={indeterminado ? undefined : { width: `${Math.round(fraccion * 100)}%` }}
            />
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <button
            type="button"
            onClick={() => setMinimizada(true)}
            title={t("ia_bar.minimizar")}
            aria-label={t("ia_bar.minimizar")}
            className="btn-press rounded-lg p-1 opacity-70 hover:opacity-100"
          >
            <Minus size={14} />
          </button>
          {(terminada || fallida) && (
            <button
              type="button"
              onClick={onCerrar}
              aria-label={t("ia_bar.cerrar")}
              className="btn-press rounded-lg p-1 opacity-70 hover:opacity-100"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
