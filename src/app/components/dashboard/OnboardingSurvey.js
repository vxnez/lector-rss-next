// src/app/components/dashboard/OnboardingSurvey.js — Encuesta de bienvenida con selección de categorías y feeds recomendados.
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Sparkles, Check, Plus, Loader2, Heart, Tag } from "lucide-react";
import { useIdioma } from "@/lib/i18n";
import { animarAperturaModal, animarCierreModal } from "@/lib/animaciones";
import RecommendedFeedsList from "./RecommendedFeedsList";

// Fallback de iconos/colores por si la API no los proporciona
const CATEGORY_META = {
  "Tecnología": { icon: "💻", color: "bg-sky-500" },
  "Developers": { icon: "🧑‍💻", color: "bg-teal-500" },
  "Ciencia y Espacio": { icon: "🚀", color: "bg-purple-500" },
  "Videojuegos": { icon: "🎮", color: "bg-pink-500" },
  "Cine y Series": { icon: "🎬", color: "bg-red-500" },
  "Música": { icon: "🎵", color: "bg-green-500" },
  "Deportes": { icon: "⚽", color: "bg-amber-500" },
  "Economía y Finanzas": { icon: "💰", color: "bg-emerald-500" },
  "Salud y Medicina": { icon: "🏥", color: "bg-rose-500" },
  "Política": { icon: "🏛️", color: "bg-blue-500" },
  "Medio Ambiente": { icon: "🌱", color: "bg-lime-500" },
  "Gastronomía": { icon: "🍽️", color: "bg-orange-500" },
  "Viajes y Turismo": { icon: "✈️", color: "bg-cyan-500" },
  "Motor": { icon: "🏎️", color: "bg-red-600" },
  "Educación": { icon: "📚", color: "bg-indigo-500" },
  "Cultura y Arte": { icon: "🎨", color: "bg-fuchsia-500" },
  "Moda y Belleza": { icon: "💄", color: "bg-pink-600" },
  "Fitness y Nutrición": { icon: "💪", color: "bg-emerald-600" },
  "Hogar y Vida Diaria": { icon: "🏠", color: "bg-amber-600" },
  "Celulares": { icon: "📱", color: "bg-sky-600" },
  "Computadoras": { icon: "🖥️", color: "bg-violet-500" },
  "Seguridad y Justicia": { icon: "⚖️", color: "bg-gray-600" },
  "Clima y Meteorología": { icon: "🌤️", color: "bg-blue-400" },
};

function CategoryPill({ category, selected, onClick, t }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn-press flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-[transform,border-color,background-color,box-shadow,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        selected
          ? "border-[var(--accent)]/80 bg-[var(--accent)]/15 text-[var(--accent-ink)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
          : "border-app-line bg-app-surface/60 text-app-muted hover:border-[var(--accent)]/60 hover:bg-app-raised/70 hover:text-app-fg"
        }`}
      aria-pressed={selected}
    >
      <span className="text-lg">{category.icon}</span>
      <span className="truncate text-sm font-medium">{category.id}</span>
      {selected && <Check size={14} strokeWidth={3} className="shrink-0 text-sky-400" />}
    </button>
  );
}


// Eliminado FeedCard ya que está en RecommendedFeedsList


export default function OnboardingSurvey({ abierto, onCerrar, t, onCompletado, onAgregarFuente }) {
  const { idioma, setIdioma } = useIdioma();
  const [paso, setPaso] = useState(1); // 1: categorías, 2: feeds, 3: completado
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [feedsRecomendados, setFeedsRecomendados] = useState({});
  const [cargandoFeeds, setCargandoFeeds] = useState(false);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [feedsAgregando, setFeedsAgregando] = useState(new Set());
  const [feedsAgregados, setFeedsAgregados] = useState(new Set());
  const [totalAgregados, setTotalAgregados] = useState(0);
  const [agregandoTodas, setAgregandoTodas] = useState(false);
  const [completando, setCompletando] = useState(false);
  const cargandoRef = useRef(false);
  const overlayRef = useRef(null);
  const modalRef = useRef(null);
  const cerrandoRef = useRef(false);
  // Nota: el reinicio al Punto 1 en cada apertura manual lo garantiza el
  // padre con `key` (remontaje): el estado inicial ya es paso 1 vacío.

  // Cargar categorías disponibles (solo las que tienen feeds verificados)
  useEffect(() => {
    let cancelado = false;
    const cargarCategorias = async () => {
      try {
        const res = await fetch(`/api/recommended-feeds`, { cache: "no-store" });
        if (!cancelado && res.ok) {
          const data = await res.json();
          // Solo categorías que tienen al menos 1 feed
          const catsConFeeds = Object.entries(data.categorias || {})
            .filter(([, feeds]) => Array.isArray(feeds) && feeds.length > 0)
            .map(([nombre, feeds]) => ({
              id: nombre,
              icon: CATEGORY_META[nombre]?.icon || "📰",
              color: CATEGORY_META[nombre]?.color || "bg-gray-500",
              count: feeds.length,
            }))
            .sort((a, b) => b.count - a.count); // Ordenar por más feeds primero
          setCategoriasDisponibles(catsConFeeds);
        }
      } catch (err) {
        if (!cancelado) {
          console.error("Error cargando categorías:", err);
          setCategoriasDisponibles([]);
        }
      } finally {
        if (!cancelado) setCargandoCategorias(false);
      }
    };
    cargarCategorias();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    let cancelado = false;
    if (categoriasSeleccionadas.length === 0) {
      return () => { cancelado = true; };
    }

    const cargarFeeds = async () => {
      try {
        const params = new URLSearchParams({ categorias: categoriasSeleccionadas.join(",") });
        const res = await fetch(`/api/recommended-feeds?${params}`, { cache: "no-store" });
        if (!cancelado && res.ok) {
          const data = await res.json();
          setFeedsRecomendados(data.categorias || {});
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

    cargarFeeds();
    return () => { cancelado = true; };
  }, [categoriasSeleccionadas]);

  const alternarCategoria = (categoria) => {
    const siguientes = categoriasSeleccionadas.includes(categoria)
      ? categoriasSeleccionadas.filter((actual) => actual !== categoria)
      : [...categoriasSeleccionadas, categoria];
    setCategoriasSeleccionadas(siguientes);
    setCargandoFeeds(siguientes.length > 0);
    if (siguientes.length === 0) setFeedsRecomendados({});
  };

  const handleAgregarFeed = async (feed) => {
    const feedKey = `${feed.titulo}|${feed.url}`;
    if (feedsAgregando.has(feedKey) || feedsAgregados.has(feedKey)) return;

    setFeedsAgregando((prev) => new Set(prev).add(feedKey));
    try {
      if (onAgregarFuente) {
        // Las entradas del JSON pueden traer categoria propia y el flag de
        // conversión de página completa (secciones sin feed nativo): se
        // pasan al pipeline de /api/rss para que cada alta use el motor
        // correspondiente (nativo o crawler multipágina).
        await onAgregarFuente(feed.titulo, feed.url, feed.categoria, {
          forzar_conversion: feed.forzar_conversion === true,
        });
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
    if (agregandoTodas) return;
    if (!feedsRecomendados || typeof feedsRecomendados !== 'object') return;

    const categorias = Object.keys(feedsRecomendados);
    const todas = [];

    for (const cat of categorias) {
      const lista = feedsRecomendados[cat];
      if (Array.isArray(lista)) {
        for (const feed of lista) {
          todas.push(feed);
        }
      }
    }

    setAgregandoTodas(true);
    try {
      for (const feed of todas) {
        const feedKey = `${feed.titulo}|${feed.url}`;
        if (!feedsAgregados.has(feedKey) && !feedsAgregando.has(feedKey)) {
          await handleAgregarFeed(feed);
          await new Promise((r) => setTimeout(r, 150));
        }
      }
    } finally {
      setAgregandoTodas(false);
    }
  };

  const siguientePaso = async () => {
    if (paso === 1) {
      if (categoriasSeleccionadas.length === 0) return;
      
      setPaso(2);
    } else if (paso === 2) {
      setPaso(3);
    }
  };

  const cerrarConAnimacion = useCallback((resultado) => {
    if (cerrandoRef.current) return;
    cerrandoRef.current = true;
    animarCierreModal(overlayRef.current, modalRef.current).then(() => {
      cerrandoRef.current = false;
      onCerrar(resultado);
    });
  }, [onCerrar]);

  const handleCompletar = async () => {
    setCompletando(true);
    try {
      if (onCompletado) await onCompletado();
      cerrarConAnimacion(true);
    } finally {
      setCompletando(false);
    }
  };

  const handleOmitir = () => {
    cerrarConAnimacion(false);
  };

  // Apertura suavizada del modal de onboarding (escala + opacidad, GPU).
  useEffect(() => {
    if (!abierto) return;
    cerrandoRef.current = false;
    const marco = requestAnimationFrame(() => {
      animarAperturaModal(overlayRef.current, modalRef.current);
    });
    return () => cancelAnimationFrame(marco);
  }, [abierto]);

  const totalFeeds = (feedsRecomendados && typeof feedsRecomendados === 'object')
    ? Object.values(feedsRecomendados).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0) 
    : 0;

  if (!abierto) return null;



  return (
    <div ref={overlayRef} className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="anim-modal scroll-oculto relative flex max-h-[90vh] w-full max-w-3xl flex-col gap-6 overflow-hidden rounded-2xl border border-app-line bg-app-surface p-6 shadow-2xl sm:p-8"
      >
        <button
          onClick={handleOmitir}
          aria-label={t("comun.cerrar")}
          className="btn-press absolute top-4 right-4 text-app-muted hover:text-app-fg p-1.5 rounded-lg bg-app-raised/50 hover:bg-app-raised"
        >
          <X size={20} />
        </button>

        {/* Contenido desplazable: solo esta zona hace scroll; el pie con
            Omitir/Continuar queda siempre visible sin buscarlo. */}
        <div className="scroll-oculto min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pr-1">
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
          <h3 id="onboarding-title" className="text-2xl font-bold tracking-tight text-app-fg">{t("onboarding.titulo")}</h3>
          <p className="text-sm text-app-muted leading-relaxed">{t("onboarding.subtitulo")}</p>
        </div>

        {/* Paso 1: Selección de categorías */}
        {paso === 1 && (
          <div className="space-y-4">
            <div className="bg-app-bg/60 p-4 rounded-xl border border-app-line">
              <h4 className="text-sm font-semibold text-app-fg mb-1">{t("onboarding.idioma_titulo")}</h4>
              <div className="flex gap-1.5" role="radiogroup" aria-label={t("onboarding.idioma_titulo")}>
                {[
                  { id: "es", etiqueta: "Español" },
                  { id: "en", etiqueta: "English" },
                ].map((op) => {
                  const activo = idioma === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => setIdioma(op.id)}
                      className={`min-w-0 flex-1 truncate rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                        activo
                          ? "border-[var(--accent)]/60 bg-transparent text-app-fg"
                          : "border-transparent bg-transparent text-app-muted hover:bg-app-raised/40 hover:text-app-fg"
                      }`}
                    >
                      {op.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="bg-app-bg/60 p-4 rounded-xl border border-app-line">
              <h4 className="text-sm font-semibold text-app-fg mb-1">{t("onboarding.categorias_titulo")}</h4>
              <p className="text-xs text-app-muted mb-4">{t("onboarding.categorias_subtitulo")}</p>
              {cargandoCategorias ? (
                <div className="flex justify-center items-center py-8 text-app-muted gap-2">
                  <Loader2 size={20} className="animate-spin text-sky-500" />
                  <span>{t("fuentes.cargando")}</span>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {categoriasDisponibles.map((cat) => (
                      <CategoryPill
                        key={cat.id}
                        category={cat}
                        selected={categoriasSeleccionadas.includes(cat.id)}
                        onClick={() => alternarCategoria(cat.id)}
                        t={t}
                      />
                    ))}
                  </div>
                  {categoriasDisponibles.length === 0 && (
                    <p className="text-center text-app-muted py-8">{t("onboarding.sin_categorias")}</p>
                  )}
                </>
              )}
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
               <RecommendedFeedsList
                 cargando={cargandoFeeds}
                 feeds={feedsRecomendados}
                 total={totalFeeds}
                 totalAgregados={totalAgregados}
                 onAdd={handleAgregarFeed}
                 onAddAll={handleAgregarTodas}
                  agregandoTodas={agregandoTodas}
                 feedsAgregando={feedsAgregando}
                 feedsAgregados={feedsAgregados}
                 t={t}
               />
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
        </div>

        {/* Botones de navegación */}
        <div className="flex justify-end gap-3 pt-4 border-t border-app-line">
          {paso === 1 && (
            <>
              <button
                type="button"
                onClick={handleOmitir}
                className="btn-press rounded-xl border border-app-line bg-app-raised px-4 py-2.5 text-sm font-medium text-app-fg hover:border-[var(--accent)]/60 hover:bg-app-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {t("onboarding.omitir")}
              </button>
              <button
                type="button"
                onClick={siguientePaso}
                disabled={categoriasSeleccionadas.length === 0}
                className="btn-press group flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("onboarding.continuar")}
              </button>
            </>
          )}
          {paso === 2 && (
            <>
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="btn-press rounded-xl border border-app-line bg-app-raised px-4 py-2.5 text-sm font-medium text-app-fg hover:border-[var(--accent)]/60 hover:bg-app-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {t("onboarding.anterior")}
              </button>
              <button
                type="button"
                onClick={siguientePaso}
                className="btn-press group flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {t("onboarding.continuar")}
              </button>
            </>
          )}
          {paso === 3 && (
            <button
              type="button"
              onClick={handleCompletar}
              disabled={completando}
              className="btn-press group flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:cursor-wait disabled:opacity-60"
            >
              {completando ? t("comun.cargando") : t("onboarding.ver_dashboard")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}