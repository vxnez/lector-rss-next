// src/app/components/ManageSourcesModal.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trash2, RotateCw, RefreshCcw, Rss } from "lucide-react";

export default function ManageSourcesModal({ isOpen, onClose, onChange }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingSourceId, setRefreshingSourceId] = useState(null);

  const fetchSources = useCallback(async (signal) => {
    try {
      const res = await fetch("/api/sources", { cache: "no-store", signal });
      if (res.ok) {
        const data = await res.json();
        const sourcesArr = Array.isArray(data) ? data : (data.sources || data.data || []);
        setSources(sourcesArr);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error al obtener fuentes:", err);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (isOpen) {
      setLoading(true);
      fetchSources(controller.signal).finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    }

    return () => {
      controller.abort();
    };
  }, [isOpen, fetchSources]);

  // Refrescar una fuente individual por su ID o URL de feed
  const handleRefreshSingle = async (source) => {
    const sourceId = source.id;
    const sourceUrl = source.url_feed;
    
    setRefreshingSourceId(sourceId);

    try {
      const res = await fetch("/api/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh_source", source_id: sourceId, url: sourceUrl }),
      });

      if (res.ok) {
        if (onChange) onChange();
      } else {
        alert("No se pudo refrescar la fuente seleccionada.");
      }
    } catch (err) {
      console.error("Error al refrescar fuente individual:", err);
    } finally {
      setRefreshingSourceId(null);
    }
  };

  // Refrescar todas las fuentes
  const handleRefreshAllSources = async () => {
    setRefreshingAll(true);
    try {
      const res = await fetch("/api/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", restore_today: true }),
      });

      if (res.ok) {
        if (onChange) onChange();
      }
    } catch (err) {
      console.error("Error al refrescar todas las fuentes:", err);
    } finally {
      setRefreshingAll(false);
    }
  };

  const handleDelete = async (sourceId) => {
    if (!confirm("¿Estás seguro de eliminar esta fuente y sus artículos asociados?")) return;

    try {
      const res = await fetch(`/api/sources?id=${sourceId}`, { method: "DELETE" });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
        if (onChange) onChange();
      } else {
        alert("No se pudo eliminar la fuente.");
      }
    } catch (err) {
      console.error("Error al eliminar fuente:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
        
        {/* Cabecera con Botón de Refrescar Todo */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Rss size={20} className="text-sky-400" />
              Gestionar Fuentes RSS
            </h3>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefreshAllSources}
              disabled={refreshingAll}
              className="bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 text-xs px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCcw size={14} className={refreshingAll ? "animate-spin" : ""} />
              <span>{refreshingAll ? "Actualizando todo..." : "Refrescar Todo"}</span>
            </button>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Lista de Fuentes */}
        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-gray-400 gap-2">
              <RotateCw size={18} className="animate-spin text-sky-500" />
              <span className="text-sm">Cargando fuentes...</span>
            </div>
          ) : sources.length === 0 ? (
            <p className="text-center text-gray-500 py-10 text-sm">No hay fuentes RSS registradas.</p>
          ) : (
            sources.map((source) => {
              const sId = source.id;
              const sUrl = source.url_feed;
              const isRefreshingThis = refreshingSourceId === sId;
              const nombreFuente = source.titulo || "Fuente sin nombre";

              return (
                <div
                  key={sId}
                  className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition hover:border-gray-700"
                >
                  <div className="space-y-1 overflow-hidden">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {nombreFuente}
                    </h4>
                    <p className="text-xs text-gray-400 truncate max-w-md">
                      {sUrl}
                    </p>
                    {source.categoria && (
                      <span className="inline-block bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded-md font-medium">
                        {source.categoria}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                    <button
                      onClick={() => handleRefreshSingle(source)}
                      disabled={isRefreshingThis}
                      title="Volver a descargar y reinsertar noticias de esta fuente"
                      className="bg-gray-800 hover:bg-gray-700 text-sky-400 text-xs px-3 py-1.5 rounded-lg transition border border-gray-700 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RotateCw size={12} className={isRefreshingThis ? "animate-spin" : ""} />
                      <span>{isRefreshingThis ? "Actualizando..." : "Refrescar"}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(sId)}
                      title="Eliminar fuente"
                      className="bg-red-950/30 hover:bg-red-900/40 text-red-400 text-xs px-3 py-1.5 rounded-lg transition border border-red-900/30 flex items-center gap-1.5"
                    >
                      <Trash2 size={12} />
                      <span>Eliminar</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer del Modal */}
        <div className="flex justify-end pt-2 border-t border-gray-800">
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}