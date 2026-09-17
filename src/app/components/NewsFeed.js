// src/app/components/NewsFeed.js
"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Trash2, ExternalLink, Tag, Globe, Calendar, Clock } from "lucide-react";
import { Check as CheckData, CheckCheck as CheckCheckData } from "lucide";
import { Bookmark as BookmarkData, BookmarkCheck as BookmarkCheckData } from "lucide";
import MorphIcon from "./MorphIcon";
import { animarEntradaTarjetas } from "@/lib/animaciones";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { tiempoLecturaMinutos } from "@/lib/lectura";
import { formatFecha, nombreFuenteDeArticulo } from "@/lib/formato";
import { useIdioma } from "@/lib/i18n";
import ErrorBoundary, { LectorErrorFallback } from "./ErrorBoundary";

// El lector solo se necesita cuando se abre una noticia: fuera del bundle inicial.
const ArticleReaderModal = dynamic(() => import("./ArticleReaderModal"), { ssr: false });

// Píldora de fuente teñida con el acento del tema activo: se adapta sola a
// los 8 temas (claros incluidos). El color por categoría lo sigue dando
// getCategoryStyle, así se conserva la codificación visual.
const pillDominioStyle = {
  backgroundColor: "color-mix(in srgb, var(--accent) 16%, transparent)",
  color: "var(--accent-ink)",
  borderColor: "color-mix(in srgb, var(--accent) 45%, transparent)",
};

// Fuente única de verdad: lib/categoryStyles. (Se eliminó el switch duplicado muerto.)
const getCategoryColor = (categoria) => getCategoryStyle(categoria);

// Tarjeta memorizada: evita re-render de toda la grilla al marcar una sola.
// `plena` (pestaña Guardadas): la tarjeta se muestra sin tachar ni atenuar;
// el estado lo comunican solo las palomitas de leído/guardado.
const TarjetaNoticia = memo(function TarjetaNoticia({ art, indice = 0, plena = false, onAbrir, onToggleRead, onToggleSave, onDelete, t, locale }) {
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
      style={{ "--stagger-delay": `${Math.min(indice * 40, 320)}ms` }}
      onMouseMove={fijarSpot}
      className={`tarjeta-noticia stagger-in card-lift spotlight-card group bezel-outer p-[3px] focus-within:border-[var(--accent)]/60 ${
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
        {/* Chrome de la tarjeta (píldoras y descartar): no traducible para no
            romper la reconciliación al filtrar/recargar. Título y resumen sí. */}
        <div className="flex items-center justify-between gap-2 mb-2 notranslate" translate="no">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span
              style={pillDominioStyle}
              className={`text-[11px] font-bold border px-2 py-0.5 rounded flex items-center gap-1.5 tracking-wide transition-opacity ${
                atenuada ? "opacity-60" : "opacity-100"
              }`}
            >
              <Globe size={11} className="shrink-0" />
              <span className="truncate">{nombreFuente}</span>
            </span>
            {fechaFormateada && (
              <span className="flex items-center gap-1 bg-app-raised/60 border border-app-line/60 text-app-muted px-2 py-0.5 rounded text-[11px]">
                <Calendar size={11} className="opacity-75" />
                <span>{fechaFormateada}</span>
              </span>
            )}
            <span className="flex items-center gap-1 bg-app-raised/60 border border-app-line/60 text-app-muted px-2 py-0.5 rounded text-[11px]" title={t("tarjeta.min_titulo", { n: minutosLectura })}>
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
          {art.resumen}
        </p>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-app-line/80 gap-1 text-xs notranslate" translate="no">
          <button
            onClick={() => onAbrir(art)}
            className="btn-press text-[var(--accent)] hover:underline flex items-center gap-1.5 font-medium text-xs rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
          >
          <span>{t("tarjeta.leer")}</span>
          <ExternalLink size={12} />
        </button>
        <div className="flex items-center gap-1.5">
          {art.categoria && (
            <span style={getCategoryColor(art.categoria)} className="border px-2 py-1 rounded text-[11px] flex items-center gap-1 font-medium">
              <Tag size={10} className="opacity-75" />
              <span>{art.categoria}</span>
            </span>
          )}
          <button
            onClick={() => onToggleRead(art.id, isLeido)}
            aria-label={isLeido ? t("tarjeta.desmarcar") : t("tarjeta.marcar")}
            aria-pressed={isLeido}
            className={`btn-press p-1.5 rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
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
            className={`btn-press p-1.5 rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
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

export default function NewsFeed({ articles, tab = "todas", onToggleRead, onToggleSave, onUpdateCategory, onDelete, autoMarcarLeida = false }) {
  const [selectedArticle, setSelectedArticle] = useState(null);
  const { t, locale } = useIdioma();
  const rejillaRef = useRef(null);

  const articlesRef = useRef(articles);
  // Foto de la lista al abrir el lector: la navegación (anterior/siguiente,
  // posición y total) se calcula sobre ella para no romperse si el feed vivo
  // cambia (p. ej. una noticia sale de "pendientes" al marcarse como leída).
  // Es estado (no ref) porque se lee durante el render.
  const [listaModal, setListaModal] = useState(null);
  // Última noticia visible en el lector (evita cierres obsoletos en callbacks).
  const seleccionRef = useRef(null);

  useEffect(() => {
    articlesRef.current = articles;
  });

  useEffect(() => {
    seleccionRef.current = selectedArticle;
  }, [selectedArticle]);

  // Aparición progresiva de tarjetas (Anime.js, solo transform/opacity):
  // fade-in + desplazamiento vertical sutil al cargar o actualizar el feed.
  // El CSS `stagger-in` queda como mejora progresiva si Anime.js no corre.
  useEffect(() => {
    if (!articles || articles.length === 0) return;
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

  // Marca como leída la noticia que se abandona, solo si sigue sin leer en
  // la lista viva (evita doble PUT tras un marcado manual previo).
  const marcarAlAbandonar = useCallback((art) => {
    if (!autoMarcarLeida || !art || art.leido) return;
    const viva = (articlesRef.current || []).find((item) => item.id === art.id);
    if (viva && viva.leido) return;
    onToggleRead(art.id, false);
  }, [autoMarcarLeida, onToggleRead]);

  const irAId = useCallback((id) => {
    const actual = seleccionRef.current;
    const foto = listaModal || articlesRef.current || [];
    const item = foto.find((art) => art.id === id);
    if (item) {
      // Al pasar a otra noticia se marca como leída la que se deja atrás.
      // Abrir una noticia nunca marca por sí solo.
      marcarAlAbandonar(actual);
      setSelectedArticle(item);
      return true;
    }
    return false;
  }, [listaModal, marcarAlAbandonar]);

  const anteriorId = indiceSeleccionado > 0 ? lista[indiceSeleccionado - 1].id : null;
  const siguienteId =
    indiceSeleccionado >= 0 && indiceSeleccionado < lista.length - 1
      ? lista[indiceSeleccionado + 1].id
      : null;

  const cerrarLector = useCallback(() => {
    setListaModal(null);
    setSelectedArticle(null);
  }, []);

  const abrirArticuloCb = useCallback(
    (art) => {
      // Abrir no marca como leída: el auto-marcado ocurre al pasar a la
      // siguiente (o anterior) noticia dentro del lector.
      setListaModal(articlesRef.current || []);
      setSelectedArticle(art);
    },
    []
  );

  return (
    <>
      <div ref={rejillaRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((art, indice) => (
          <TarjetaNoticia
            key={art.id}
            art={art}
            indice={indice}
            plena={tab === "guardadas"}
            onAbrir={abrirArticuloCb}
            onToggleRead={onToggleRead}
            onToggleSave={onToggleSave}
            onDelete={onDelete}
            t={t}
            locale={locale}
          />
        ))}
      </div>

      {/* El boundary contiene un crash del lector (p. ej. DOM tocado por el
          traductor del navegador) sin tumbar el dashboard; se resetea solo
          al cambiar de noticia. */}
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