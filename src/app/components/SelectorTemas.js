// src/app/components/SelectorTemas.js — Selector de temas de color con vista previa.
//
// Componente autónomo que renderiza las 8 tarjetas tema con:
//   • Bordes redondeados (rounded-xl).
//   • Vista previa circular bicolor (fondo + acento del tema).
//   • Indicador circular de selección verificado (icono CheckCircle / Circle).
//   • Tipografía limpia: nombre del tema + etiqueta de modo (claro/oscuro).
//   • Adaptación dinámica claro/oscuro vía variables CSS del tema activo
//     (--background, --surface, --border, --foreground, --accent, etc.).
//   • Estado reflejado instantáneamente vía props; el padre aplica el cambio
//     al DOM, localStorage, favicon y meta theme-color.
//
// Props:
//   tema   — id del tema activo (p. ej. "medianoche").
//   onTema — (id: string) => void; notifica el cambio al padre.
"use client";

import { TEMAS } from "@/lib/temas";
import { useIdioma } from "@/lib/i18n";
import MorphIcon from "./MorphIcon";
import { Circle as CircleData, CheckCircle2 as CheckCircleData } from "lucide";

export default function SelectorTemas({ tema, onTema }) {
  const { t } = useIdioma();

  return (
    <div className="space-y-3">
      {/* Encabezado: título y nota informativa */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-app-muted">
          {t("ajustes.tema_grupo")}
        </p>
        <p className="text-xs leading-relaxed text-app-muted">
          {t("ajustes.apariencia_nota")}
        </p>
      </div>

      {/* Rejilla de tarjetas de tema (radiogroup semántico) */}
      <div
        className="grid gap-2 sm:grid-cols-2"
        role="radiogroup"
        aria-label={t("ajustes.tema_grupo")}
      >
        {TEMAS.map((item) => {
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
                "group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left",
                "transition-all duration-200 ease-out",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
                activo
                  ? "border-2 border-[var(--accent)] shadow-md shadow-[var(--accent)]/20"
                  : "border border-app-line hover:border-[var(--accent)]/60",
              ].join(" ")}
              style={{
                background: `linear-gradient(135deg, ${item.bg} 0%, ${item.accent} 100%)`,
                backgroundSize: "200% 200%",
                animation: "gradientShift 4s ease infinite",
              }}
            >
              {/* Nombre del tema y etiqueta de modo */}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${item.claro ? "text-[#1b2a1f]" : "text-[#e7edf5]"}`}>
                  {item.nombre}
                </span>
                <span className={`block text-xs ${item.claro ? "text-[#5c6850]/80" : "text-[#91a0b5]/80"}`}>
                  {modo}
                </span>
              </span>

              {/* Indicador circular de selección verificado */}
              <MorphIcon
                icon={activo ? CheckCircleData : CircleData}
                size={16}
                strokeWidth={2.5}
                className={
                  activo
                    ? "shrink-0 text-white drop-shadow-sm"
                    : `shrink-0 ${item.claro ? "text-[#5c6850]" : "text-[#828a94]"} group-hover:text-white`
                }
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
