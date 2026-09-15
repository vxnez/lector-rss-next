// src/app/components/dashboard/StatsCards.js — Tarjetas de conteos globales.
"use client";

import { Newspaper, CheckCheck, Bookmark, Rss } from "lucide-react";

const ICONOS_POR_TAB = {
  todas: Newspaper,
  leidas: CheckCheck,
  guardadas: Bookmark,
};

export default function StatsCards({ tarjetas, activeTab, onSeleccionarTab, onIrFuentes }) {
  return (
    <div className="order-1 lg:order-none grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 notranslate" translate="no">
      {tarjetas.map((tarjeta, indice) => {
        const activa = tarjeta.tab ? activeTab === tarjeta.tab : false;
        const Icono = tarjeta.tab ? (ICONOS_POR_TAB[tarjeta.tab] ?? Newspaper) : Rss;
        return (
          <button
            key={tarjeta.label}
            type="button"
            title={tarjeta.titulo}
            aria-pressed={tarjeta.tab ? activa : undefined}
            onClick={() => {
              if (tarjeta.tab) onSeleccionarTab(tarjeta.tab);
              else onIrFuentes();
            }}
            style={{ "--stagger-delay": `${Math.min(indice * 60, 180)}ms` }}
            className={`stagger-in btn-press card-lift group border rounded-2xl p-[3px] min-w-0 text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
              activa
                ? "border-[var(--accent)]/60 shadow-[0_8px_30px_-12px_color-mix(in_srgb,var(--accent)_55%,transparent)]"
                : "border-app-line hover:border-app-muted"
            } bg-app-surface/70`}
          >
            <span
              className={`bezel-inner flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-3 ${
                activa ? "bg-app-raised/80" : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`cta-icon shrink-0 ${
                  activa ? "text-[var(--accent-ink)]" : "text-app-muted group-hover:text-app-fg"
                }`}
              >
                <Icono size={16} strokeWidth={2.25} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] sm:text-[11px] uppercase tracking-[0.14em] text-app-muted truncate">
                  {tarjeta.label}
                </span>
                <span className={`block text-xl sm:text-2xl font-semibold tabular-nums leading-tight ${tarjeta.color}`}>
                  {tarjeta.value}
                </span>
              </span>
              {activa && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_12px_var(--accent)]"
                />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
