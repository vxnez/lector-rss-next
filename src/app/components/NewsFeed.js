// src/app/components/NewsFeed.js
"use client";

import { useState } from "react";
import { Check, Bookmark, Trash2, ExternalLink, Tag, Globe, Calendar } from "lucide-react";
import ArticleReaderModal from "./ArticleReaderModal";

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

const getDomainColor = (domainName) => {
  let hash = 0;
  for (let i = 0; i < domainName.length; i++) {
    hash = domainName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DOMAIN_COLOR_PALETTES.length;
  return DOMAIN_COLOR_PALETTES[index];
};

const getCategoryColor = (categoria) => {
  switch (categoria) {
    case "Inteligencia Artificial":
      return "bg-violet-950/60 text-violet-300 border-violet-800/50";
    case "Ciberseguridad":
      return "bg-red-950/60 text-red-300 border-red-800/50";
    case "Videojuegos":
      return "bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/50";
    case "Ciencia y Espacio":
      return "bg-purple-950/60 text-purple-300 border-purple-800/50";
    case "Economía y Finanzas":
      return "bg-green-950/60 text-green-300 border-green-800/50";
    case "Fitness y Nutrición":
      return "bg-amber-950/60 text-amber-300 border-amber-800/50";
    case "Medio Ambiente":
      return "bg-emerald-950/60 text-emerald-300 border-emerald-800/50";
    case "Cultura y Arte":
      return "bg-pink-950/60 text-pink-300 border-pink-800/50";
    case "Cine y Series":
      return "bg-rose-950/60 text-rose-300 border-rose-800/50";
    case "Música":
      return "bg-cyan-950/60 text-cyan-300 border-cyan-800/50";
    case "Sociedad y Sucesos":
      return "bg-orange-950/60 text-orange-300 border-orange-800/50";
    case "Gastronomía":
      return "bg-yellow-950/60 text-yellow-300 border-yellow-800/50";
    case "Viajes y Turismo":
      return "bg-teal-950/60 text-teal-300 border-teal-800/50";
    case "Motor":
      return "bg-slate-800 text-slate-300 border-slate-700";
    case "Educación":
      return "bg-blue-950/60 text-blue-300 border-blue-800/50";
    case "Moda y Belleza":
      return "bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/50";
    case "Hogar y Vida Diaria":
      return "bg-lime-950/60 text-lime-300 border-lime-800/50";
    case "Ciencia Ficción y Fantasía":
      return "bg-indigo-950/60 text-indigo-300 border-indigo-800/50";
    case "Ciencia":
      return "bg-purple-950/60 text-purple-300 border-purple-800/50";
    case "Celulares":
      return "bg-blue-950/60 text-blue-300 border-blue-800/50";
    case "Computadoras":
      return "bg-indigo-950/60 text-indigo-300 border-indigo-800/50";
    case "Política":
      return "bg-red-950/60 text-red-300 border-red-800/50";
    case "Cuidado ambiental":
      return "bg-emerald-950/60 text-emerald-300 border-emerald-800/50";
    case "Cuidado físico":
      return "bg-amber-950/60 text-amber-300 border-amber-800/50";
    case "Deportes":
      return "bg-orange-950/60 text-orange-300 border-orange-800/50";
    case "Salud":
      return "bg-rose-950/60 text-rose-300 border-rose-800/50";
    case "Economía":
      return "bg-green-950/60 text-green-300 border-green-800/50";
    case "Uso personal":
      return "bg-cyan-950/60 text-cyan-300 border-cyan-800/50";
    case "Vida diaria":
      return "bg-teal-950/60 text-teal-300 border-teal-800/50";
    case "Tecnología":
      return "bg-sky-950/60 text-sky-300 border-sky-800/50";
    default:
      return "bg-gray-800 text-gray-300 border-gray-700/80";
  }
};

// Función auxiliar para formatear la fecha de publicación de forma legible
const formatFecha = (fechaStr) => {
  // Si no hay fecha, usamos la fecha actual o un texto por defecto para pruebas
  const fechaObj = fechaStr ? new Date(fechaStr) : new Date();
  try {
    if (isNaN(fechaObj.getTime())) return "Reciente";
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(fechaObj);
  } catch {
    return "Reciente";
  }
};

export default function NewsFeed({ articles, onToggleRead, onToggleSave, onDelete }) {
  const [selectedArticle, setSelectedArticle] = useState(null);

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
                  </div>

                  <button
                    onClick={() => onDelete(art.id)}
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
                    <span className={`border px-2 py-1 rounded text-[11px] flex items-center gap-1 font-medium ${getCategoryColor(art.categoria)}`}>
                      <Tag size={10} className="opacity-75" />
                      <span>{art.categoria}</span>
                    </span>
                  )}

                  {/* Marcar Leído */}
                  <button
                    onClick={() => onToggleRead(art.id, isLeido)}
                    className={`p-1.5 rounded-lg border transition ${
                      isLeido
                        ? "bg-emerald-950/80 border-emerald-700 text-emerald-400"
                        : "bg-gray-800/80 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                    title={isLeido ? "Marcar como no leído" : "Marcar como leído"}
                  >
                    <Check size={13} />
                  </button>

                  {/* Guardar */}
                  <button
                    onClick={() => onToggleSave(art.id, isGuardado)}
                    className={`p-1.5 rounded-lg border transition ${
                      isGuardado
                        ? "bg-amber-950/80 border-amber-700 text-amber-400"
                        : "bg-gray-800/80 border-gray-700 text-gray-400 hover:text-white"
                    }`}
                    title={isGuardado ? "Desguardar" : "Guardar para después"}
                  >
                    <Bookmark size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ArticleReaderModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onToggleRead={onToggleRead}
        onToggleSave={onToggleSave}
      />
    </>
  );
}