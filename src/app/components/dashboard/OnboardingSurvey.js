// src/app/components/dashboard/OnboardingSurvey.js — Encuesta de bienvenida con selección de categorías y feeds recomendados.
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Sparkles, Check, Plus, Loader2, ArrowRight, Heart, Tag } from "lucide-react";
import { useIdioma } from "@/lib/i18n";
import MorphIcon from "../MorphIcon";

const CATEGORIES = [
  { id: "Tecnología", icon: "💻", color: "bg-sky-500" },
  { id: "Ciencia y Espacio", icon: "🚀", color: "bg-purple-500" },
  { id: "Videojuegos", icon: "🎮", color: "bg-pink-500" },
  { id: "Cine y Series", icon: "🎬", color: "bg-red-500" },
  { id: "Música", icon: "🎵", color: "bg-green-500" },
  { id: "Deportes", icon: "⚽", color: "bg-amber-500" },
  { id: "Economía y Finanzas", icon: "💰", color: "bg-emerald-500" },
  { id: "Salud y Medicina", icon: "🏥", color: "bg-rose-500" },
  { id: "Política", icon: "🏛️", color: "bg-blue-500" },
  { id: "Medio Ambiente", icon: "🌱", color: "bg-lime-500" },
  { id: "Gastronomía", icon: "🍽️", color: "bg-orange-500" },
  { id: "Viajes y Turismo", icon: "✈️", color: "bg-cyan-500" },
  { id: "Motor", icon: "🏎️", color: "bg-red-600" },
  { id: "Educación", icon: "📚", color: "bg-indigo-500" },
  { id: "Cultura y Arte", icon: "🎨", color: "bg-fuchsia-500" },
  { id: "Moda y Belleza", icon: "💄", color: "bg-pink-600" },
  { id: "Fitness y Nutrición", icon: "💪", color: "bg-emerald-600" },
  { id: "Hogar y Vida Diaria", icon: "🏠", color: "bg-amber-600" },
  { id: "Celulares", icon: "📱", color: "bg-sky-600" },
  { id: "Computadoras", icon: "🖥️", color: "bg-violet-500" },
  { id: "Seguridad y Justicia", icon: "⚖️", color: "bg-gray-600" },
  { id: "Clima y Meteorología", icon: "🌤️", color: "bg-blue-400" },
];

function CategoryPill({ category, selected, onClick, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-press flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all min-w-0 ${
        selected
          ? "border-sky-500 bg-sky-500/15 text-sky-300 shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
          : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-500 hover:text-white"
      }`}
      aria-pressed={selected}
    >
      <span className="text-lg">{category.icon}</span>
      <span className="truncate text-sm font-medium">{category.id}</span>
      {selected && <Check size={14} strokeWidth={3} className="shrink-0 text-sky-400" />}
    </button>
  );
}

function FeedCard({ feed, onAdd, adding, added, t }) {
  return (
    <div className="card-lift bg-gray-950/60 border border-gray-800/80 rounded-2xl p-4 hover:border-gray-600 transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Tag size={12} className="opacity-75" />
            <span>{feed.categoria}</span>
          </div>
          <h4 className="text-white font-semibold text-base truncate mb-1">{feed.titulo}</h4>
          <p className="text-gray-500 text-sm line-clamp-2">{feed.descripcion}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={adding || added}
          className={`btn-press shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            added
              ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/40 cursor-default"
              : adding
              ? "bg-sky-600/20 text-sky-400 border-sky-500/30 cursor-wait"
              : "bg-sky-600 hover:bg-sky-500 text-white border-sky-500/30 hover:shadow-lg hover:shadow-sky-600/20"
          }`}
          aria-label={added ? t("onboarding.agregada") : adding ? t("onboarding.agregando") : t("onboarding.agregar")}
        >
          {adding && <Loader2 size={14} className="animate-spin" />}
          {added ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
          <span className="hidden sm:inline">{added ? t("onboarding.agregada") : adding ? t("onboarding.agregando") : t("onboarding.agregar")}</span>
        </button>
      </div>
    </div>
  );
}

export default function OnboardingSurvey({ abierto, onCerrar, t, onCompletado, onAgregarFuente }) {
  const [paso, setPaso] = useState(1); // 1: categorías, 2: feeds, 3: completado
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [feedsRecomendados, setFeedsRecomendados] = useState({});
  const [cargandoFeeds, setCargandoFeeds] = useState(false);
  const [feedsAgregando, setFeedsAgregando] = useState(new Set());
  const [feedsAgregados, setFeedsAgregados] = useState(new Set());
  const [totalAgregados, setTotalAgregados] = useState(0);
  const cargandoRef = useRef(false);

// Cargar feeds recomendados cuando cambien las categorías seleccionadas
  useEffect(() => {
    let cancelado = false;
    const fetchFeeds = async () => {
      if (categoriasSeleccionadas.length === 0) {
        if (!cancelado) setFeedsRecomendados({});
        return;
      }
      if (!cancelado) setCargandoFeeds(true);
      try {
        const params = new URLSearchParams({ categorias: categoriasSeleccionadas.join(",") });
        const res = await fetch(`/api/recommended-feeds?${params}`, { cache: "no-store" });
        if (!cancelado && res.ok) {
          const data = await res.json();
          if (!cancelado) setFeedsRecomendados(data.categorias || {});
        }
      } catch (err) {
        if (!cancelado) {
          console.error("Error cargando feeds recomendados:", err);
          setFeedsRecomendados({});
        }
      } finally {
        if (!cancelado) setCargandoFeeds(false);
      }
    };
    
    fetchFeeds();
    return () => { cancelado = true; };
  }, [categoriasSeleccionadas]);

  const alternarCategoria = (categoria) => {
    setCategoriasSeleccionadas((actuales) =>
      actuales.includes(categoria)
        ? actuales.filter((c) => c !== categoria)
        : [...actuales, categoria]
    );
  };

  const handleAgregarFeed = async (feed) => {
    const feedKey = `${feed.titulo}|${feed.url}`;
    if (feedsAgregando.has(feedKey) || feedsAgregados.has(feedKey)) return;

    setFeedsAgregando((prev) => new Set(prev).add(feedKey));
    try {
      if (onAgregarFuente) {
        await onAgregarFuente(feed.titulo, feed.url, feed.categoria);
      }
      setFeedsAgregados((prev) => new Set(prev).add(feedKey));
      setTotalAgregados((prev) => prev + 1);
    } catch (err) {
      console.error("Error agregando feed:", err);
    } finally {
      setFeedsAgregando((prev) => {
        const next = new Set(prev);
        next.delete(feedKey);
        return next;
      });
    }
  };

  const handleAgregarTodas = async () => {
    if (!feedsRecomendados) return;
    const todas = Object.values(feedsRecomendados || {}).flat();
    if (!Array.isArray(todas)) return;
    for (const feed of todas) {
      const feedKey = `${feed.titulo}|${feed.url}`;
      if (!feedsAgregados.has(feedKey) && !feedsAgregando.has(feedKey)) {
        await handleAgregarFeed(feed);
        await new Promise((r) => setTimeout(r, 150)); // Pequeña pausa entre requests
      }
    }
  };

  const siguientePaso = () => {
    if (paso === 1) {
      if (categoriasSeleccionadas.length === 0) return;
      setPaso(2);
    } else if (paso === 2) {
      setPaso(3);
    }
  };

  const handleCompletar = () => {
    if (onCompletado) onCompletado();
    onCerrar();
  };

  const handleOmitir = () => {
    onCerrar();
  };

  const totalFeeds = feedsRecomendados 
    ? Object.values(feedsRecomendados || {}).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0) 
    : 0;

  if (!abierto) return null;

  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="anim-modal scroll-oculto bg-app-surface border border-app-line rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto overscroll-contain">
        <button
          onClick={handleOmitir}
          aria-label={t("comun.cerrar")}
          className="btn-press absolute top-4 right-4 text-app-muted hover:text-app-fg p-1.5 rounded-lg bg-app-raised/50 hover:bg-app-raised"
        >
          <X size={20} />
        </button>

        {/* Indicador de pasos */}
        <div className="flex items-center justify-between mb-2">
          {[
            { n: 1, label: t("onboarding.paso_categorias") },
            { n: 2, label: t("onboarding.paso_feeds") },
            { n: 3, label: t("onboarding.paso_listo") },
          ].map((p) => (
            <div key={p.n} className="flex flex-col items-center gap-1.5 flex-1">
              <div className="flex items-center justify-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    paso >= p.n
                      ? "bg-[var(--accent-strong)] text-[var(--on-accent-strong)]"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {paso > p.n ? <Check size={16} strokeWidth={3} /> : p.n}
                </div>
              </div>
              <span className={`text-xs font-medium text-center max-w-[100px] ${paso >= p.n ? "text-app-fg" : "text-app-muted"}`}>
                {p.label}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent-ink)] rounded-full text-xs font-semibold border border-[var(--accent)]/20">
            <Sparkles size={14} /> {t("onboarding.etiqueta")}
          </div>
          <h3 className="text-2xl font-bold text-app-fg tracking-tight">{t("onboarding.titulo")}</h3>
          <p className="text-sm text-app-muted leading-relaxed">{t("onboarding.subtitulo")}</p>
        </div>

        {/* Paso 1: Selección de categorías */}
        {paso === 1 && (
          <div className="space-y-4">
            <div className="bg-app-bg/60 p-4 rounded-xl border border-app-line">
              <h4 className="text-sm font-semibold text-app-fg mb-1">{t("onboarding.categorias_titulo")}</h4>
              <p className="text-xs text-app-muted mb-4">{t("onboarding.categorias_subtitulo")}</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <CategoryPill
                    key={cat.id}
                    category={cat}
                    selected={categoriasSeleccionadas.includes(cat.id)}
                    onClick={() => alternarCategoria(cat.id)}
                    t={t}
                  />
                ))}
              </div>
              {categoriasSeleccionadas.length > 0 && (
                <p className="text-xs text-sky-400 mt-3 flex items-center gap-1">
                  <Heart size={12} className="text-sky-500" />
                  {categoriasSeleccionadas.length} {categoriasSeleccionadas.length === 1 ? t("onboarding.categoria") : t("onboarding.categorias")} {t("onboarding.seleccionadas")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Paso 2: Feeds recomendados */}
        {paso === 2 && (
          <div className="space-y-4">
            <div className="bg-app-bg/60 p-4 rounded-xl border border-app-line">
              <h4 className="text-sm font-semibold text-app-fg mb-1">{t("onboarding.feeds_titulo")}</h4>
              <p className="text-xs text-app-muted mb-4">{t("onboarding.feeds_subtitulo")}</p>

              {cargandoFeeds ? (
                <div className="flex justify-center items-center py-8 text-app-muted gap-2">
                  <Loader2 size={20} className="animate-spin text-sky-500" />
                  <span>{t("fuentes.cargando")}</span>
                </div>
              ) : totalFeeds === 0 ? (
                <p className="text-center text-app-muted py-8">{t("onboarding.sin_feeds")}</p>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {Object.entries(feedsRecomendados).map(([categoria, feeds]) => (
                    <div key={categoria} className="space-y-2">
                      <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center">
                          <Tag size={10} className="text-sky-400" />
                        </span>
                        {categoria} ({feeds.length})
                      </h5>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {Array.isArray(feeds) && feeds.map((feed) => (
                           <FeedCard
                             key={`${categoria}-${feed.titulo}`}
                             feed={{ ...feed, categoria }}
                             onAdd={() => handleAgregarFeed(feed)}
                             adding={feedsAgregando.has(`${feed.titulo}|${feed.url}`)}
                             added={feedsAgregados.has(`${feed.titulo}|${feed.url}`)}
                             t={t}
                           />
                         ))}
                       </div>
                    </div>
                  ))}
                </div>
              )}

              {totalFeeds > 0 && totalAgregados < totalFeeds && (
                <button
                  type="button"
                  onClick={handleAgregarTodas}
                  disabled={totalAgregados === totalFeeds}
                  className="btn-press w-full mt-4 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus size={16} /> {t("onboarding.agregar_todas", { n: totalFeeds - totalAgregados })}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Paso 3: Completado */}
        {paso === 3 && (
          <div className="space-y-4 text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-4">
              <Check size={32} className="text-emerald-400" strokeWidth={2.5} />
            </div>
            <h4 className="text-xl font-bold text-app-fg">{t("onboarding.completado_titulo")}</h4>
            <p className="text-app-muted">{t("onboarding.completado_texto")}</p>
            {totalAgregados > 0 && (
              <p className="text-sm text-sky-400 flex items-center justify-center gap-1.5">
                <Heart size={14} className="text-sky-500" />
                {t("onboarding.feeds_agregadas", { n: totalAgregados })}
              </p>
            )}
          </div>
        )}

        {/* Botones de navegación */}
        <div className="flex justify-end gap-3 pt-4 border-t border-app-line">
          {paso === 1 && (
            <>
              <button
                type="button"
                onClick={handleOmitir}
                className="btn-press bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
              >
                {t("onboarding.omitir")}
              </button>
              <button
                type="button"
                onClick={siguientePaso}
                disabled={categoriasSeleccionadas.length === 0}
                className="btn-press group bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("onboarding.continuar")}
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {paso === 2 && (
            <>
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="btn-press bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl"
              >
                <MorphIcon icon={ArrowRight} size={16} className="rotate-180" /> {t("onboarding.continuar")}
              </button>
              <button
                type="button"
                onClick={siguientePaso}
                className="btn-press group bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm"
              >
                {t("onboarding.continuar")}
                <ArrowRight size={16} />
              </button>
            </>
          )}
          {paso === 3 && (
            <button
              type="button"
              onClick={handleCompletar}
              className="btn-press group w-full bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              {t("onboarding.ver_dashboard")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}