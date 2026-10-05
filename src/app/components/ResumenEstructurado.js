// src/app/components/ResumenEstructurado.js — Cuerpo editorial del lector.
// Convierte texto plano (o Markdown ligero del backend) en bloques React con
// jerarquía tipográfica: entradilla, subtítulos con filete de acento,
// citas, avisos (callouts), listas y separadores. Sin HTML crudo por
// construcción (no hay dangerouslySetInnerHTML: todo se arma con elementos
// React desde texto), así que es seguro ante contenido no sanitizado.
// Subset soportado: `## subtítulo`, `- ` / `* ` / `• ` / `1. ` viñetas,
// `> cita`, `**negrita**`, `` `código` ``, `[texto](url)`, `---` y párrafos
// separados por línea en blanco. Párrafos tipo `Nota: ...` / `Clave: ...`
// se elevan a aviso.
"use client";

import { useMemo, useState } from "react";
import { limpiarTextoResumen } from "@/lib/limpiezaTexto";

const RE_VINETA = /^\s*(?:[-*•]|\d+[.)])\s+/;
const RE_SUBTITULO = /^#{1,3}\s+/;
const RE_CITA = /^>\s?/;
const RE_SEPARADOR = /^(-{3,}|\*{3,}|_{3,})\s*$/;
const RE_NEGRITA = /\*\*(.+?)\*\*/g;
const RE_CODIGO = /`([^`\n]+)`/g;
const RE_ENLACE = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;
const RE_AVISO = /^(nota|importante|advertencia|aviso|clave|dato|resumen|en resumen|tl;dr|conclusi[oó]n|recomendaci[oó]n)\s*[:-]\s*/i;

function limpiarVineta(linea) {
  return linea.replace(RE_VINETA, "").trim();
}

function limpiarSubtitulo(linea) {
  return linea.replace(RE_SUBTITULO, "").trim();
}

/** Divide el texto en bloques { tipo: subtitulo|parrafo|lista|cita|aviso|separador|codigo }. */
export function parseResumen(texto) {
  // Sanitización previa: el backend puede mandar HTML/entities en resúmenes
  // extendidos; aquí solo llega texto plano al render.
  const saneado = limpiarTextoResumen(texto);
  // Muros de texto sin saltos (extractos largos de una línea): se segmentan
  // por frase para no pintar un solo <p> gigante.
  const conSegmentos = saneado.includes("\n")
    ? saneado
    : saneado.length > 800
      ? saneado.replace(/([.!?…])\s+(?=[A-ZÁÉÍÓÚÑ¿¡“"])/g, "$1\n")
      : saneado;
  const lineas = String(conSegmentos || "").split(/\r?\n/);
  const bloques = [];
  let parrafo = [];
  let listaActual = null;
  let citaActual = null;
  let enCodigo = false;
  let codigo = [];

  const cerrarParrafo = () => {
    // Las líneas contiguas sin línea en blanco son saltos suaves (<br>):
    // se conservan como \n y el render los pinta con <br>, nunca fundidos.
    const junto = parrafo.join("\n").trim();
    if (junto) {
      const m = junto.split("\n")[0].match(RE_AVISO);
      if (m) {
        bloques.push({
          tipo: "aviso",
          etiqueta: m[1].trim(),
          texto: junto.slice(m[0].length).trim() || junto,
        });
      } else {
        bloques.push({ tipo: "parrafo", texto: junto });
      }
    }
    parrafo = [];
  };
  const cerrarLista = () => {
    if (listaActual && listaActual.items.length > 0) bloques.push(listaActual);
    listaActual = null;
  };
  const cerrarCita = () => {
    if (citaActual && citaActual.texto) bloques.push(citaActual);
    citaActual = null;
  };
  const cerrarCodigo = () => {
    const texto = codigo.join("\n").replace(/^\n+|\n+$/g, "");
    if (texto) bloques.push({ tipo: "codigo", texto });
    codigo = [];
  };

  for (const cruda of lineas) {
    // Cercas de código (``` o ~~~): el contenido va verbatim (con
    // indentación), nunca trim ni filtrado.
    if (/^```/.test(cruda.trim()) || /^~~~/.test(cruda.trim())) {
      if (enCodigo) cerrarCodigo();
      else {
        cerrarParrafo();
        cerrarLista();
        cerrarCita();
      }
      enCodigo = !enCodigo;
      continue;
    }
    if (enCodigo) {
      codigo.push(cruda.replace(/\s+$/g, ""));
      continue;
    }
    const linea = cruda.trim();
    if (!linea) {
      cerrarParrafo();
      cerrarLista();
      cerrarCita();
      continue;
    }
    if (RE_SEPARADOR.test(linea)) {
      cerrarParrafo();
      cerrarLista();
      cerrarCita();
      bloques.push({ tipo: "separador" });
      continue;
    }
    if (RE_SUBTITULO.test(linea)) {
      cerrarParrafo();
      cerrarLista();
      cerrarCita();
      const titulo = limpiarSubtitulo(linea);
      if (titulo) bloques.push({ tipo: "subtitulo", texto: titulo });
      continue;
    }
    if (RE_CITA.test(linea)) {
      cerrarParrafo();
      cerrarLista();
      const cita = linea.replace(RE_CITA, "").trim();
      if (cita) {
        // Citas contiguas = un solo bloque con saltos suaves.
        citaActual = citaActual ? { tipo: "cita", texto: `${citaActual.texto}\n${cita}` } : { tipo: "cita", texto: cita };
      }
      continue;
    }
    if (RE_VINETA.test(linea)) {
      cerrarParrafo();
      cerrarCita();
      if (!listaActual) listaActual = { tipo: "lista", items: [] };
      const item = limpiarVineta(linea);
      if (item) listaActual.items.push(item);
      continue;
    }
    cerrarLista();
    cerrarCita();
    parrafo.push(linea);
  }
  cerrarParrafo();
  cerrarLista();
  cerrarCita();
  // Cerca sin cerrar al final: se pinta igual (tolerante).
  if (enCodigo) cerrarCodigo();

  const base = String(saneado || "").trim();
  return bloques.length > 0 ? bloques : [{ tipo: "parrafo", texto: base }];
}

/** Texto plano para tarjetas y TTS: quita marcas Markdown y colapsa.
 *  Los bloques de código se excluyen (no se leen en voz alta). */
export function resumenPlano(texto) {
  // Limpieza primero (HTML/entities/residuos) y luego marcas Markdown.
  return limpiarTextoResumen(texto)
    .replace(/^```.*\n([\s\S]*?)\n```/gm, "")
    .replace(/^~~~.*\n([\s\S]*?)\n~~~/gm, "")
    .replace(/^```.*$/gm, "")
    .replace(/^~~~.*$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^---+\s*$/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Divide un fragmento en partes con formato (negrita, código, enlaces). */
function partesFormato(texto) {
  const partes = [];
  const patron = new RegExp(
    `${RE_ENLACE.source}|${RE_CODIGO.source}|${RE_NEGRITA.source}`,
    "g"
  );
  let ultimo = 0;
  let m;
  patron.lastIndex = 0;
  while ((m = patron.exec(texto)) !== null) {
    if (m.index > ultimo) {
      partes.push({ texto: texto.slice(ultimo, m.index) });
    }
    if (m[1] !== undefined && m[2] !== undefined) {
      partes.push({ texto: m[1], enlace: m[2] });
    } else if (m[3] !== undefined) {
      partes.push({ texto: m[3], codigo: true });
    } else if (m[4] !== undefined) {
      partes.push({ texto: m[4], negrita: true });
    }
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push({ texto: texto.slice(ultimo) });
  return partes.length > 0 ? partes : [{ texto }];
}

function conFormato(texto, clave) {
  return partesFormato(texto).map((parte, i) => {
    const key = `${clave}-${i}`;
    if (parte.enlace) {
      return (
        <a
          key={key}
          href={parte.enlace}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--accent-ink)] underline decoration-[var(--accent)]/50 underline-offset-2 hover:decoration-[var(--accent)]"
        >
          {parte.texto}
        </a>
      );
    }
    if (parte.codigo) {
      return (
        <code
          key={key}
          className="rounded-md border border-app-line bg-app-raised/70 px-1.5 py-0.5 font-mono text-[0.85em] text-app-fg"
        >
          {parte.texto}
        </code>
      );
    }
    if (parte.negrita) {
      return (
        <strong key={key} className="font-semibold text-app-fg">
          {parte.texto}
        </strong>
      );
    }
    return <span key={key}>{parte.texto}</span>;
  });
}

/** Bloque consola/terminal: fondo oscuro fijo en ambos temas, monoespaciado,
 *  scroll horizontal propio y botón copiar. */
function BloqueCodigo({ texto, t }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  return (
    <figure className="overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-gray-800/80 px-3 py-2">
        <span aria-hidden="true" className="size-2.5 rounded-full bg-rose-500/80" />
        <span aria-hidden="true" className="size-2.5 rounded-full bg-amber-400/80" />
        <span aria-hidden="true" className="size-2.5 rounded-full bg-emerald-400/80" />
        <button
          type="button"
          onClick={copiar}
          className="btn-press ml-auto inline-flex min-h-[36px] items-center rounded-lg px-2.5 text-[11px] font-medium text-gray-400 transition hover:bg-gray-800 hover:text-white"
        >
          {copiado ? t("lector.copiado") : t("lector.copiar")}
        </button>
      </div>
      <pre className="scroll-sutil max-h-80 overflow-auto p-3.5 font-mono text-[12.5px] leading-relaxed text-gray-100">
        <code className="whitespace-pre">{texto}</code>
      </pre>
    </figure>
  );
}

/** Render con saltos suaves: cada \n del bloque se pinta como <br/>. */
function lineasConFormato(texto, clave) {  const lineas = String(texto || "").split("\n");
  return lineas.map((linea, k) => (
    <span key={`${clave}-l${k}`}>
      {conFormato(linea, `${clave}-l${k}`)}
      {k < lineas.length - 1 && <br />}
    </span>
  ));
}

export default function ResumenEstructurado({ texto, prefijoIndice = null, t = null }) {
  const bloques = useMemo(() => parseResumen(texto), [texto]);
  const indiceEntradilla = bloques.findIndex((b) => b.tipo === "parrafo");
  const tr = (clave) => (typeof t === "function" ? t(clave) : clave);

  return (
    <div className="space-y-4">
      {bloques.map((bloque, i) => {
        if (bloque.tipo === "subtitulo") {
          return (
            <h4
              key={i}
              {...(prefijoIndice ? { id: `${prefijoIndice}-${i}` } : {})}
              className="flex scroll-mt-2 items-stretch gap-2.5 pt-2 text-[1.05rem] font-extrabold leading-snug tracking-tight text-app-fg first:pt-0"
            >
              <span aria-hidden="true" className="w-1 shrink-0 rounded-full bg-[var(--accent)]" />
              <span className="min-w-0">{conFormato(bloque.texto, `sub-${i}`)}</span>
            </h4>
          );
        }
        if (bloque.tipo === "cita") {
          return (
            <blockquote
              key={i}
              className="space-y-2 border-l-2 border-[var(--accent)] bg-app-raised/40 px-4 py-2.5 text-[0.95em] italic leading-relaxed text-app-muted"
            >
              {lineasConFormato(bloque.texto, `cita-${i}`)}
            </blockquote>
          );
        }
        if (bloque.tipo === "aviso") {
          return (
            <aside
              key={i}
              className="rounded-xl border border-app-line bg-app-raised/60 px-4 py-3 leading-relaxed"
            >
              <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[var(--accent-ink)]">
                {bloque.etiqueta}
              </p>
              <p className="text-[0.95em] leading-relaxed text-app-fg">{lineasConFormato(bloque.texto, `aviso-${i}`)}</p>
            </aside>
          );
        }
        if (bloque.tipo === "separador") {
          return <hr key={i} aria-hidden="true" className="border-t border-app-line/70" />;
        }
        if (bloque.tipo === "codigo") {
          return <BloqueCodigo key={i} texto={bloque.texto} t={tr} />;
        }
        if (bloque.tipo === "lista") {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {bloque.items.map((item, j) => (
                <li key={j} className="flex gap-2.5 leading-relaxed">
                  <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span className="min-w-0">{conFormato(item, `li-${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        // Entradilla: el primer párrafo abre con más presencia.
        const esEntradilla = i === indiceEntradilla;
        return (
          <p
            key={i}
            className={
              esEntradilla
                ? "text-[1.02em] font-medium leading-[1.85] text-app-fg"
                : "leading-[1.85] text-app-fg/95"
            }
          >
            {lineasConFormato(bloque.texto, `p-${i}`)}
          </p>
        );
      })}
    </div>
  );
}
