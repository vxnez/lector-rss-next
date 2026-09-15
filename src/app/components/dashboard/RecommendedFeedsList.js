// src/app/components/dashboard/RecommendedFeedsList.js
"use client";

import React from "react";
import { Loader2, Tag, Plus } from "lucide-react";

// Nota: FeedCard se implementa localmente aquí para evitar dependencias circulares o archivos inexistentes
function LocalFeedCard({ feed, onAdd, adding, added, t }) {
  return (
    <div className="card-lift rounded-2xl border border-app-line/80 bg-app-bg/60 p-4 hover:border-[var(--accent)]/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2 text-xs text-app-muted">
            <Tag size={12} className="opacity-75" />
            <span>{feed.categoria}</span>
          </div>
          <h4 className="mb-1 truncate text-base font-semibold text-app-fg">{feed.titulo}</h4>
          <p className="line-clamp-2 text-sm text-app-muted">{feed.descripcion}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={adding || added}
          className={`btn-press flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-[transform,border-color,background-color,box-shadow,color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
            added
              ? "border-emerald-900/40 bg-emerald-950/40 text-emerald-300 cursor-default"
              : adding
              ? "border-[var(--accent)]/30 bg-[var(--accent)]/15 text-[var(--accent-ink)] cursor-wait"
              : "border-[var(--accent)]/40 bg-[var(--accent-strong)] text-[var(--on-accent-strong)] hover:opacity-90 hover:shadow-[0_8px_20px_-12px_var(--accent)]"
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
  if (cargando) {
    return (
      <div className="flex justify-center items-center py-8 text-app-muted gap-2">
        <Loader2 size={20} className="animate-spin text-sky-500" />
        <span>{t("fuentes.cargando")}</span>
      </div>
    );
  }

  const safeFeeds = feeds && typeof feeds === "object" && !Array.isArray(feeds) ? feeds : {};
  const safeTotal = total || 0;
  const categorias = Object.keys(safeFeeds);

  if (categorias.length === 0 || safeTotal === 0) {
    return <p className="text-center text-app-muted py-8">{t("onboarding.sin_feeds")}</p>;
  }

  return (
    <>
      <div className="scroll-oculto max-h-[50vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
        {categorias.map((categoria) => {
          const lista = safeFeeds[categoria];
          if (!Array.isArray(lista)) return null;
          return (
            <div key={categoria} className="space-y-2">
              <h5 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-app-muted">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]/15">
                  <Tag size={10} className="text-[var(--accent-ink)]" />
                </span>
                {categoria} ({lista.length})
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {lista.map((feed) => {
                  if (!feed || typeof feed !== "object") return null;
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
          className="btn-press mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/15 px-3 py-2.5 text-sm font-medium text-[var(--accent-ink)] hover:border-[var(--accent)]/60 hover:bg-[var(--accent)]/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] disabled:opacity-50"
        >
          <Plus size={16} /> {t("onboarding.agregar_todas", { n: safeTotal - totalAgregados })}
        </button>
      )}
    </>
  );
}
