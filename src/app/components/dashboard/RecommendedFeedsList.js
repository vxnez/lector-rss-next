// src/app/components/dashboard/RecommendedFeedsList.js
"use client";

import React from "react";
import { Loader2, Tag, Plus } from "lucide-react";

// Nota: FeedCard se implementa localmente aquí para evitar dependencias circulares o archivos inexistentes
function LocalFeedCard({ feed, onAdd, adding, added, t }) {
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
        >
          {adding && <Loader2 size={14} className="animate-spin" />}
          {added ? "✓" : <Plus size={14} />}
          <span className="hidden sm:inline">{added ? "Agregada" : adding ? "Agregando..." : "Agregar"}</span>
        </button>
      </div>
    </div>
  );
}

export default function RecommendedFeedsList({ 
  cargando, 
  feeds, 
  total, 
  totalAgregados, 
  onAdd, 
  onAddAll, 
  feedsAgregando, 
  feedsAgregados, 
  t 
}) {
  try {
    if (cargando) {
      return (
        <div className="flex justify-center items-center py-8 text-app-muted gap-2">
          <Loader2 size={20} className="animate-spin text-sky-500" />
          <span>{t("fuentes.cargando")}</span>
        </div>
      );
    }

    const safeFeeds = (feeds && typeof feeds === 'object' && !Array.isArray(feeds)) ? feeds : {};
    const safeTotal = total || 0;

    const categorias = Object.keys(safeFeeds);

    if (categorias.length === 0 || safeTotal === 0) {
      return <p className="text-center text-app-muted py-8">{t("onboarding.sin_feeds")}</p>;
    }

    return (
      <>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
          {categorias.map((categoria) => {
            const lista = safeFeeds[categoria];
            if (!Array.isArray(lista)) return null;
            return (
              <div key={categoria} className="space-y-2">
                <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <Tag size={10} className="text-sky-400" />
                  </span>
                  {categoria} ({lista.length})
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lista.map((feed) => {
                    if (!feed || typeof feed !== 'object') return null;
                    const key = `${feed.titulo}|${feed.url}`;
                    return (
                      <LocalFeedCard
                        key={`${categoria}-${feed.titulo}`}
                        feed={{ ...feed, categoria }}
                        onAdd={() => onAdd(feed)}
                        adding={feedsAgregando.has(key)}
                        added={feedsAgregados.has(key)}
                        t={t}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {safeTotal > 0 && totalAgregados < safeTotal && (
          <button
            type="button"
            onClick={onAddAll}
            disabled={totalAgregados === safeTotal}
            className="btn-press w-full mt-4 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 px-3 py-2.5 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Plus size={16} /> {t("onboarding.agregar_todas", { n: safeTotal - totalAgregados })}
          </button>
        )}
      </>
    );
  } catch (e) {
    console.error("Critical render error in RecommendedFeedsList:", e);
    return <p className="text-center text-red-400 py-8">Error al cargar las recomendaciones.</p>;
  }
}
