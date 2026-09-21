// src/app/components/ResumenEstructurado.js — Resumen con estructura visual.
// Convierte texto plano (o Markdown ligero del backend) en bloques React:
// subtítulos, párrafos y listas con viñetas. Sin HTML crudo por construcción
// (no hay dangerouslySetInnerHTML: todo se arma con elementos React desde
// texto), así que es seguro ante contenido no sanitizado.
// Subset soportado: `## subtítulo`, `- ` / `* ` / `• ` / `1. ` viñetas,
// `**negrita**` en línea y párrafos separados por línea en blanco.
"use client";

import { useMemo } from "react";

const RE_VINETA = /^\s*(?:[-*•]|\d+[.)])\s+/;
const RE_SUBTITULO = /^#{1,3}\s+/;
const RE_NEGRITA = /\*\*(.+?)\*\*/g;

function limpiarVineta(linea) {
  return linea.replace(RE_VINETA, "").trim();
}

function limpiarSubtitulo(linea) {
  return linea.replace(RE_SUBTITULO, "").trim();
}

/** Divide el texto en bloques { tipo: subtitulo|parrafo|lista }. */
export function parseResumen(texto) {
  const lineas = String(texto || "").split(/\r?\n/);
  const bloques = [];
  let parrafo = [];
  let listaActual = null;

  const cerrarParrafo = () => {
    const junto = parrafo.join(" ").trim();
    if (junto) bloques.push({ tipo: "parrafo", texto: junto });
    parrafo = [];
  };
  const cerrarLista = () => {
    if (listaActual && listaActual.items.length > 0) bloques.push(listaActual);
    listaActual = null;
  };

  for (const cruda of lineas) {
    const linea = cruda.trim();
    if (!linea) {
      cerrarParrafo();
      cerrarLista();
      continue;
    }
    if (RE_SUBTITULO.test(linea)) {
      cerrarParrafo();
      cerrarLista();
      const texto = limpiarSubtitulo(linea);
      if (texto) bloques.push({ tipo: "subtitulo", texto });
      continue;
    }
    if (RE_VINETA.test(linea)) {
      cerrarParrafo();
      if (!listaActual) listaActual = { tipo: "lista", items: [] };
      const item = limpiarVineta(linea);
      if (item) listaActual.items.push(item);
      continue;
    }
    cerrarLista();
    parrafo.push(linea);
  }
  cerrarParrafo();
  cerrarLista();

  const base = String(texto || "").trim();
  return bloques.length > 0 ? bloques : [{ tipo: "parrafo", texto: base }];
}

/** Texto plano para tarjetas: quita marcas Markdown (** , ##, viñetas) y
    colapsa espacios. Las tarjetas usan line-clamp sobre una sola línea
    lógica; las marcas crudas se verían como en el bug reportado. */
export function resumenPlano(texto) {
  return String(texto || "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Divide un fragmento en partes normales y en negrita (**...**). */
function partesNegrita(texto) {
  const partes = [];
  let ultimo = 0;
  let coincidencia;
  RE_NEGRITA.lastIndex = 0;
  while ((coincidencia = RE_NEGRITA.exec(texto)) !== null) {
    if (coincidencia.index > ultimo) {
      partes.push({ texto: texto.slice(ultimo, coincidencia.index), negrita: false });
    }
    partes.push({ texto: coincidencia[1], negrita: true });
    ultimo = coincidencia.index + coincidencia[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo), negrita: false });
  return partes.length > 0 ? partes : [{ texto, negrita: false }];
}

function conNegrita(texto, clave) {
  return partesNegrita(texto).map((parte, i) =>
    parte.negrita ? (
      <strong key={`${clave}-${i}`} className="font-semibold text-app-fg">
        {parte.texto}
      </strong>
    ) : (
      <span key={`${clave}-${i}`}>{parte.texto}</span>
    )
  );
}

export default function ResumenEstructurado({ texto, expandido }) {
  const bloques = useMemo(() => parseResumen(texto), [texto]);

  return (
    <div className={`space-y-2.5 ${expandido ? undefined : "line-clamp-[10]"}`}>
      {bloques.map((bloque, i) => {
        if (bloque.tipo === "subtitulo") {
          return (
            <h4 key={i} className="pt-1 text-base font-bold leading-snug text-app-fg first:pt-0">
              {conNegrita(bloque.texto, `sub-${i}`)}
            </h4>
          );
        }
        if (bloque.tipo === "lista") {
          return (
            <ul
              key={i}
              className="list-disc space-y-1 pl-5 marker:text-[var(--accent)]"
            >
              {bloque.items.map((item, j) => (
                <li key={j} className="pl-1">
                  {conNegrita(item, `li-${i}-${j}`)}
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{conNegrita(bloque.texto, `p-${i}`)}</p>;
      })}
    </div>
  );
}
