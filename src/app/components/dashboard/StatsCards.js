// src/app/components/dashboard/StatsCards.js — Tarjetas de conteos globales.
"use client";

export default function StatsCards({ tarjetas, activeTab, onSeleccionarTab, onIrFuentes }) {
  return (
    <div className="order-1 lg:order-none grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {tarjetas.map((tarjeta) => (
        <button
          key={tarjeta.label}
          type="button"
          title={tarjeta.titulo}
          aria-pressed={tarjeta.tab ? activeTab === tarjeta.tab : undefined}
          onClick={() => {
            if (tarjeta.tab) onSeleccionarTab(tarjeta.tab);
            else onIrFuentes();
          }}
          className={`border border-app-line bg-app-surface/70 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 min-w-0 text-left transition cursor-pointer hover:border-app-muted ${tarjeta.tab && activeTab === tarjeta.tab ? tarjeta.activo : ""}`}
        >
          <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-app-muted truncate">{tarjeta.label}</p>
          <p className={`text-xl sm:text-2xl font-semibold ${tarjeta.color}`}>{tarjeta.value}</p>
        </button>
      ))}
    </div>
  );
}
