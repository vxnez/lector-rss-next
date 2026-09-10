// src/app/components/ArticleReaderModal.js
"use client";

import { X, ExternalLink, Bookmark, Check, Tag, Globe, Calendar, Pencil, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { useEffect, useState } from "react";

// Función para asignar colores distintivos a las categorías
const getCategoryColor = (categoria) => {
  return getCategoryStyle(categoria);

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
    case "Clima y Meteorología":
      return "bg-sky-950/60 text-sky-300 border-sky-800/50";
    case "Seguridad y Justicia":
      return "bg-red-950/60 text-red-300 border-red-800/50";
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

export default function ArticleReaderModal({ article, onClose, onToggleRead, onToggleSave, onUpdateCategory, onAnterior, onSiguiente, posicion, total }) {
  const [savingAction, setSavingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [editandoCategoria, setEditandoCategoria] = useState(false);
  const [categoriaElegida, setCategoriaElegida] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [vistaLocal, setVistaLocal] = useState(null);

  useEffect(() => {
    if (!article) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      const objetivo = event.target;
      const escribiendo = Boolean(
        objetivo && (objetivo.tagName === "INPUT" || objetivo.tagName === "TEXTAREA" || objetivo.isContentEditable)
      );
      if (editandoCategoria || escribiendo || objetivo?.tagName === "SELECT") return;
      if (event.key === "ArrowLeft" && onAnterior) {
        event.preventDefault();
        onAnterior();
      }
      if (event.key === "ArrowRight" && onSiguiente) {
        event.preventDefault();
        onSiguiente();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [article, onClose, onAnterior, onSiguiente, editandoCategoria]);

  if (!article) return null;

  const categoriaMostrada = vistaLocal?.categoria ?? article.categoria;
  const metodoMostrado = vistaLocal?.metodo ?? article.clasificacion_metodo;
  const confianzaMostrada = vistaLocal?.confianza ?? article.clasificacion_confianza;

  const handleMarcarLeido = async () => {
    setSavingAction("leido");
    setActionError("");
    const actualizado = await onToggleRead(article.id, Boolean(article.leido));
    setSavingAction("");
    if (actualizado) onClose();
    else setActionError("No se pudo actualizar el estado de lectura.");
  };

  const handleGuardar = async () => {
    setSavingAction("guardado");
    setActionError("");
    const actualizado = await onToggleSave(article.id, Boolean(article.guardado));
    setSavingAction("");
    if (actualizado) onClose();
    else setActionError("No se pudo actualizar el estado guardado.");
  };

  const iniciarEdicionCategoria = async () => {
    setActionError("");
    setCategoriaElegida(categoriaMostrada || "General");
    setEditandoCategoria(true);
    if (categorias.length > 0) return;
    try {
      const res = await fetch("/api/rss?tipo=categorias", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (Array.isArray(data)) setCategorias(data);
    } catch {
      setActionError("No se pudo cargar el catálogo de categorías.");
      setEditandoCategoria(false);
    }
  };

  const guardarCategoria = async () => {
    if (!categoriaElegida || !onUpdateCategory) return;
    setSavingAction("categoria");
    setActionError("");
    const actualizado = await onUpdateCategory(article.id, categoriaElegida);
    setSavingAction("");
    if (actualizado) {
      setVistaLocal({ categoria: categoriaElegida, metodo: "manual", confianza: 1 });
      setEditandoCategoria(false);
    } else {
      setActionError("No se pudo actualizar la categoría.");
    }
  };

  const fechaFormateada = formatFecha(article.fecha_publicacion);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 md:p-8 rounded-2xl w-full max-w-3xl shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-y-auto flex flex-col justify-between">
        <button
          onClick={onAnterior}
          disabled={!onAnterior}
          title="Noticia anterior"
          aria-label="Noticia anterior"
          className="absolute top-1/2 -translate-y-1/2 -left-2 sm:-left-5 z-10 rounded-full bg-gray-800/90 border border-gray-700 p-2 sm:p-2.5 text-gray-300 hover:text-white hover:border-sky-600/60 hover:bg-gray-800 transition disabled:opacity-30 disabled:pointer-events-none shadow-xl"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={onSiguiente}
          disabled={!onSiguiente}
          title="Noticia siguiente"
          aria-label="Noticia siguiente"
          className="absolute top-1/2 -translate-y-1/2 -right-2 sm:-right-5 z-10 rounded-full bg-gray-800/90 border border-gray-700 p-2 sm:p-2.5 text-gray-300 hover:text-white hover:border-sky-600/60 hover:bg-gray-800 transition disabled:opacity-30 disabled:pointer-events-none shadow-xl"
        >
          <ChevronRight size={20} />
        </button>
        {/* Cabecera del modal */}
        <div>
          <div className="flex justify-between items-start gap-4 mb-3">
            <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400">
              {article.fuente_nombre && (
                <span className="flex items-center gap-1 bg-gray-800 border border-gray-700 text-sky-400 px-2.5 py-1 rounded-md font-medium">
                  <Globe size={12} />
                  {article.fuente_nombre}
                </span>
              )}
              {editandoCategoria ? (
                <span className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 px-2 py-1 rounded-md">
                  <Tag size={12} className="opacity-75 shrink-0" />
                  <select
                    value={categoriaElegida}
                    onChange={(event) => setCategoriaElegida(event.target.value)}
                    disabled={Boolean(savingAction)}
                    aria-label="Elegir categoría"
                    className="bg-transparent text-xs text-white outline-none cursor-pointer max-w-40 disabled:opacity-50"
                  >
                    {categorias.map((nombre) => (
                      <option key={nombre} value={nombre} className="bg-gray-900">
                        {nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={guardarCategoria}
                    disabled={Boolean(savingAction)}
                    title="Guardar categoría"
                    aria-label="Guardar categoría"
                    className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 shrink-0"
                  >
                    <Save size={13} />
                  </button>
                  <button
                    onClick={() => setEditandoCategoria(false)}
                    disabled={Boolean(savingAction)}
                    title="Cancelar"
                    aria-label="Cancelar edición de categoría"
                    className="text-gray-400 hover:text-white disabled:opacity-50 shrink-0"
                  >
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <>
                  {categoriaMostrada && (
                    <span style={getCategoryColor(categoriaMostrada)} className="flex items-center gap-1 border px-2.5 py-1 rounded-md font-medium">
                      <Tag size={12} className="opacity-75" />
                      {categoriaMostrada}
                    </span>
                  )}
                  <button
                    onClick={iniciarEdicionCategoria}
                    title="Corregir categoría"
                    aria-label="Corregir categoría"
                    className="flex items-center border border-gray-700/60 bg-gray-800/60 px-2 py-1 rounded-md text-gray-400 hover:text-sky-400 hover:border-sky-600/50 transition"
                  >
                    <Pencil size={12} />
                  </button>
                </>
              )}
              {metodoMostrado && (
                <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2.5 py-1 rounded-md">
                  {metodoMostrado === "gemini" ? "IA" : metodoMostrado === "manual" ? "Manual" : "Sin IA"} · {Math.round(Number(confianzaMostrada || 0) * 100)}%
                </span>
              )}
              {fechaFormateada && (
                <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2.5 py-1 rounded-md">
                  <Calendar size={12} className="opacity-75" />
                  {fechaFormateada}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {posicion && total ? (
                <span className="text-xs text-gray-500 tabular-nums" aria-label={`Noticia ${posicion} de ${total}`}>
                  {posicion} / {total}
                </span>
              ) : null}
              <button
                onClick={onClose}
                aria-label="Cerrar lector de noticia"
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition shrink-0"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Título completo */}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-snug mb-4 break-words">
            {article.titulo}
          </h2>

          {/* Cuerpo / Resumen de la noticia */}
          <div className="text-gray-300 text-sm md:text-base leading-relaxed overflow-y-auto max-h-[45vh] pr-2 space-y-3">
            <p>{article.resumen || "Sin resumen disponible para esta noticia."}</p>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {actionError}
          </p>
        )}

        {/* Acciones del pie */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-6 pt-4 border-t border-gray-800">
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
            <button
              onClick={handleMarcarLeido}
              disabled={Boolean(savingAction)}
              className={`px-2 sm:px-3.5 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition min-w-0 ${
                article.leido
                  ? "bg-emerald-950/60 border border-emerald-800/60 text-emerald-400"
                  : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Check size={14} />
              <span>{savingAction === "leido" ? "Guardando..." : article.leido ? "Leído" : "Marcar como leído"}</span>
            </button>

            <button
              onClick={handleGuardar}
              disabled={Boolean(savingAction)}
              className={`px-2 sm:px-3.5 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition min-w-0 ${
                article.guardado
                  ? "bg-amber-950/60 border border-amber-800/60 text-amber-400"
                  : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Bookmark size={14} />
              <span>{savingAction === "guardado" ? "Guardando..." : article.guardado ? "Guardado" : "Guardar"}</span>
            </button>
          </div>

          <a
            href={article.url_original}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto justify-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-sky-600/20"
          >
            <span>Ir al sitio oficial</span>
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}