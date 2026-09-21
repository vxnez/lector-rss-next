// src/app/components/SelectorTemas.js — Selector de temas de color con gradiente animado.
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
        onClick={() => onTema(item.id)}
        className={[
          "group w-full flex items-center gap-3 rounded-xl border px-4 text-left",
          "transition-all duration-200 ease-out",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
          "py-2",
          activo
            ? "border-2 border-[var(--accent)] shadow-lg shadow-[var(--accent)]/25"
            : "border border-app-line hover:border-[var(--accent)]/60",
        ].join(" ")}
        style={{
          background: `linear-gradient(135deg, ${item.bg} 0%, ${item.accent} 100%)`,
          backgroundSize: "200% 200%",
          animation: "gradientShift 12s ease infinite",
        }}
      >
        <span className={`min-w-0 flex-1`}>
          <span className={`block text-base font-semibold leading-tight ${item.claro ? "text-[#1b2a1f]" : "text-[#e7edf5]"}`}>
            {item.nombre}
          </span>
          <span className={`block text-xs font-medium ${item.claro ? "text-[#5c6850]/90" : "text-[#91a0b5]/90"}`}>
            {modo}
          </span>
        </span>
        <MorphIcon
          icon={activo ? CheckCircleData : CircleData}
          size={18}
          strokeWidth={2.5}
          className={
            activo
              ? "shrink-0 text-white drop-shadow-sm"
              : `shrink-0 ${item.claro ? "text-[#3c4a3a]" : "text-[#828a94]"} group-hover:text-white`
          }
        />
      </button>
    );
  };

  return (
    <div className="space-y-5 mx-1">
      <div className="space-y-1">
        <p className="text-xs font-medium text-app-muted">{t("ajustes.tema_grupo")}</p>
        <p className="text-xs leading-relaxed text-app-muted">{t("ajustes.apariencia_nota")}</p>
      </div>

      {/* Oscuros — una fila, ancho completo */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-app-muted/50">Oscuros</p>
        <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label={t("ajustes.tema_grupo") + " — oscuros"}>
          {oscuros.map(renderBoton)}
        </div>
      </div>

      {/* Claros — una fila, ancho completo */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-app-muted/50">Claros</p>
        <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label={t("ajustes.tema_grupo") + " — claros"}>
          {claros.map(renderBoton)}
        </div>
      </div>
    </div>
  );
}
