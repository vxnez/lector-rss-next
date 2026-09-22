// src/app/components/NewsFeed.js
"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Trash2, ExternalLink, Globe, Calendar, Clock } from "lucide-react";
import { Check as CheckData, CheckCheck as CheckCheckData } from "lucide";
import { Bookmark as BookmarkData, BookmarkCheck as BookmarkCheckData } from "lucide";
import MorphIcon from "./MorphIcon";
import { animarEntradaTarjetas } from "@/lib/animaciones";
import { resumenPlano } from "./ResumenEstructurado";
import InsigniaCategoria from "./InsigniaCategoria";
import { tiempoLecturaMinutos } from "@/lib/lectura";
import { formatFecha, nombreFuenteDeArticulo } from "@/lib/formato";
import { useIdioma } from "@/lib/i18n";
import ErrorBoundary, { LectorErrorFallback } from "./ErrorBoundary";

// El lector solo se necesita cuando se abre una noticia: fuera del bundle inicial.
const ArticleReaderModal = dynamic(() => import("./ArticleReaderModal"), { ssr: false });

const pillDominioStyle = {
  backgroundColor: "color-mix(in srgb, var(--accent) 16%, transparent)",
  color: "var(--accent-ink)",
  borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
};

// 1. MODO TARJETAS (Cards) — Cuadrícula tradicional con efecto Spotlight
const TarjetaCards = memo(function TarjetaCards({
  art,
  indice = 0,
  plena = false,
  activo = false,
  onAbrir,
  onToggleRead,
  onToggleSave,
  onDelete,
  t,
  locale,
}) {
  const isLeido = Boolean(art.leido);
  const isGuardado = Boolean(art.guardado);
  const atenuada = isLeido && !plena;
  const nombreFuente = nombreFuenteDeArticulo(art, t("tarjeta.fuente_generica"));
  const fechaFormateada = formatFecha(art.fecha_publicacion, t("tarjeta.reciente"), locale);
  const minutosLectura = tiempoLecturaMinutos(art.titulo, art.resumen);

  const fijarSpot = useCallback((event) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spot-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--spot-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
  }, []);

  return (
    <div
      id={`noticia-${art.id}`}
      style={{ "--stagger-delay": `${Math.min(indice * 30, 240)}ms` }}
      onMouseMove={fijarSpot}
      className={`tarjeta-noticia stagger-in card-lift spotlight-card group bezel-outer p-[3px] focus-within:border-[var(--accent)]/60 ${
        activo ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-app-bg" : ""
      } ${
        atenuada
          ? "opacity-50 saturate-[75%]"
          : "opacity-100 hover:shadow-[0_20px_48px_-20px_color-mix(in_srgb,var(--accent)_50%,transparent)]"
      }`}
    >
      <div
        className={`bezel-inner flex h-full flex-col justify-between p-5 ${
          atenuada ? "bg-app-surface/70" : "bg-app-surface"
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2 notranslate" translate="no">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span
                style={pillDominioStyle}
                className={`text-[11px] font-bold border px-2 py-0.5 rounded flex items-center gap-1.5 tracking-wide transition-opacity ${
                  atenuada ? "opacity-60" : "opacity-100"
                }`}
              >
                <Globe size={11} className="shrink-0" />
                <span className="truncate max-w-[140px]">{nombreFuente}</span>
              </span>
              {fechaFormateada && (
                <span className="flex items-center gap-1 bg-app-raised/60 border border-app-line/60 text-app-muted px-2 py-0.5 rounded text-[11px]">
                  <Calendar size={11} className="opacity-75" />
                  <span>{fechaFormateada}</span>
                </span>
              )}
              <span
                className="flex items-center gap-1 bg-app-raised/60 border border-app-line/60 text-app-muted px-2 py-0.5 rounded text-[11px]"
                title={t("tarjeta.min_titulo", { n: minutosLectura })}
              >
                <Clock size={11} className="opacity-75" />
                <span>{t("tarjeta.min", { n: minutosLectura })}</span>
              </span>
            </div>
            <button
              onClick={() => onDelete(art.id)}
              aria-label={t("tarjeta.descartar_aria")}
              title={t("tarjeta.descartar_titulo")}
              className="btn-press text-app-muted hover:text-rose-400 p-1.5 rounded-lg hover:bg-app-raised transition shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <h3
            onClick={() => onAbrir(art)}
            className={`text-balance text-[17px] font-bold leading-snug tracking-tight mb-2 cursor-pointer transition line-clamp-2 ${
              atenuada ? "text-app-muted line-through decoration-app-muted" : "text-app-fg hover:text-[var(--accent)]"
            }`}
          >
            {art.titulo}
          </h3>
          <p
            onClick={() => onAbrir(art)}
            className={`resumen-noticia text-pretty text-[13px] leading-relaxed line-clamp-3 mb-4 cursor-pointer transition ${
              atenuada ? "text-app-muted" : "text-app-muted hover:text-app-fg"
            }`}
          >
            {resumenPlano(art.resumen)}
          </p>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-app-line/80 gap-1.5 text-xs notranslate" translate="no">
          <button
            onClick={() => onAbrir(art)}
            className="btn-press text-[var(--accent)] hover:underline flex items-center gap-1.5 font-medium text-xs rounded-md whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
            <span>{t("tarjeta.leer")}</span>
            <ExternalLink size={12} className="shrink-0" />
          </button>
          <div className="flex items-center gap-1.5 min-w-0 shrink">
            <InsigniaCategoria
              categoria={art.categoria}
              t={t}
              className="flex px-2 py-1 text-[11px] shrink min-w-0"
            />
            <button
              onClick={() => onToggleRead(art.id, isLeido)}
              aria-label={isLeido ? t("tarjeta.desmarcar") : t("tarjeta.marcar")}
              aria-pressed={isLeido}
              className={`btn-press p-1.5 rounded-lg border shrink-0 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                isLeido
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-app-raised/80 border-app-line text-app-muted hover:text-app-fg"
              }`}
              title={isLeido ? t("tarjeta.desmarcar") : t("tarjeta.marcar")}
            >
              <MorphIcon icon={isLeido ? CheckCheckData : CheckData} size={13} aria-hidden="true" />
            </button>
            <button
              onClick={() => onToggleSave(art.id, isGuardado)}
              aria-label={isGuardado ? t("tarjeta.guardar_quitar") : t("tarjeta.guardar_nuevo")}
              aria-pressed={isGuardado}
              className={`btn-press p-1.5 rounded-lg border shrink-0 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                isGuardado
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                  : "bg-app-raised/80 border-app-line text-app-muted hover:text-app-fg"
              }`}
              title={isGuardado ? t("tarjeta.guardar_quitar") : t("tarjeta.guardar_nuevo")}
            >
              <MorphIcon icon={isGuardado ? BookmarkCheckData : BookmarkData} size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// 2. MODO REVISTA (Magazine) — Fila horizontal con balance editorial
const TarjetaMagazine = memo(function TarjetaMagazine({
  art,
  indice = 0,
  plena = false,
  activo = false,
  onAbrir,
  onToggleRead,
  onToggleSave,
  onDelete,
  t,
  locale,
}) {
  const isLeido = Boolean(art.leido);
  const isGuardado = Boolean(art.guardado);
  const atenuada = isLeido && !plena;
  const nombreFuente = nombreFuenteDeArticulo(art, t("tarjeta.fuente_generica"));
  const fechaFormateada = formatFecha(art.fecha_publicacion, t("tarjeta.reciente"), locale);
  const minutosLectura = tiempoLecturaMinutos(art.titulo, art.resumen);

  return (
    <div
      id={`noticia-${art.id}`}
      style={{ "--stagger-delay": `${Math.min(indice * 20, 200)}ms` }}
      className={`tarjeta-noticia stagger-in card-lift group rounded-2xl border p-4 transition-all duration-200 ${
        activo
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/50 bg-app-surface/90 shadow-md"
          : "border-app-line/80 bg-app-surface/70 hover:border-app-line hover:bg-app-surface"
      } ${atenuada ? "opacity-60 saturate-[80%]" : "opacity-100"}`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Contenido principal */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span
              style={pillDominioStyle}
              className="text-[11px] font-bold border px-2 py-0.5 rounded flex items-center gap-1"
            >
              <Globe size={11} className="shrink-0" />
              <span className="truncate max-w-[130px]">{nombreFuente}</span>
            </span>
            {fechaFormateada && (
              <span className="text-app-muted text-[11px] flex items-center gap-1">
                <Calendar size={11} className="opacity-70" />
                {fechaFormateada}
              </span>
            )}
            <span className="text-app-muted text-[11px] flex items-center gap-1">
              <Clock size={11} className="opacity-70" />
              {t("tarjeta.min", { n: minutosLectura })}
            </span>
            <InsigniaCategoria
              categoria={art.categoria}
              t={t}
              className="inline-flex px-2 py-0.5 text-[10px]"
            />
          </div>

          <h3
            onClick={() => onAbrir(art)}
            className={`text-base md:text-lg font-bold leading-snug cursor-pointer transition line-clamp-2 ${
              atenuada ? "text-app-muted line-through" : "text-app-fg hover:text-[var(--accent)]"
            }`}
          >
            {art.titulo}
          </h3>

          <p
            onClick={() => onAbrir(art)}
            className="text-app-muted text-xs leading-relaxed line-clamp-2 cursor-pointer hover:text-app-fg transition"
          >
            {resumenPlano(art.resumen)}
          </p>
        </div>

        {/* Acciones laterales */}
        <div className="flex items-center md:flex-col justify-end gap-2 shrink-0 border-t md:border-t-0 md:border-l border-app-line/60 pt-2 md:pt-0 md:pl-4">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onToggleRead(art.id, isLeido)}
              aria-label={isLeido ? t("tarjeta.desmarcar") : t("tarjeta.marcar")}
              className={`btn-press p-1.5 rounded-lg border transition ${
                isLeido
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-app-raised/80 border-app-line text-app-muted hover:text-app-fg"
              }`}
              title={isLeido ? t("tarjeta.desmarcar") : t("tarjeta.marcar")}
            >
              <MorphIcon icon={isLeido ? CheckCheckData : CheckData} size={14} />
            </button>
            <button
              onClick={() => onToggleSave(art.id, isGuardado)}
              aria-label={isGuardado ? t("tarjeta.guardar_quitar") : t("tarjeta.guardar_nuevo")}
              className={`btn-press p-1.5 rounded-lg border transition ${
                isGuardado
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                  : "bg-app-raised/80 border-app-line text-app-muted hover:text-app-fg"
              }`}
              title={isGuardado ? t("tarjeta.guardar_quitar") : t("tarjeta.guardar_nuevo")}
            >
              <MorphIcon icon={isGuardado ? BookmarkCheckData : BookmarkData} size={14} />
            </button>
            <button
              onClick={() => onDelete(art.id)}
              className="btn-press p-1.5 rounded-lg text-app-muted hover:text-rose-400 hover:bg-app-raised transition"
              title={t("tarjeta.descartar_titulo")}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <button
            onClick={() => onAbrir(art)}
            className="btn-press text-[var(--accent)] hover:underline flex items-center gap-1 text-xs font-semibold"
          >
            <span>{t("tarjeta.leer")}</span>
            <ExternalLink size={11} />
          </button>
        </div>
      </div>
    </div>
  );
});

// 3. MODO COMPACTO (Titulares / Headlines) — 1 sola línea por noticia
const TarjetaCompact = memo(function TarjetaCompact({
  art,
  indice = 0,
  plena = false,
  activo = false,
  onAbrir,
  onToggleRead,
  onToggleSave,
  onDelete,
  t,
  locale,
}) {
  const isLeido = Boolean(art.leido);
  const isGuardado = Boolean(art.guardado);
  const atenuada = isLeido && !plena;
  const nombreFuente = nombreFuenteDeArticulo(art, t("tarjeta.fuente_generica"));
  const fechaFormateada = formatFecha(art.fecha_publicacion, t("tarjeta.reciente"), locale);

  return (
    <div
      id={`noticia-${art.id}`}
      style={{ "--stagger-delay": `${Math.min(indice * 12, 180)}ms` }}
      className={`tarjeta-noticia stagger-in group flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border transition-colors duration-150 ${
        activo
          ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/50 bg-app-surface"
          : "border-app-line/60 bg-app-surface/50 hover:bg-app-surface hover:border-app-line"
      } ${atenuada ? "opacity-50" : "opacity-100"}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span
          style={pillDominioStyle}
          className="text-[10px] font-bold border px-1.5 py-0.5 rounded truncate w-[92px] sm:w-[110px] shrink-0 text-center"
        >
          {nombreFuente}
        </span>

        <h3
          onClick={() => onAbrir(art)}
          className={`text-xs md:text-sm font-medium truncate cursor-pointer transition flex-1 ${
            atenuada ? "text-app-muted line-through" : "text-app-fg hover:text-[var(--accent)]"
          }`}
          title={art.titulo}
        >
          {art.titulo}
        </h3>

        <InsigniaCategoria
          categoria={art.categoria}
          t={t}
          className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] shrink-0"
        />

        {fechaFormateada && (
          <span className="hidden md:inline-block text-[11px] text-app-muted shrink-0 tabular-nums text-right min-w-[118px]">
            {fechaFormateada}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleRead(art.id, isLeido)}
          className={`btn-press p-1 rounded-md border transition ${
            isLeido
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
              : "bg-app-raised/80 border-app-line text-app-muted hover:text-app-fg"
          }`}
          title={isLeido ? t("tarjeta.desmarcar") : t("tarjeta.marcar")}
        >
          <MorphIcon icon={isLeido ? CheckCheckData : CheckData} size={12} />
        </button>
        <button
          onClick={() => onToggleSave(art.id, isGuardado)}
          className={`btn-press p-1 rounded-md border transition ${
            isGuardado
              ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
              : "bg-app-raised/80 border-app-line text-app-muted hover:text-app-fg"
          }`}
          title={isGuardado ? t("tarjeta.guardar_quitar") : t("tarjeta.guardar_nuevo")}
        >
          <MorphIcon icon={isGuardado ? BookmarkCheckData : BookmarkData} size={12} />
        </button>
        <button
          onClick={() => onDelete(art.id)}
          className="btn-press p-1 text-app-muted hover:text-rose-400 rounded transition"
          title={t("tarjeta.descartar_titulo")}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
});

export default function NewsFeed({
  articles,
  tab = "todas",
  modoVista = "cards",
  articuloActivoId = null,
  articuloParaAbrir = null,
  onLectorCerrado = null,
  onToggleRead,
  onToggleSave,
  onUpdateCategory,
  onDelete,
  autoMarcarLeida = false,
}) {
  const [selectedArticle, setSelectedArticle] = useState(null);
  const { t, locale } = useIdioma();
  const rejillaRef = useRef(null);
  const articlesRef = useRef(articles);
  const [listaModal, setListaModal] = useState(null);
  const seleccionRef = useRef(null);
  // Firma de la lista visible: solo se re-anima al cambiar el conjunto
  // (pestaña, página, filtros, búsqueda). Los parches en sitio (p. ej. cada
  // lote IA sobre los mismos ids) no re-disparan la entrada completa: ese
  // era el "freeze" visual durante corridas grandes.
  const idsFirmaRef = useRef("");

  useEffect(() => {
    articlesRef.current = articles;
  });

  useEffect(() => {
    seleccionRef.current = selectedArticle;
  }, [selectedArticle]);

  useEffect(() => {
    if (articuloParaAbrir) {
      setListaModal(articlesRef.current || []);
      setSelectedArticle(articuloParaAbrir);
    }
  }, [articuloParaAbrir]);

  useEffect(() => {
    if (!articles || articles.length === 0) return;
    const firma = articles.map((a) => a.id).join(",");
    if (firma === idsFirmaRef.current) return;
    idsFirmaRef.current = firma;
    const contenedor = rejillaRef.current;
    if (!contenedor) return;
    const marco = requestAnimationFrame(() => {
      animarEntradaTarjetas(contenedor, ".tarjeta-noticia");
    });
    return () => cancelAnimationFrame(marco);
  }, [articles]);

  const lista = listaModal || articles;

  const indiceSeleccionado = selectedArticle
    ? lista.findIndex((art) => art.id === selectedArticle.id)
    : -1;

  const marcarAlAbandonar = useCallback(
    (art) => {
      if (!autoMarcarLeida || !art || art.leido) return;
      const viva = (articlesRef.current || []).find((item) => item.id === art.id);
      if (viva && viva.leido) return;
      onToggleRead(art.id, false);
    },
    [autoMarcarLeida, onToggleRead]
  );

  const irAId = useCallback(
    (id) => {
      const actual = seleccionRef.current;
      const foto = listaModal || articlesRef.current || [];
      const item = foto.find((art) => art.id === id);
      if (item) {
        marcarAlAbandonar(actual);
        setSelectedArticle(item);
        return true;
      }
      return false;
    },
    [listaModal, marcarAlAbandonar]
  );

  const anteriorId = indiceSeleccionado > 0 ? lista[indiceSeleccionado - 1].id : null;
  const siguienteId =
    indiceSeleccionado >= 0 && indiceSeleccionado < lista.length - 1
      ? lista[indiceSeleccionado + 1].id
      : null;

  const cerrarLector = useCallback(() => {
    setListaModal(null);
    setSelectedArticle(null);
    onLectorCerrado?.();
  }, [onLectorCerrado]);

  const abrirArticuloCb = useCallback((art) => {
    setListaModal(articlesRef.current || []);
    setSelectedArticle(art);
  }, []);

  // Seleccionar componente según el modo de vista
  const ComponenteTarjeta =
    modoVista === "compact"
      ? TarjetaCompact
      : modoVista === "magazine"
      ? TarjetaMagazine
      : TarjetaCards;

  const contenedorClases =
    modoVista === "compact"
      ? "space-y-1.5"
      : modoVista === "magazine"
      ? "space-y-3"
      : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";

  return (
    <>
      <div ref={rejillaRef} className={contenedorClases}>
        {articles.map((art, indice) => (
          <ComponenteTarjeta
            key={art.id}
            art={art}
            indice={indice}
            plena={tab === "guardadas"}
            activo={art.id === articuloActivoId}
            onAbrir={abrirArticuloCb}
            onToggleRead={onToggleRead}
            onToggleSave={onToggleSave}
            onDelete={onDelete}
            t={t}
            locale={locale}
          />
        ))}
      </div>

      <ErrorBoundary resetKey={selectedArticle?.id ?? "vacio"} fallback={LectorErrorFallback}>
        <ArticleReaderModal
          key={selectedArticle?.id ?? "vacio"}
          article={selectedArticle}
          onClose={cerrarLector}
          onToggleRead={onToggleRead}
          onToggleSave={onToggleSave}
          onUpdateCategory={onUpdateCategory}
          onIrAId={irAId}
          anteriorId={anteriorId}
          siguienteId={siguienteId}
          posicion={indiceSeleccionado >= 0 ? indiceSeleccionado + 1 : null}
          total={lista.length}
        />
      </ErrorBoundary>
    </>
  );
}