// src/app/components/NewsFeed.js
"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Check, Bookmark, Trash2, ExternalLink, Tag, Globe, Calendar, Clock } from "lucide-react";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { tiempoLecturaMinutos } from "@/lib/lectura";
import { formatFecha, nombreFuenteDeArticulo } from "@/lib/formato";
import { useIdioma } from "@/lib/i18n";

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
const TarjetaNoticia = memo(function TarjetaNoticia({ art, indice = 0, onAbrir, onToggleRead, onToggleSave, onDelete, t, locale }) {
  const isLeido = Boolean(art.leido);
  const isGuardado = Boolean(art.guardado);
  const nombreFuente = nombreFuenteDeArticulo(art, t("tarjeta.fuente_generica"));
  const fechaFormateada = formatFecha(art.fecha_publicacion, t("tarjeta.reciente"), locale);
  const minutosLectura = tiempoLecturaMinutos(art.titulo, art.resumen);
  return (
    <div
      style={{ "--stagger-delay": `${Math.min(indice * 40, 320)}ms` }}
      className={`tarjeta-noticia stagger-in card-lift group p-5 rounded-2xl flex flex-col justify-between focus-within:border-[var(--accent)]/60 ${
        isLeido
          ? "bg-app-surface/70 border border-app-line/40 opacity-40 grayscale-[25%]"
          : "bg-app-surface border border-app-line hover:border-[var(--accent)]/50 hover:shadow-[0_16px_40px_-20px_color-mix(in_srgb,var(--accent)_45%,transparent)] opacity-100"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span
              style={pillDominioStyle}
              className={`text-[11px] font-bold border px-2 py-0.5 rounded flex items-center gap-1.5 tracking-wide transition-opacity ${
                isLeido ? "opacity-60" : "opacity-100"
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
          className={`text-base font-bold leading-snug mb-2 cursor-pointer transition line-clamp-2 ${
            isLeido ? "text-app-muted line-through decoration-app-muted" : "text-app-fg hover:text-[var(--accent)]"
          }`}
        >
          {art.titulo}
        </h3>
        <p
          onClick={() => onAbrir(art)}
          className={`resumen-noticia text-xs line-clamp-3 mb-4 cursor-pointer transition ${
            isLeido ? "text-app-muted" : "text-app-muted hover:text-app-fg"
          }`}
        >
          {art.resumen}
        </p>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-app-line/80 gap-1 text-xs">
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
                ? "bg-emerald-950/80 border-emerald-700 text-emerald-400"
                : "bg-app-raised/80 border-app-line text-app-muted hover:text-app-fg"
            }`}
            title={isLeido ? t("tarjeta.desmarcar") : t("tarjeta.marcar")}
          >
            <Check size={13} aria-hidden="true" />
          </button>
          <button
            onClick={() => onToggleSave(art.id, isGuardado)}
            aria-label={isGuardado ? t("tarjeta.guardar_quitar") : t("tarjeta.guardar_nuevo")}
            aria-pressed={isGuardado}
            className={`btn-press p-1.5 rounded-lg border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              isGuardado
                ? "bg-amber-950/80 border-amber-700 text-amber-400"
                : "bg-app-raised/80 border-app-line text-app-muted hover:text-app-fg"
            }`}
            title={isGuardado ? t("tarjeta.guardar_quitar") : t("tarjeta.guardar_nuevo")}
          >
            <Bookmark size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default function NewsFeed({ articles, onToggleRead, onToggleSave, onUpdateCategory, onDelete, autoMarcarLeida = false }) {
  const [selectedArticle, setSelectedArticle] = useState(null);
  const { t, locale } = useIdioma();

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

  const abrirArticuloCb = useCallback(
    (art) => {
      setSelectedArticle(art);
      if (autoMarcarLeida && art && !art.leido) {
        onToggleRead(art.id, false);
      }
    },
    [autoMarcarLeida, onToggleRead]
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((art, indice) => (
          <TarjetaNoticia
            key={art.id}
            art={art}
            indice={indice}
            onAbrir={abrirArticuloCb}
            onToggleRead={onToggleRead}
            onToggleSave={onToggleSave}
            onDelete={onDelete}
            t={t}
            locale={locale}
          />
        ))}
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