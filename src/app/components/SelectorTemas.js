// src/app/components/SelectorTemas.js — Selector de temas integrado al panel.
// 12 temas en 2 grupos simétricos (6 oscuros + 6 claros) con muestra de
// color por variable CSS. Sincronización instantánea vía onTema → aplicarTema.
"use client";

import { TEMAS } from "@/lib/temas";
import { useIdioma } from "@/lib/i18n";
import MorphIcon from "./MorphIcon";
import { Circle as CircleData, CheckCircle2 as CheckCircleData } from "lucide";

export default function SelectorTemas({ tema, onTema }) {
  const { t } = useIdioma();
  const oscuros = TEMAS.filter((t) => !t.claro);
  const claros = TEMAS.filter((t) => t.claro);

  const renderBoton = (item) => {
    const activo = tema === item.id;
    const modo = item.claro ? t("ajustes.claro") : t("ajustes.oscuro");
    return (
      <button
        key={item.id}
        type="button"
        role="radio"
        aria-checked={activo}
        aria-label={`${item.nombre}, ${modo}`}
        title={`${item.nombre} · ${item.bg} / ${item.accent}`}
        onClick={() => onTema(item.id)}
        className={[
          "group flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left",
          "transition-colors duration-200 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
          activo
            ? "border-[var(--accent)]/60 bg-transparent"
            : "border-transparent bg-transparent hover:bg-app-raised/40",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-content-center rounded-lg border border-app-line"
          style={{ backgroundColor: item.bg }}
        >
          <span
            className="block h-3.5 w-3.5 rounded-full border border-white/20"
            style={{ backgroundColor: item.accent }}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight text-app-fg">
            {item.nombre}
          </span>
          <span className="block truncate text-xs font-medium text-app-muted">
            {modo}
          </span>
        </span>
        <MorphIcon
          icon={activo ? CheckCircleData : CircleData}
          size={18}
          strokeWidth={2.5}
          className={
            activo
              ? "shrink-0 text-[var(--accent)]"
              : "shrink-0 text-app-muted group-hover:text-app-fg"
          }
        />
      </button>
    );
  };

  return (
    <div className="mx-1 space-y-5">
      <div className="space-y-1">
        <p className="text-xs font-medium text-app-muted">{t("ajustes.tema_grupo")}</p>
        <p className="text-xs leading-relaxed text-app-muted">{t("ajustes.apariencia_nota")}</p>
      </div>

      {/* Oscuros — 6 temas, rejilla compacta de 2 columnas */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-app-muted">Oscuros · 6</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label={t("ajustes.tema_grupo") + " — oscuros"}>
          {oscuros.map(renderBoton)}
        </div>
      </div>

      {/* Claros — 6 temas, rejilla compacta de 2 columnas */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-app-muted">Claros · 6</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label={t("ajustes.tema_grupo") + " — claros"}>
          {claros.map(renderBoton)}
        </div>
      </div>
    </div>
  );
}
