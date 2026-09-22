// src/app/components/InsigniaCategoria.js — Insignia de categoría temática.
// "General"/vacía = neutra (cat-pill-general) para no saturar; las
// específicas usan el color por hash. Badge opcional de confianza IA
// (80-100 %) resuelto por confianzaIAVisible.
"use client";

import { Tag } from "lucide-react";
import { getCategoryVars, esCategoriaGeneral } from "@/lib/categoryStyles";

export default function InsigniaCategoria({ categoria, confianza = null, t, className = "" }) {
  if (!categoria) return null;
  const general = esCategoriaGeneral(categoria);
  return (
    <span
      style={general ? undefined : getCategoryVars(categoria)}
      className={`${general ? "cat-pill-general" : "cat-pill"} items-center gap-1 font-medium rounded ${className}`}
    >
      <Tag size={10} className="opacity-75 shrink-0" />
      <span>{categoria}</span>
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
