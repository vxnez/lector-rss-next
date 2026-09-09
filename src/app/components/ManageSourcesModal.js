// src/app/components/ManageSourcesModal.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trash2, RotateCw, RefreshCcw, Rss, Pencil, Save } from "lucide-react";

export default function ManageSourcesModal({ isOpen, onClose, onChange, onNotify }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingSourceId, setRefreshingSourceId] = useState(null);
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [editForm, setEditForm] = useState({ titulo: "", url_feed: "", categoria: "General" });

  const fetchSources = useCallback(async (signal) => {
    try {
      const res = await fetch("/api/sources", { cache: "no-store", signal });
      if (res.ok) {
        const data = await res.json();
        const sourcesArr = Array.isArray(data) ? data : (data.sources || data.data || []);
        return sourcesArr;
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error al obtener fuentes:", err);
      }
    }
    return [];
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    if (isOpen) {
      fetchSources(controller.signal).then((sourcesArr) => {
        if (!controller.signal.aborted) {
          setSources(sourcesArr);
          setLoading(false);
        }
      });
    }

    return () => {
      controller.abort();
    };
  }, [isOpen, fetchSources]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Clasifica la cola de pendientes por lotes hasta agotarla (progreso visible)
  const procesarColaClasificacion = useCallback(async () => {
    for (let intento = 0; intento < 12; intento++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      try {
        const res = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clasificar_pendientes", lote: 12 }),
        });
        if (!res.ok) break;
        const data = await res.json().catch(() => ({}));
        if (onChange) await onChange();
        if (!Number(data.restantes)) break;
      } catch {
        break;
      }
    }
  }, [onChange]);

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
        const data = await res.json().catch(() => ({}));
        const pendientes = Number(data.pendientes) || 0;
        onNotify?.(
          pendientes > 0
            ? `Fuente actualizada. Completando ${pendientes} categorías en segundo plano...`
            : "Fuente actualizada correctamente.",
          "success"
        );
        if (onChange) onChange();
        if (pendientes > 0) {
          procesarColaClasificacion();
        }
      } else {
        onNotify?.("No se pudo refrescar la fuente seleccionada.", "error");
      }
    } catch (err) {
      console.error("Error al refrescar fuente individual:", err);
      onNotify?.("Error de conexión al refrescar la fuente.", "error");
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
        const data = await res.json().catch(() => ({}));
        const sourcesArr = await fetchSources();
        setSources(sourcesArr);
        const restaurados = Number(data.restaurados) || 0;
        const pendientes = Number(data.pendientes) || 0;
        let mensaje = restaurados > 0
          ? `Todas las fuentes fueron actualizadas. Se recuperaron ${restaurados} noticias borradas.`
          : "Todas las fuentes fueron actualizadas.";
        if (pendientes > 0) {
          mensaje += ` Completando ${pendientes} categorías en segundo plano...`;
          procesarColaClasificacion();
        }
        onNotify?.(mensaje, "success");
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
        onNotify?.("Fuente eliminada correctamente.", "success");
        if (onChange) onChange();
      } else {
        onNotify?.("No se pudo eliminar la fuente.", "error");
      }
    } catch (err) {
      console.error("Error al eliminar fuente:", err);
      onNotify?.("Error de conexión al eliminar la fuente.", "error");
    }
  };

  const handleStartEdit = (source) => {
    setEditingSourceId(source.id);
    setEditForm({
      titulo: source.titulo || source.nombre || "Fuente RSS",
      url_feed: source.url_feed || "",
      categoria: source.categoria || "General",
    });
  };

  const handleSaveEdit = async (sourceId) => {
    try {
      const res = await fetch("/api/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sourceId, ...editForm }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "No se pudo actualizar la fuente");
      }

      setSources((prev) => prev.map((source) => (
        source.id === sourceId ? { ...source, ...editForm } : source
      )));
      setEditingSourceId(null);
      if (onChange) onChange();
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  if (!isOpen) return null;

  const visibleSources = sources;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[calc(100dvh-2rem)] flex flex-col">
        
        {/* Cabecera con Botón de Refrescar Todo */}
        <div className="flex justify-between items-start gap-3 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Rss size={20} className="text-sky-400" />
              Gestionar Fuentes RSS
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefreshAllSources}
              disabled={refreshingAll}
              aria-label="Refrescar todas las fuentes RSS"
              className="bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 text-xs px-2 sm:px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCcw size={14} className={refreshingAll ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{refreshingAll ? "Actualizando todo..." : "Refrescar Todo"}</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Cerrar gestión de fuentes"
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
          ) : visibleSources.length === 0 ? (
            <p className="text-center text-gray-500 py-10 text-sm">No hay fuentes RSS registradas.</p>
          ) : (
            visibleSources.map((source) => {
              const sId = source.id;
              const sUrl = source.url_feed;
              const isRefreshingThis = refreshingSourceId === sId;
              const nombreFuente = source.titulo || source.nombre || "Fuente sin nombre";
              const isEditing = editingSourceId === sId;

              return (
                <div
                  key={sId}
                  className="bg-gray-950/60 border border-gray-800/80 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 transition hover:border-gray-700"
                >
                  {isEditing ? (
                    <div className="grid grid-cols-1 gap-2 w-full">
                      <input
                        value={editForm.titulo}
                        onChange={(event) => setEditForm((form) => ({ ...form, titulo: event.target.value }))}
                        placeholder="Nombre de la fuente"
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <input
                        value={editForm.url_feed}
                        onChange={(event) => setEditForm((form) => ({ ...form, url_feed: event.target.value }))}
                        placeholder="URL del feed RSS"
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                      <input
                        value={editForm.categoria}
                        onChange={(event) => setEditForm((form) => ({ ...form, categoria: event.target.value }))}
                        placeholder="Categoría de la fuente"
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1 overflow-hidden w-full min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">{nombreFuente}</h4>
                      <p className="text-xs text-gray-400 truncate max-w-md">{sUrl}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="text-emerald-300">● {source.estado || "activa"}</span>
                        <span className="text-gray-500">{Number(source.articulos_count || 0)} artículos</span>
                        {source.ultima_actualizacion && (
                          <span className="text-gray-500">
                            Actualizada {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(source.ultima_actualizacion))}
                          </span>
                        )}
                      </div>
                      {source.categoria && (
                        <span className="inline-block bg-gray-800 text-gray-300 text-[10px] px-2 py-0.5 rounded-md font-medium">
                          {source.categoria}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-center flex-shrink-0 sm:justify-end">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(sId)}
                          title="Guardar cambios"
                          className="bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs px-3 py-1.5 rounded-lg transition border border-emerald-900/40 flex items-center gap-1.5"
                        >
                          <Save size={12} />
                          <span>Guardar</span>
                        </button>
                        <button
                          onClick={() => setEditingSourceId(null)}
                          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-lg transition border border-gray-700"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(source)}
                          title="Editar fuente"
                          className="bg-gray-800 hover:bg-gray-700 text-sky-400 text-xs px-3 py-1.5 rounded-lg transition border border-gray-700 flex items-center gap-1.5"
                        >
                          <Pencil size={12} />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleRefreshSingle(source)}
                          disabled={isRefreshingThis}
                          title="Volver a descargar y reinsertar noticias de esta fuente"
                          className="bg-gray-800 hover:bg-gray-700 text-sky-400 text-xs px-3 py-1.5 rounded-lg transition border border-gray-700 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RotateCw size={12} className={isRefreshingThis ? "animate-spin" : ""} />
                          <span>{isRefreshingThis ? "Actualizando..." : "Refrescar"}</span>
                        </button>
                      </>
                    )}

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