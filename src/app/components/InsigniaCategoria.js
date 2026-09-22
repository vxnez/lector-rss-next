// src/app/components/InsigniaCategoria.js — Insignia de categoría temática.
// "General"/vacía = neutra (cat-pill-general) para no saturar; las
// específicas usan el color por hash. Badge opcional de confianza IA
// (80-100 %) resuelto por confianzaIAVisible. El nombre se muestra en el
// idioma de la interfaz (traducirCategoria); el canónico no cambia.
"use client";

import { Tag } from "lucide-react";
import { getCategoryVars, esCategoriaGeneral, traducirCategoria } from "@/lib/categoryStyles";
import { useIdioma } from "@/lib/i18n";

export default function InsigniaCategoria({ categoria, confianza = null, t, className = "" }) {
  const { idioma } = useIdioma();
  if (!categoria) return null;
  const general = esCategoriaGeneral(categoria);
  return (
    <span
      style={general ? undefined : getCategoryVars(categoria)}
      className={`${general ? "cat-pill-general" : "cat-pill"} min-w-0 max-w-full overflow-hidden items-center gap-1 font-medium rounded ${className}`}
    >
      <Tag size={10} className="opacity-75 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{traducirCategoria(categoria, idioma)}</span>
      {confianza != null && (
        <span
          className="opacity-80 tabular-nums"
          title={t ? t("tarjeta.confianza_titulo", { n: confianza }) : undefined}
        >
          · {confianza}%
        </span>
      )}
    </span>
  );
}
