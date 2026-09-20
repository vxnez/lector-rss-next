// src/app/components/ManageSourcesModal.js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Trash2, Rss, Pencil, Save, Plus, Upload, Download, ChevronLeft, Search, Copy, ClipboardPaste } from "lucide-react";
import {
  LoaderCircle as LoaderCircleData,
  RefreshCcw as RefreshCcwData,
  RotateCw as RotateCwData,
  Upload as UploadData,
  X as XData,
  Check as CheckData,
  Circle as CircleData,
  CheckCheck as CheckCheckData,
  Trash2 as Trash2Data,
} from "lucide";
import MorphIcon from "./MorphIcon";
import { useIdioma } from "@/lib/i18n";
import { parsearOPML, construirOPML, normalizarUrlFeed, descargarTexto } from "@/lib/opml";

export default function ManageSourcesModal({ isOpen, onClose, onChange, onNotify, onAgregarFuente }) {
  const { t, locale } = useIdioma();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingSourceId, setRefreshingSourceId] = useState(null);
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [confirmarEliminarId, setConfirmarEliminarId] = useState(null);
  // Interruptor "convertir página completa" por fuente (persistido en BD).
  const [togglingFullPageId, setTogglingFullPageId] = useState(null);
  // Selección múltiple para borrado en lote (eco del sistema de filtros).
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [confirmarLote, setConfirmarLote] = useState(false);
  const [eliminandoLote, setEliminandoLote] = useState(false);
  const [editForm, setEditForm] = useState({ titulo: "", url_feed: "", categoria: "General", convertFullPage: false });
  // Búsqueda en tiempo real por título o URL (case-insensitive).
  const [busqueda, setBusqueda] = useState("");
  // Sub-vista OPML: importar (archivo → selección → alta) y exportar.
  const [vistaOpml, setVistaOpml] = useState(false);
  const [opmlItems, setOpmlItems] = useState([]);
  const [opmlError, setOpmlError] = useState("");
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState({ a: 0, b: 0 });
  const [importeResumen, setImporteResumen] = useState(null);
  const archivoRef = useRef(null);

  const fetchSources = useCallback(async (signal) => {
    try {
      // Fuentes y conteos en paralelo: el modal no espera una tras otra.
      const [res, counts] = await Promise.all([
        fetch("/api/sources", { cache: "no-store", signal }).then((r) => (r.ok ? r.json().catch(() => null) : null)),
        fetch("/api/rss?tipo=conteo_fuentes", { cache: "no-store", signal })
          .then((r) => (r.ok ? r.json().catch(() => null) : null))
          .then((d) => d?.counts || null)
          .catch(() => null),
      ]);
      if (res) {
        const sourcesArr = Array.isArray(res) ? res : (res.sources || res.data || []);
        return sourcesArr.map((s) => ({
          ...s,
          ...(counts && s?.id !== undefined && counts[String(s.id)] !== undefined
            ? { articulos_count: counts[String(s.id)] }
            : {}),
          convertFullPage: Number(s.convert_full_page) === 1 || s.convertFullPage === true,
        }));
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
          setSeleccionadas([]);
          setConfirmarLote(false);
          setBusqueda("");
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
    setConfirmarLote(false);
    setSeleccionadas([]);
    setBusqueda("");
    setVistaOpml(false);
    setOpmlItems([]);
    setOpmlError("");
    setImporteResumen(null);
    onClose();
  };

  // Exporta las fuentes actuales a un OPML descargable (agrupadas por categoría).
  const exportarOPML = () => {
    if (sources.length === 0) {
      onNotify?.(t("fuentes.opml_sin_fuentes"), "error");
      return;
    }
    const fecha = new Date().toISOString().slice(0, 10);
    descargarTexto(construirOPML(sources), `mis-fuentes-${fecha}.opml`);
    onNotify?.(t("fuentes.opml_descargado", { n: sources.length }), "success");
  };

  // Lee el archivo elegido, lo parsea y marca duplicadas contra las actuales.
  const alElegirArchivo = async (event) => {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;
    setOpmlError("");
    setImporteResumen(null);
    let texto = "";
    try {
      texto = await archivo.text();
    } catch {
      setOpmlError(t("fuentes.opml_leer_err"));
      return;
    }
    let items = [];
    try {
      items = parsearOPML(texto);
    } catch {
      setOpmlError(t("fuentes.opml_invalido_err"));
      return;
    }
    if (items.length === 0) {
      setOpmlError(t("fuentes.opml_vacio_err"));
      return;
    }
    const existentes = new Set((sources || []).map((s) => normalizarUrlFeed(s.url_feed || "")));
    setOpmlItems(items.map((item) => {
      const duplicada = existentes.has(normalizarUrlFeed(item.url));
      return { ...item, duplicada, seleccionada: !duplicada };
    }));
  };

  const alternarSeleccion = (url) => {
    setOpmlItems((prev) => prev.map((item) => (
      item.url === url ? { ...item, seleccionada: !item.seleccionada } : item
    )));
  };

  const seleccionarTodas = (valor) => {
    setOpmlItems((prev) => prev.map((item) => (
      item.duplicada ? item : { ...item, seleccionada: valor }
    )));
  };

  // Alta secuencial por /api/rss (igual que Agregar: descarga y clasifica).
  // Las duplicadas que detecte el servidor se cuentan como omitidas.
  const importarSeleccionadas = async () => {
    const pendientes = opmlItems.filter((item) => item.seleccionada && !item.duplicada);
    if (pendientes.length === 0 || importando) return;
    setImportando(true);
    setImporteResumen(null);
    let ok = 0;
    let dup = 0;
    const fallos = [];
    const urlsFallidas = new Set();
    for (let i = 0; i < pendientes.length; i++) {
      const item = pendientes[i];
      setProgreso({ a: i + 1, b: pendientes.length });
      try {
        const res = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url_feed: item.url, categoria: item.categoria || "General" }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || t("fuentes.err_conexion"));
        ok += 1;
      } catch (err) {
        const mensaje = err.message || "";
        if (/ya est[aá] registrada/i.test(mensaje)) dup += 1;
        else {
          fallos.push(`${item.titulo}: ${mensaje}`);
          urlsFallidas.add(item.url);
        }
      }
    }
    setImportando(false);
    setProgreso({ a: 0, b: 0 });
    // Del listado salen las que entraron o ya existían; las fallidas quedan para reintentar.
    setOpmlItems((prev) => prev
      .filter((item) => !pendientes.some((p) => p.url === item.url) || urlsFallidas.has(item.url))
      .map((item) => ({ ...item, seleccionada: false })));
    const resumen = { ok, dup, fail: fallos.length, fallos: fallos.slice(0, 5) };
    setImporteResumen(resumen);
    const sourcesArr = await fetchSources();
    setSources(sourcesArr);
    if (onChange) await onChange();
    onNotify?.(
      t("fuentes.opml_resumen", { ok, dup, fail: fallos.length }),
      fallos.length > 0 ? "error" : "success"
    );
    // Lo importado llega sin clasificar: cola en segundo plano sin clic extra.
    if (ok > 0) procesarColaClasificacion();
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
      let esperaMs = 250;
      try {
        const res = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clasificar_pendientes", lote: 24 }),
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

  // Interruptor por fuente "Convertir la página completa": toggle optimista
  // con reversión si el PUT falla. Al activar, dispara el refresco completo
  // de inmediato para que el usuario vea el listado ampliado sin un clic extra.
  const handleToggleFullPage = async (source) => {
    const sourceId = source.id;
    const siguiente = !(Number(source.convert_full_page) === 1 || source.convertFullPage === true);
    const previo = sources;
    setTogglingFullPageId(sourceId);
    setSources((anteriores) => anteriores.map((s) => (
      s.id === sourceId ? { ...s, convertFullPage: siguiente, convert_full_page: siguiente ? 1 : 0 } : s
    )));
    try {
      const res = await fetch("/api/sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sourceId, convertFullPage: siguiente }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detalle = data?.detalle || data?.error;
        throw new Error(detalle ? `${t("fuentes.convert_full_err")}: ${detalle}` : t("fuentes.convert_full_err"));
      }
      if (onChange) onChange();
      await refrescarConteos();
      if (siguiente) {
        // Activado: refrescar con el crawler completo sin pedir otro clic.
        await handleRefreshSingle({ ...source, convertFullPage: true, convert_full_page: 1 });
      } else {
        onNotify?.(t("fuentes.convert_full_off"), "success");
      }
    } catch (err) {
      console.error("Error al guardar página completa:", err);
      setSources(previo);
      onNotify?.(err.message || t("fuentes.convert_full_err"), "error");
    } finally {
      setTogglingFullPageId(null);
    }
  };

  // Recalcula los contadores por fuente y los fusiona en vivo, sin cerrar
  // el modal ni forzar un refresco general (punto 2: el toggle de página
  // completa y el refresco individual actualizan su contador al instante).
  const refrescarConteos = useCallback(async (signal) => {
    try {
      const r = await fetch("/api/rss?tipo=conteo_fuentes", { cache: "no-store", signal });
      if (!r.ok) return;
      const counts = (await r.json().catch(() => null))?.counts || null;
      if (!counts) return;
      setSources((prev) => prev.map((s) => (
        s?.id !== undefined && counts[String(s.id)] !== undefined
          ? { ...s, articulos_count: counts[String(s.id)] }
          : s
      )));
    } catch (err) {
      if (err?.name !== "AbortError") console.warn("No se pudieron recargar conteos:", err?.message || err);
    }
  }, []);

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
        const nuevos = Number(data.nuevos) || 0;
        let mensaje = data.message || t("fuentes.ok_actualizada");
        if (pendientes > 0 || nuevos > 0) {
          if (pendientes > 0) mensaje += t("fuentes.completando", { n: pendientes });
          procesarColaClasificacion();
        }
        onNotify?.(mensaje, "success");
        await refrescarConteos();
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
        const nuevos = Number(data.nuevos) || 0;
        const sinCambios = data.fuentesSinCambios !== undefined && data.fuentesSinCambios !== null
          ? Number(data.fuentesSinCambios) || 0
          : omitidas;
        let mensaje = restaurados > 0
          ? t("fuentes.todas_ok_restauradas", { n: restaurados })
          : t("fuentes.todas_ok");
        if (nuevos > 0) mensaje += t("fuentes.nuevas", { n: nuevos });
        if (sinCambios > 0) mensaje += t("fuentes.sin_cambios", { n: sinCambios });
        if (pendientes > 0 || nuevos > 0) {
          if (pendientes > 0) mensaje += t("fuentes.completando", { n: pendientes });
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

  const handleDelete = (sourceId) => {
    setConfirmarEliminarId(sourceId);
  };

  const confirmarEliminacion = async () => {
    const sourceId = confirmarEliminarId;
    if (!sourceId) return;
    setConfirmarEliminarId(null);

    try {
      const res = await fetch(`/api/sources?id=${sourceId}`, { method: "DELETE" });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== sourceId));
        setSeleccionadas((prev) => prev.filter((id) => id !== sourceId));
        onNotify?.(t("fuentes.eliminada_ok"), "success");
        if (onChange) onChange();
      } else {
        const data = await res.json().catch(() => ({}));
        const detalle = data?.detalle || data?.error;
        onNotify?.(detalle ? `${t("fuentes.err_eliminar")}: ${detalle}` : t("fuentes.err_eliminar"), "error");
      }
    } catch (err) {
      console.error("Error al eliminar fuente:", err);
      onNotify?.(t("fuentes.err_eliminar_conexion"), "error");
    }
  };

  // Selección múltiple: alternar una, todas (reversible) y borrado en lote.
  const alternarSeleccionFuente = (sourceId) => {
    setSeleccionadas((prev) => (
      prev.includes(sourceId) ? prev.filter((id) => id !== sourceId) : [...prev, sourceId]
    ));
  };

  // Filtrado en tiempo real por título o URL (case-insensitive). Con la
  // búsqueda activa, la selección en lote opera sobre las visibles.
  const consulta = busqueda.trim().toLowerCase();
  const visibleSources = consulta
    ? sources.filter((s) => (
      `${s.titulo || s.nombre || ""} ${s.url_feed || s.url || ""}`.toLowerCase().includes(consulta)
    ))
    : sources;

  const todasSeleccionadas = visibleSources.length > 0 && visibleSources.every((s) => seleccionadas.includes(s.id));

  const alternarTodas = () => {
    setSeleccionadas((prev) => {
      const visiblesIds = visibleSources.map((s) => s.id);
      const todasMarcadas = visiblesIds.length > 0 && visiblesIds.every((id) => prev.includes(id));
      if (todasMarcadas) return prev.filter((id) => !visiblesIds.includes(id));
      return [...new Set([...prev, ...visiblesIds])];
    });
  };

  const confirmarEliminacionLote = async () => {
    if (seleccionadas.length === 0 || eliminandoLote) return;
    setConfirmarLote(false);
    setEliminandoLote(true);
    try {
      const res = await fetch(`/api/sources?ids=${seleccionadas.join(",")}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("fuentes.err_eliminar_lote"));
      const total = Number(data.eliminadas) || seleccionadas.length;
      const borradas = new Set(seleccionadas);
      setSources((prev) => prev.filter((s) => !borradas.has(s.id)));
      setSeleccionadas([]);
      onNotify?.(t("fuentes.eliminadas_ok", { n: total }), "success");
      if (onChange) onChange();
    } catch (err) {
      console.error("Error al eliminar fuentes:", err);
      onNotify?.(err.message || t("fuentes.err_eliminar_lote"), "error");
    } finally {
      setEliminandoLote(false);
    }
  };

  const handleStartEdit = (source) => {
    setEditingSourceId(source.id);
    setEditForm({
      titulo: source.titulo || source.nombre || t("fuentes.sin_nombre"),
      url_feed: source.url_feed || "",
      categoria: source.categoria || "General",
      convertFullPage: Number(source.convert_full_page) === 1 || source.convertFullPage === true,
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
        const detalle = data?.detalle || data?.error;
        throw new Error(detalle ? `${t("fuentes.err_actualizar")}: ${detalle}` : (data.error || t("fuentes.err_actualizar")));
      }

      setSources((prev) => prev.map((source) => (
        source.id === sourceId
          ? { ...source, ...editForm, convert_full_page: editForm.convertFullPage ? 1 : 0 }
          : source
      )));
      setEditingSourceId(null);
      if (onChange) onChange();
    } catch (err) {
      onNotify?.(err.message, "error");
    }
  };

  // Acciones rápidas del portapapeles sobre la URL en edición, con
  // fallback para navegadores sin Clipboard API (contextos no seguros).
  const copiarUrlEdicion = async () => {
    const valor = (editForm.url_feed || "").trim();
    if (!valor) {
      onNotify?.(t("fuentes.url_ph"), "error");
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(valor);
      } else {
        const area = document.createElement("textarea");
        area.value = valor;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      onNotify?.(t("fuentes.url_copiada"), "success");
    } catch {
      onNotify?.(t("fuentes.portapapeles_err"), "error");
    }
  };

  const pegarUrlEdicion = async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error("clipboard");
      const texto = (await navigator.clipboard.readText() || "").trim();
      if (!texto) {
        onNotify?.(t("fuentes.portapapeles_vacio"), "error");
        return;
      }
      setEditForm((form) => ({ ...form, url_feed: texto }));
      onNotify?.(t("fuentes.url_pegada"), "success");
    } catch {
      onNotify?.(t("fuentes.portapapeles_err"), "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="anim-modal bg-gray-900 border border-gray-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl relative max-h-[calc(100dvh-2rem)] flex flex-col">
        
        {/* Cabecera en dos filas: título + cerrar arriba, acciones debajo.
            Así el título nunca se desfasa por falta de espacio. */}
        <div className="pb-4 border-b border-gray-800 space-y-3">
          <div className="flex justify-between items-center gap-3">
            <h3 className="text-balance text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2 min-w-0">
              <Rss size={20} className="shrink-0 text-sky-400" />
              <span className="truncate">{t("fuentes.titulo")}</span>
            </h3>
            <button
              onClick={cerrar}
              aria-label={t("fuentes.cerrar_aria")}
              className="btn-press shrink-0 text-gray-400 hover:text-white p-1.5 rounded-lg bg-gray-800/50 hover:bg-gray-800"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { if (onAgregarFuente) onAgregarFuente(); }}
              title={t("fuentes.agregar_titulo")}
              aria-label={t("fuentes.agregar_aria")}
              className="btn-press group bg-sky-600 hover:bg-sky-500 text-white text-xs px-2 sm:px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 hover:shadow-lg hover:shadow-sky-600/20"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">{t("fuentes.agregar")}</span>
            </button>
            <button
              onClick={() => setVistaOpml((v) => !v)}
              title={t("fuentes.importar_titulo")}
              aria-label={t("fuentes.importar_aria")}
              aria-pressed={vistaOpml}
              className={`btn-press text-xs px-2 sm:px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 border ${
                vistaOpml
                  ? "bg-sky-600/20 text-sky-300 border-sky-500/40"
                  : "bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700"
              }`}
            >
              <MorphIcon icon={vistaOpml ? XData : UploadData} size={14} />
              <span className="hidden sm:inline">{t("fuentes.importar")}</span>
            </button>
            <button
              onClick={exportarOPML}
              title={t("fuentes.exportar_titulo")}
              aria-label={t("fuentes.exportar_aria")}
              className="btn-press bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-2 sm:px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 border border-gray-700"
            >
              <Download size={14} />
              <span className="hidden sm:inline">{t("fuentes.exportar")}</span>
            </button>
            <button
              onClick={handleRefreshAllSources}
              disabled={refreshingAll}
              aria-label={t("fuentes.refrescar_todo_aria")}
              className="btn-press bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/30 text-xs px-2 sm:px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              <MorphIcon
                icon={refreshingAll ? LoaderCircleData : RefreshCcwData}
                size={14}
                className={refreshingAll ? "animate-spin" : ""}
              />
              <span className="hidden sm:inline">{refreshingAll ? t("fuentes.actualizando_todo") : t("fuentes.refrescar_todo")}</span>
            </button>
          </div>

          {/* Buscador de fuentes por título o URL (filtrado en tiempo real). */}
          {!vistaOpml && (
            <label className="relative flex items-center rounded-xl border border-gray-800 bg-gray-950/60 transition focus-within:border-sky-500/60 focus-within:shadow-[0_0_0_3px_rgba(14,165,233,0.15)]">
              <Search size={15} className="absolute left-3 shrink-0 text-gray-500" aria-hidden="true" />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder={t("fuentes.buscar_ph")}
                aria-label={t("fuentes.buscar_aria")}
                className="w-full bg-transparent rounded-xl pl-9 pr-9 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  title={t("fuentes.buscar_limpiar")}
                  aria-label={t("fuentes.buscar_limpiar")}
                  className="btn-press absolute right-2 shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                >
                  <X size={15} />
                </button>
              )}
            </label>
          )}
        </div>

        {/* Barra de selección múltiple: seleccionar todo (reversible),
            conteo y borrado en lote para una eliminación más rápida. */}
        {!vistaOpml && !loading && visibleSources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-800 bg-gray-950/60 px-3 py-2">
            <button
              type="button"
              onClick={alternarTodas}
              aria-pressed={todasSeleccionadas}
              title={todasSeleccionadas ? t("fuentes.quitar_seleccion") : t("fuentes.seleccionar_todo")}
              className={`btn-press flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                todasSeleccionadas
                  ? "border-sky-500 bg-sky-500/15 text-sky-300"
                  : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
              }`}
            >
              <MorphIcon
                icon={todasSeleccionadas ? CheckCheckData : CircleData}
                size={13}
                strokeWidth={2.5}
                className="shrink-0"
              />
              {todasSeleccionadas ? t("fuentes.quitar_seleccion") : t("fuentes.seleccionar_todo")}
            </button>
            {seleccionadas.length > 0 && (
              <span className="text-[11px] text-sky-400">
                {seleccionadas.length === 1
                  ? t("fuentes.sel_una", { n: 1 })
                  : t("fuentes.sel_varias", { n: seleccionadas.length })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setConfirmarLote(true)}
              disabled={seleccionadas.length === 0 || eliminandoLote}
              title={t("fuentes.eliminar_titulo")}
              className="btn-press ml-auto flex items-center gap-1.5 rounded-xl border border-red-900/30 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/40 disabled:opacity-40"
            >
              <MorphIcon
                icon={eliminandoLote ? LoaderCircleData : Trash2Data}
                size={12}
                className={eliminandoLote ? "animate-spin" : ""}
              />
              {t("fuentes.eliminar_sel", { n: seleccionadas.length })}
            </button>
          </div>
        )}

        {/* Sub-vista OPML: elegir archivo, seleccionar feeds e importar */}
        {vistaOpml ? (
          <div className="scroll-oculto overflow-y-auto space-y-3 flex-1 pr-1">
            <button
              type="button"
              onClick={() => setVistaOpml(false)}
              className="btn-press flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white"
            >
              <ChevronLeft size={15} /> {t("fuentes.opml_volver")}
            </button>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-3 sm:p-4 space-y-3">
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload size={15} className="text-sky-400" /> {t("fuentes.opml_titulo")}
              </h4>
              <p className="text-xs leading-relaxed text-gray-400">{t("fuentes.opml_texto")}</p>
              <input
                ref={archivoRef}
                type="file"
                accept=".opml,.xml,.txt,application/xml,text/xml"
                aria-label={t("fuentes.opml_archivo_aria")}
                onChange={alElegirArchivo}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => archivoRef.current?.click()}
                className="btn-press w-full rounded-xl border border-dashed border-gray-700 bg-gray-900 px-3 py-3 text-sm font-medium text-gray-200 hover:border-sky-500 hover:text-white flex items-center justify-center gap-2"
              >
                <Upload size={15} className="text-sky-400" /> {t("fuentes.opml_elegir")}
              </button>
              {opmlError && (
                <p role="alert" className="anim-toast rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {opmlError}
                </p>
              )}
              {importeResumen && (
                <p role="status" className="anim-toast rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                  {t("fuentes.opml_ok")} {t("fuentes.opml_resumen", { ok: importeResumen.ok, dup: importeResumen.dup, fail: importeResumen.fail })}
                </p>
              )}
              {importeResumen?.fallos?.length > 0 && (
                <ul className="space-y-1 rounded-xl border border-red-900/40 bg-red-950/30 px-3 py-2 text-[11px] text-red-300">
                  {importeResumen.fallos.map((f) => (
                    <li key={f} className="truncate" title={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>

            {opmlItems.length > 0 && (
              <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-400">
                    <strong className="text-emerald-300">{t("fuentes.opml_nuevas", { n: opmlItems.filter((i) => !i.duplicada).length })}</strong>
                    {" · "}
                    {t("fuentes.opml_duplicadas", { n: opmlItems.filter((i) => i.duplicada).length })}
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => seleccionarTodas(true)}
                      className="btn-press rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:text-white"
                    >
                      {t("fuentes.opml_todas")}
                    </button>
                    <button
                      type="button"
                      onClick={() => seleccionarTodas(false)}
                      className="btn-press rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-300 hover:text-white"
                    >
                      {t("fuentes.opml_ninguna")}
                    </button>
                  </div>
                </div>
                <ul className="scroll-oculto max-h-64 space-y-1.5 overflow-y-auto pr-1">
                  {opmlItems.map((item) => (
                    <li key={item.url}>
                      <label className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition ${
                        item.duplicada
                          ? "border-gray-800 bg-gray-900/50 opacity-60"
                          : item.seleccionada
                            ? "border-sky-500/50 bg-sky-500/10"
                            : "border-gray-800 bg-gray-900 hover:border-gray-600"
                      }`}>
                        <input
                          type="checkbox"
                          checked={item.seleccionada}
                          disabled={item.duplicada || importando}
                          onChange={() => alternarSeleccion(item.url)}
                          aria-label={item.titulo}
                          className="h-4 w-4 shrink-0 accent-sky-500"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium text-gray-100">{item.titulo}</span>
                          <span className="block truncate text-[11px] text-gray-500">{item.url}</span>
                        </span>
                        {item.categoria && (
                          <span className="shrink-0 rounded-md bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                            {item.categoria}
                          </span>
                        )}
                        {item.duplicada && (
                          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                            {t("fuentes.opml_duplicada_tag")}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
                {importando && (
                  <div className="space-y-1.5" role="status" aria-live="polite">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-800">
                      <div
                        className="step-fill h-full rounded-full bg-sky-500"
                        style={{ transform: `scaleX(${progreso.b > 0 ? progreso.a / progreso.b : 0})` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">{t("fuentes.opml_importando", { a: progreso.a, b: progreso.b })}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={importarSeleccionadas}
                  disabled={importando || opmlItems.filter((i) => i.seleccionada && !i.duplicada).length === 0}
                  className="btn-press w-full rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 hover:shadow-lg hover:shadow-sky-600/20 flex items-center justify-center gap-2"
                >
                  <Upload size={15} />
                  {t("fuentes.opml_importar_btn", { n: opmlItems.filter((i) => i.seleccionada && !i.duplicada).length })}
                </button>
              </div>
            )}
          </div>
        ) : (
        <>
        {/* Lista de Fuentes */}
        <div className="scroll-oculto overflow-y-auto space-y-3 flex-1 pr-1">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-gray-400 gap-2">
              <MorphIcon icon={LoaderCircleData} size={18} className="animate-spin text-sky-500" />
              <span className="text-sm">{t("fuentes.cargando")}</span>
            </div>
          ) : visibleSources.length === 0 ? (
            consulta ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm text-gray-400">{t("fuentes.sin_resultados")}</p>
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="btn-press rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-xs font-medium text-gray-200 hover:border-gray-500 hover:text-white"
                >
                  {t("fuentes.buscar_limpiar")}
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-10 text-sm">{t("fuentes.vacio")}</p>
            )
          ) : (
            visibleSources.map((source, indice) => {
              const sId = source.id;
              const sUrl = source.url_feed;
              const isRefreshingThis = refreshingSourceId === sId;
              const nombreFuente = source.titulo || source.nombre || t("fuentes.sin_nombre");
              const isEditing = editingSourceId === sId;
              const marcada = seleccionadas.includes(sId);
              const fullPageActivo = Number(source.convert_full_page) === 1 || source.convertFullPage === true;
              const isTogglingThis = togglingFullPageId === sId;

              return (
                <div
                  key={sId}
                  style={{ "--stagger-delay": `${Math.min(indice * 40, 320)}ms` }}
                  className={`stagger-in card-lift bg-gray-950/60 border rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 transition ${
                    marcada
                      ? "border-sky-500/50 bg-sky-500/5 hover:border-sky-500/70"
                      : "border-gray-800/80 hover:border-gray-600"
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={marcada}
                      aria-label={`${t("fuentes.seleccionar_aria")}: ${nombreFuente}`}
                      title={`${t("fuentes.seleccionar_aria")}: ${nombreFuente}`}
                      onClick={() => alternarSeleccionFuente(sId)}
                      className="btn-press mt-0.5 shrink-0 rounded-lg p-1 hover:bg-gray-800"
                    >
                      <MorphIcon
                        icon={marcada ? CheckData : CircleData}
                        size={18}
                        strokeWidth={2.5}
                        className={marcada ? "text-sky-400" : "text-gray-600"}
                      />
                    </button>
                    {isEditing ? (
                    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2">
                      <input
                        value={editForm.titulo}
                        onChange={(event) => setEditForm((form) => ({ ...form, titulo: event.target.value }))}
                        placeholder={t("fuentes.nombre_ph")}
                        aria-label={t("fuentes.nombre_ph")}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          value={editForm.url_feed}
                          onChange={(event) => setEditForm((form) => ({ ...form, url_feed: event.target.value }))}
                          placeholder={t("fuentes.url_ph")}
                          aria-label={t("fuentes.url_ph")}
                          className="min-w-0 flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                        />
                        <button
                          type="button"
                          onClick={copiarUrlEdicion}
                          title={t("fuentes.copiar_url")}
                          aria-label={t("fuentes.copiar_url")}
                          className="btn-press shrink-0 rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-300 hover:border-gray-500 hover:text-white"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={pegarUrlEdicion}
                          title={t("fuentes.pegar_url")}
                          aria-label={t("fuentes.pegar_url")}
                          className="btn-press shrink-0 rounded-lg border border-gray-700 bg-gray-900 p-2 text-gray-300 hover:border-gray-500 hover:text-white"
                        >
                          <ClipboardPaste size={14} />
                        </button>
                      </div>
                      <input
                        value={editForm.categoria}
                        onChange={(event) => setEditForm((form) => ({ ...form, categoria: event.target.value }))}
                        placeholder={t("fuentes.cat_ph")}
                        aria-label={t("fuentes.cat_ph")}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2 hover:border-gray-600 transition">
                        <input
                          type="checkbox"
                          checked={Boolean(editForm.convertFullPage)}
                          onChange={(event) => setEditForm((form) => ({ ...form, convertFullPage: event.target.checked }))}
                          aria-label={t("fuentes.convert_full_aria")}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500"
                        />
                        <span>
                          <span className="block text-xs font-medium text-gray-200">{t("fuentes.convert_full")}</span>
                          <span className="block text-[11px] text-gray-500 leading-relaxed">{t("fuentes.convert_full_hint")}</span>
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="min-w-0 flex-1 space-y-1 overflow-hidden">
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
                      <button
                        type="button"
                        role="switch"
                        aria-checked={fullPageActivo}
                        aria-label={`${t("fuentes.convert_full_aria")}: ${nombreFuente}`}
                        title={t("fuentes.convert_full_hint")}
                        disabled={isTogglingThis}
                        onClick={() => handleToggleFullPage(source)}
                        className="btn-press mt-1 flex max-w-full items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/60 px-2 py-1.5 text-left hover:border-gray-600 disabled:opacity-50"
                      >
                        <span
                          aria-hidden="true"
                          className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${
                            fullPageActivo ? "bg-sky-500" : "bg-gray-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${
                              fullPageActivo ? "translate-x-3.5" : "translate-x-0.5"
                            }`}
                          />
                        </span>
                        <span className="min-w-0">
                          <span className={`block truncate text-[11px] font-medium ${fullPageActivo ? "text-sky-300" : "text-gray-400"}`}>
                            {t("fuentes.convert_full")}{isTogglingThis ? "…" : ""}
                          </span>
                          <span className="block truncate text-[10px] text-gray-500">{t("fuentes.convert_full_hint")}</span>
                        </span>
                      </button>
                    </div>
                  )}
                  </div>

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
                          title={fullPageActivo ? `${t("fuentes.refrescar_titulo")} · ${t("fuentes.convert_full")}` : t("fuentes.refrescar_titulo")}
                          className={`btn-press text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 disabled:opacity-50 ${
                            fullPageActivo
                              ? "bg-sky-600/20 text-sky-300 border-sky-500/40 hover:bg-sky-600/30"
                              : "bg-gray-800 hover:bg-gray-700 text-sky-400 border-gray-700"
                          }`}
                        >
                          <MorphIcon
                            icon={isRefreshingThis ? LoaderCircleData : RotateCwData}
                            size={12}
                            className={isRefreshingThis ? "animate-spin" : ""}
                          />
                          <span>{isRefreshingThis ? t("fuentes.actualizando") : t("fuentes.refrescar")}</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleDelete(sId)}
                      title={t("fuentes.eliminar_titulo")}
                      aria-live="polite"
                      className="btn-press flex items-center gap-1.5 rounded-xl border border-red-900/30 bg-red-950/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/40"
                    >
                      <Trash2 size={12} />
                      <span>{t("fuentes.eliminar")}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        </>
        )}

        {confirmarEliminarId && (
          <div
            className="anim-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            role="presentation"
            onClick={() => setConfirmarEliminarId(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-eliminar-fuente"
              onClick={(event) => event.stopPropagation()}
              className="anim-modal w-full max-w-sm space-y-4 rounded-2xl border border-red-900/60 bg-app-surface p-6 shadow-2xl"
            >
              <h3 id="titulo-eliminar-fuente" className="text-lg font-bold text-app-fg">
                {t("fuentes.eliminar_modal_titulo")}
              </h3>
              <p className="text-sm leading-relaxed text-app-muted">
                {t("fuentes.eliminar_modal_texto", {
                  nombre: sources.find((source) => source.id === confirmarEliminarId)?.titulo || t("fuentes.sin_nombre"),
                })}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmarEliminarId(null)}
                  className="btn-press rounded-xl bg-app-raised px-4 py-2.5 text-sm font-medium text-app-fg hover:opacity-90"
                >
                  {t("comun.cancelar")}
                </button>
                <button
                  type="button"
                  onClick={confirmarEliminacion}
                  className="btn-press rounded-xl bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-900/30"
                >
                  {t("fuentes.eliminar")}
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmarLote && (
          <div
            className="anim-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            role="presentation"
            onClick={() => setConfirmarLote(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-eliminar-fuentes"
              onClick={(event) => event.stopPropagation()}
              className="anim-modal w-full max-w-sm space-y-4 rounded-2xl border border-red-900/60 bg-app-surface p-6 shadow-2xl"
            >
              <h3 id="titulo-eliminar-fuentes" className="text-lg font-bold text-app-fg">
                {t("fuentes.eliminar_lote_titulo", { n: seleccionadas.length })}
              </h3>
              <p className="text-sm leading-relaxed text-app-muted">
                {t("fuentes.eliminar_lote_texto", { n: seleccionadas.length })}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmarLote(false)}
                  className="btn-press rounded-xl bg-app-raised px-4 py-2.5 text-sm font-medium text-app-fg hover:opacity-90"
                >
                  {t("comun.cancelar")}
                </button>
                <button
                  type="button"
                  onClick={confirmarEliminacionLote}
                  className="btn-press rounded-xl bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 hover:shadow-lg hover:shadow-red-900/30"
                >
                  {t("fuentes.eliminar_sel", { n: seleccionadas.length })}
                </button>
              </div>
            </div>
          </div>
        )}

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