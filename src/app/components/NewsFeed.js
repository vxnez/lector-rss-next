// src/app/components/NewsFeed.js
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Bookmark, Trash2, ExternalLink, Tag, Globe, Calendar, Clock } from "lucide-react";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { tiempoLecturaMinutos } from "@/lib/lectura";

// El lector solo se necesita cuando se abre una noticia: fuera del bundle inicial.
const ArticleReaderModal = dynamic(() => import("./ArticleReaderModal"), { ssr: false });

const DOMAIN_COLOR_PALETTES = [
  { bg: "bg-sky-950/60", text: "text-sky-400", border: "border-sky-800/50" },
  { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-800/50" },
  { bg: "bg-purple-950/60", text: "text-purple-400", border: "border-purple-800/50" },
  { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-800/50" },
  { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-800/50" },
  { bg: "bg-indigo-950/60", text: "text-indigo-400", border: "border-indigo-800/50" },
  { bg: "bg-teal-950/60", text: "text-teal-400", border: "border-teal-800/50" },
  { bg: "bg-orange-950/60", text: "text-orange-400", border: "border-orange-800/50" },
  { bg: "bg-fuchsia-950/60", text: "text-fuchsia-400", border: "border-fuchsia-800/50" },
  { bg: "bg-cyan-950/60", text: "text-cyan-400", border: "border-cyan-800/50" },
];

const domainColorCache = new Map();

const getDomainColor = (domainName) => {
  const cached = domainColorCache.get(domainName);
  if (cached) return cached;
  let hash = 0;
  for (let i = 0; i < domainName.length; i++) {
    hash = domainName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DOMAIN_COLOR_PALETTES.length;
  const palette = DOMAIN_COLOR_PALETTES[index];
  domainColorCache.set(domainName, palette);
  return palette;
};

// Fuente única de verdad: lib/categoryStyles. (Se eliminó el switch duplicado muerto.)
const getCategoryColor = (categoria) => getCategoryStyle(categoria);

// Formatter hoisteado: no crear un Intl por tarjeta por render.
const fechaFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

// Función auxiliar para formatear la fecha de publicación de forma legible
const formatFecha = (fechaStr) => {
  const fechaObj = fechaStr ? new Date(fechaStr) : new Date();
  try {
    if (isNaN(fechaObj.getTime())) return "Reciente";
    return fechaFormatter.format(fechaObj);
  } catch {
    return "Reciente";
  }
};

export default function NewsFeed({ articles, onToggleRead, onToggleSave, onUpdateCategory, onDelete }) {
  const [selectedArticle, setSelectedArticle] = useState(null);

  const indiceSeleccionado = selectedArticle
    ? articles.findIndex((art) => art.id === selectedArticle.id)
    : -1;

  const articlesRef = useRef(articles);

  useEffect(() => {
    articlesRef.current = articles;
  });

  const irAId = useCallback((id) => {
    const item = (articlesRef.current || []).find((art) => art.id === id);
    if (item) {
      setSelectedArticle(item);
      return true;
    }
    return false;
  }, []);

  const anteriorId = indiceSeleccionado > 0 ? articles[indiceSeleccionado - 1].id : null;
  const siguienteId =
    indiceSeleccionado >= 0 && indiceSeleccionado < articles.length - 1
      ? articles[indiceSeleccionado + 1].id
      : null;

  const getFuenteNombre = (art) => {
    if (art.fuente_nombre && art.fuente_nombre !== "Fuente RSS") {
      return art.fuente_nombre.toUpperCase();
    }
    const rawUrl = art.url_original || art.url || art.link;
    if (rawUrl) {
      try {
        const hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
        return hostname.toUpperCase();
      } catch (e) {}
    }
    return "FUENTE RSS";
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((art) => {
          const isLeido = Boolean(art.leido);
          const isGuardado = Boolean(art.guardado);
          const nombreFuente = getFuenteNombre(art);
          const colorStyles = getDomainColor(nombreFuente);
          const fechaFormateada = formatFecha(art.fecha_publicacion);
          const minutosLectura = tiempoLecturaMinutos(art.titulo, art.resumen);
          return (
            <div
              key={art.id}
              className={`p-5 rounded-xl flex flex-col justify-between transition-all duration-300 group shadow-lg ${
                isLeido
                  ? "bg-gray-950/70 border border-gray-800/40 opacity-40 grayscale-[25%]"
                  : "bg-gray-900 border border-gray-800 hover:border-gray-700 opacity-100"
              }`}
            >
              {/* Encabezado */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span
                      className={`text-[11px] font-bold border px-2 py-0.5 rounded flex items-center gap-1.5 tracking-wide transition-opacity ${
                        isLeido ? "opacity-60" : "opacity-100"
                      } ${colorStyles.bg} ${colorStyles.text} ${colorStyles.border}`}
                    >
                      <Globe size={11} className="shrink-0" />
                      <span className="truncate">{nombreFuente}</span>
                    </span>

                    {fechaFormateada && (
                      <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 rounded text-[11px]">
                        <Calendar size={11} className="opacity-75" />
                        <span>{fechaFormateada}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 rounded text-[11px]" title={`Lectura estimada: ${minutosLectura} min`}>
                      <Clock size={11} className="opacity-75" />
                      <span>{minutosLectura} min</span>
                    </span>
                  </div>

                  <button
                    onClick={() => onDelete(art.id)}
                    aria-label="Descartar noticia"
                    title="No me interesa esta noticia"
                    className="text-gray-500 hover:text-rose-400 p-1 rounded hover:bg-gray-800 transition shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Título */}
                <h3
                  onClick={() => setSelectedArticle(art)}
                  className={`text-base font-bold leading-snug mb-2 cursor-pointer transition line-clamp-2 ${
                    isLeido ? "text-gray-500 line-through decoration-gray-600" : "text-white hover:text-sky-400"
                  }`}
                >
                  {art.titulo}
                </h3>

                {/* Resumen */}
                <p
                  onClick={() => setSelectedArticle(art)}
                  className={`text-xs line-clamp-3 mb-4 cursor-pointer transition ${
                    isLeido ? "text-gray-600" : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  {art.resumen}
                </p>
              </div>

              {/* Pie de la Tarjeta */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-800/80 gap-1 text-xs">
                <button
                  onClick={() => setSelectedArticle(art)}
                  className="text-sky-400 hover:underline flex items-center gap-1 font-medium text-xs"
                >
                  <span>Leer noticia</span>
                  <ExternalLink size={12} />
                </button>

                <div className="flex items-center gap-1.5">
                  {art.categoria && (
                    <span style={getCategoryColor(art.categoria)} className="border px-2 py-1 rounded text-[11px] flex items-center gap-1 font-medium">
                      <Tag size={10} className="opacity-75" />
                      <span>{art.categoria}</span>
                    </span>
                  )}

                  {/* Marcar Leído */}
                  <button
                    onClick={() => onToggleRead(art.id, isLeido)}
                    aria-label={isLeido ? "Marcar como no leído" : "Marcar como leído"}
                    aria-pressed={isLeido}
                    className={`p-1.5 rounded-lg border transition ${
                      isLeido
                        ? "bg-emerald-950/80 border-emerald-700 text-emerald-400"
                        : "bg-gray-800/80 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                    title={isLeido ? "Marcar como no leído" : "Marcar como leído"}
                  >
                    <Check size={13} aria-hidden="true" />
                  </button>

                  {/* Guardar */}
                  <button
                    onClick={() => onToggleSave(art.id, isGuardado)}
                    aria-label={isGuardado ? "Quitar de guardados" : "Guardar para después"}
                    aria-pressed={isGuardado}
                    className={`p-1.5 rounded-lg border transition ${
                      isGuardado
                        ? "bg-amber-950/80 border-amber-700 text-amber-400"
                        : "bg-gray-800/80 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                    title={isGuardado ? "Desguardar" : "Guardar para después"}
                  >
                    <Bookmark size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ArticleReaderModal
        key={selectedArticle?.id ?? "vacio"}
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onToggleRead={onToggleRead}
        onToggleSave={onToggleSave}
        onUpdateCategory={onUpdateCategory}
        onIrAId={irAId}
        anteriorId={anteriorId}
        siguienteId={siguienteId}
        posicion={indiceSeleccionado >= 0 ? indiceSeleccionado + 1 : null}
        total={articles.length}
      />
    </>
  );
}