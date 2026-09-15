// src/app/components/ManageSourcesModal.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Trash2, RotateCw, RefreshCcw, Rss, Pencil, Save, Plus } from "lucide-react";
import { useIdioma } from "@/lib/i18n";

export default function ManageSourcesModal({ isOpen, onClose, onChange, onNotify, onAgregarFuente }) {
  const { t, locale } = useIdioma();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingSourceId, setRefreshingSourceId] = useState(null);
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);
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

  const cerrar = () => {
    setConfirmarEliminarId(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

  // Clasifica la cola de pendientes por lotes hasta agotarla (progreso visible)
  const procesarColaClasificacion = useCallback(async () => {
    for (let intento = 0; intento < 12; intento++) {
      let esperaMs = 500;
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
        if (Number(data.reintentarEn) > 0) esperaMs = Number(data.reintentarEn) * 1000;
      } catch {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, esperaMs));
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
        let mensaje = data.message || t("fuentes.ok_actualizada");
        if (pendientes > 0) {
          mensaje += t("fuentes.completando", { n: pendientes });
          procesarColaClasificacion();
        }
        onNotify?.(mensaje, "success");
        if (onChange) onChange();
      } else {
        onNotify?.(t("fuentes.err_refrescar"), "error");
      }
    } catch (err) {
      console.error("Error al refrescar fuente individual:", err);
      onNotify?.(t("fuentes.err_conexion"), "error");
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
        const omitidas = Number(data.omitidas) || 0;
        let mensaje = restaurados > 0
          ? t("fuentes.todas_ok_restauradas", { n: restaurados })
          : t("fuentes.todas_ok");
        if (omitidas > 0) mensaje += t("fuentes.sin_cambios", { n: omitidas });
        if (pendientes > 0) {
          mensaje += t("fuentes.completando", { n: pendientes });
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

  // Borrado en dos pasos (sin confirm() nativo): el primer clic arma la
  // confirmación y el segundo ejecuta. Se desarma al cerrar o cambiar.
  const handleDelete = async (sourceId) => {
    if (confirmarEliminarId !== sourceId) {
      setConfirmarEliminarId(sourceId);
      return;
    }
    setConfirmarEliminarId(null);

    try {
      const res = await fetch(`/api/sources?id=${sourceId}`, { method: "DELETE" });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
        onNotify?.(t("fuentes.eliminada_ok"), "success");
        if (onChange) onChange();
      } else {
        onNotify?.(t("fuentes.err_eliminar"), "error");
      }
    } catch (err) {
      console.error("Error al eliminar fuente:", err);
      onNotify?.(t("fuentes.err_eliminar_conexion"), "error");
    }
  };

  const handleStartEdit = (source) => {
    setEditingSourceId(source.id);
    setEditForm({
      titulo: source.titulo || source.nombre || t("fuentes.sin_nombre"),
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
        throw new Error(data.error || t("fuentes.err_actualizar"));
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
    <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="anim-modal bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl relative max-h-[calc(100dvh-2rem)] flex flex-col">
        
        {/* Cabecera con Botón de Refrescar Todo */}
        <div className="flex justify-between items-start gap-3 pb-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Rss size={20} className="text-sky-400" />
              {t("fuentes.titulo")}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { if (onAgregarFuente) onAgregarFuente(); }}
              title={t("fuentes.agregar_titulo")}
              aria-label={t("fuentes.agregar_aria")}
              className="btn-press group bg-sky-600 hover:bg-sky-500 text-white text-xs px-2 sm:px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 shadow-lg shadow-sky-600/20"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{t("fuentes.agregar")}</span>
            </button>
            <button
              onClick={handleRefreshAllSources}
              disabled={refreshingAll}
              aria-label={t("fuentes.refrescar_todo_aria")}
              className="btn-press bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 text-xs px-2 sm:px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCcw size={14} className={refreshingAll ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{refreshingAll ? t("fuentes.actualizando_todo") : t("fuentes.refrescar_todo")}</span>
            </button>

            <button
              onClick={cerrar}
              aria-label={t("fuentes.cerrar_aria")}
              className="btn-press text-gray-400 hover:text-white p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-800"
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
              <span className="text-sm">{t("fuentes.cargando")}</span>
            </div>
          ) : visibleSources.length === 0 ? (
            <p className="text-center text-gray-500 py-10 text-sm">{t("fuentes.vacio")}</p>
          ) : (
            visibleSources.map((source, indice) => {
              const sId = source.id;
              const sUrl = source.url_feed;
              const isRefreshingThis = refreshingSourceId === sId;
              const nombreFuente = source.titulo || source.nombre || t("fuentes.sin_nombre");
              const isEditing = editingSourceId === sId;

              return (
                <div
                  key={sId}
                  style={{ "--stagger-delay": `${Math.min(indice * 40, 320)}ms` }}
                  className="stagger-in card-lift bg-gray-950/60 border border-gray-800/80 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 hover:border-gray-600"
                >
                  {isEditing ? (
                    <div className="grid grid-cols-1 gap-2 w-full">
                      <input
                        value={editForm.titulo}
                        onChange={(event) => setEditForm((form) => ({ ...form, titulo: event.target.value }))}
                        placeholder={t("fuentes.nombre_ph")}
                        aria-label={t("fuentes.nombre_ph")}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <input
                        value={editForm.url_feed}
                        onChange={(event) => setEditForm((form) => ({ ...form, url_feed: event.target.value }))}
                        placeholder={t("fuentes.url_ph")}
                        aria-label={t("fuentes.url_ph")}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                      <input
                        value={editForm.categoria}
                        onChange={(event) => setEditForm((form) => ({ ...form, categoria: event.target.value }))}
                        placeholder={t("fuentes.cat_ph")}
                        aria-label={t("fuentes.cat_ph")}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1 overflow-hidden w-full min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate">{nombreFuente}</h4>
                      <p className="text-xs text-gray-400 truncate max-w-md">{sUrl}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="text-emerald-300">● {source.estado || t("fuentes.activa")}</span>
                        <span className="text-gray-500">{t("fuentes.articulos", { n: Number(source.articulos_count || 0) })}</span>
                        {source.ultima_actualizacion && (
                          <span className="text-gray-500">
                            {t("fuentes.actualizada", { fecha: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(source.ultima_actualizacion)) })}
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
                          title={t("fuentes.guardar_titulo")}
                          className="btn-press bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs px-3 py-1.5 rounded-xl border border-emerald-900/40 flex items-center gap-1.5"
                        >
                          <Save size={12} />
                          <span>{t("fuentes.guardar")}</span>
                        </button>
                        <button
                          onClick={() => setEditingSourceId(null)}
                          className="btn-press bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-xl border border-gray-700"
                        >
                          {t("fuentes.cancelar")}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(source)}
                          title={t("fuentes.editar_titulo")}
                          className="btn-press bg-gray-800 hover:bg-gray-700 text-sky-400 text-xs px-3 py-1.5 rounded-xl border border-gray-700 flex items-center gap-1.5"
                        >
                          <Pencil size={12} />
                          <span>{t("fuentes.editar")}</span>
                        </button>
                        <button
                          onClick={() => handleRefreshSingle(source)}
                          disabled={isRefreshingThis}
                          title={t("fuentes.refrescar_titulo")}
                          className="btn-press bg-gray-800 hover:bg-gray-700 text-sky-400 text-xs px-3 py-1.5 rounded-xl border border-gray-700 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RotateCw size={12} className={isRefreshingThis ? "animate-spin" : ""} />
                          <span>{isRefreshingThis ? t("fuentes.actualizando") : t("fuentes.refrescar")}</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDelete(sId)}
                      title={confirmarEliminarId === sId ? t("fuentes.eliminar_confirmar") : t("fuentes.eliminar_titulo")}
                      aria-live="polite"
                      className={`btn-press text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                        confirmarEliminarId === sId
                          ? "bg-red-700 hover:bg-red-600 text-white border-red-600"
                          : "bg-red-950/30 hover:bg-red-900/40 text-red-400 border-red-900/30"
                      }`}
                    >
                      <Trash2 size={12} />
                      <span>{confirmarEliminarId === sId ? t("fuentes.eliminar_confirmar") : t("fuentes.eliminar")}</span>
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
            onClick={cerrar}
            className="btn-press bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-xl"
          >
            {t("fuentes.cerrar")}
          </button>
        </div>

      </div>
    </div>
  );
}