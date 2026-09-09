// src/app/components/AddFeedModal.js
"use client";

import { useState } from "react";
import { Rss, Link as LinkIcon, Tag, X, AlertCircle, Loader2, Plus } from "lucide-react";

export default function AddFeedModal({ isOpen, onClose, onSuccess }) {
  const [url, setUrl] = useState("");
  const [categoria, setCategoria] = useState("General");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url_feed: url, categoria }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al agregar la fuente");

      if (!data.nuevos) {
        throw new Error("La fuente no devolvió noticias para mostrar.");
      }

      setUrl("");
      if (onSuccess) await onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl relative">
        {/* Botón cerrar X */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
        >
          <X size={18} />
        </button>

        {/* Encabezado con icono */}
        <div className="flex items-center gap-2 mb-5 sm:mb-6 pr-8">
          <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
            <Rss size={20} />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">Agregar Fuente RSS</h3>
        </div>

        {/* Mensaje de error con icono */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm mb-4 flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">
              URL del Feed RSS
            </label>
            <div className="relative flex items-center">
              <LinkIcon size={16} className="absolute left-3 text-gray-500" />
              <input
                type="url"
                placeholder="https://ejemplo.com/feed.xml"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 text-sm transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-300">
              Categoría
            </label>
            <div className="relative flex items-center">
              <Tag size={16} className="absolute left-3 text-gray-500" />
              <input
                type="text"
                placeholder="Ej: Tecnología, Noticias, Videojuegos"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 text-sm transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3 pt-4 border-t border-gray-800/60">
            <button
              type="button"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 sm:px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-2 min-w-0"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Sincronizando...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Guardar Fuente</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}