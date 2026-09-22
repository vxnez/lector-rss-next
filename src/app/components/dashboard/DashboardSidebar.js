// src/app/components/dashboard/DashboardSidebar.js
"use client";

import { useState, useRef } from "react";
import {
  Settings,
  Plus,
  Sparkles,
  Filter,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  Check as CheckData,
  Circle as CircleData,
  LoaderCircle as LoaderCircleData,
  RotateCw as RotateCwData,
  Settings as SettingsData,
  Sparkles as SparklesData,
  ChevronDown as ChevronDownData,
  ChevronUp as ChevronUpData,
} from "lucide";
import MorphIcon from "../MorphIcon";
import { dominioDeUrl } from "@/lib/formato";
import { traducirCategoria } from "@/lib/categoryStyles";
import { useIdioma } from "@/lib/i18n";

function IconoFuentePildora({ fuente }) {
  const [fallo, setFallo] = useState(false);
  const dominio = dominioDeUrl(fuente?.url_feed || "");
  if (!dominio || fallo) {
    return (
      <span
        aria-hidden="true"
        className="grid h-4 w-4 shrink-0 place-content-center rounded-full bg-app-raised text-[9px] font-bold text-[var(--accent-ink)]"
      >
        {(fuente?.nombre || "?").trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/icon?domain=${dominio}`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className="h-4 w-4 shrink-0 rounded-full object-cover"
    />
  );
}

export default function DashboardSidebar({
  controlsOpen,
  setControlsOpen,
  filtersOpen,
  setFiltersOpen,
  panelMovilAbierto,
  refreshing,
  onRefresh,
  onOpenAddModal,
  onCategorizarIA,
  iaProgreso,
  onEliminarTodas,
  onManageSources,
  isManageModalOpen,
  activeTab,
  onSeleccionarTab,
  tamanoPagina,
  onCambiarTamanoPagina,
  onOpenOnboarding,
  hayFiltrosActivos,
  numFiltrosActivos,
  onLimpiarFiltros,
  orden,
  onCambiarOrden,
  filtroIA,
  onCambiarFiltroIA,
  fuentesDisponibles,
  fuentesSeleccionadas,
  onAlternarFuente,
  onSeleccionarTodasFuentes,
  categoriasDisponibles,
  categoriasSeleccionadas,
  onAlternarCategoria,
  onSeleccionarTodasCategorias,
  t,
}) {
  const [fuentesExpandidas, setFuentesExpandidas] = useState(false);
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(false);
  const filtroFuenteRef = useRef(null);
  const { idioma } = useIdioma();

  return (
    <aside
      className={`dashboard-control-sidebar scroll-oculto order-5 lg:order-last space-y-3 rounded-3xl border border-app-line/80 bg-app-surface/85 p-3 backdrop-blur-xl sm:p-4 lg:sticky lg:top-24 ${
        panelMovilAbierto
          ? "max-lg:fixed max-lg:inset-x-3 max-lg:bottom-20 max-lg:z-40 max-lg:max-h-[calc(70dvh-4rem)] max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:shadow-2xl"
          : "max-lg:hidden"
      }`}
    >
      {/* Sección Controles y Acciones */}
      <section className="rounded-2xl border border-app-line/70 bg-app-bg/35 p-3 sm:p-3.5">
        <button
          type="button"
          onClick={() => setControlsOpen((open) => !open)}
          aria-expanded={controlsOpen}
          className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-app-fg font-semibold text-[clamp(0.75rem,1vw,0.875rem)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent-ink)]">
              <Settings size={15} />
            </span>
            <span className="truncate">{t("controles.titulo")}</span>
          </span>
          <MorphIcon icon={controlsOpen ? ChevronUpData : ChevronDownData} size={18} className="text-app-muted" />
        </button>

        {controlsOpen && (
          <div className="stagger-in space-y-4 border-t border-app-line/70 pt-3.5">
            <section className="space-y-3">
              <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-[0.12em] text-app-muted">
                {t("controles.acciones")}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  title={t("controles.refrescar_titulo")}
                  className="btn-press flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-app-line bg-app-raised/70 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-app-fg hover:border-[var(--accent)]/50 hover:bg-app-raised disabled:opacity-50"
                >
                  <MorphIcon
                    icon={refreshing ? LoaderCircleData : RotateCwData}
                    size={14}
                    className={refreshing ? "animate-spin text-sky-400" : ""}
                  />
                  <span className="truncate">
                    {refreshing ? t("controles.actualizando") : t("controles.refrescar")}
                  </span>
                </button>
                <button
                  onClick={onOpenAddModal}
                  className="btn-press group flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-[var(--on-accent-strong)] hover:opacity-90 hover:shadow-[0_8px_22px_-12px_var(--accent)]"
                >
                  <Plus size={14} />
                  <span className="truncate">{t("controles.agregar")}</span>
                </button>
              </div>
              <button
                onClick={onCategorizarIA}
                title={t("controles.ia_titulo")}
                aria-label={t("controles.ia_titulo")}
                aria-live="polite"
                className="btn-press flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/10 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-violet-300 hover:border-violet-400/60 hover:bg-violet-500/15 [html[data-tema-claro='1']_&]:border-violet-600/50 [html[data-tema-claro='1']_&]:bg-violet-600/10 [html[data-tema-claro='1']_&]:text-violet-800 [html[data-tema-claro='1']_&]:hover:bg-violet-600/15"
              >
                <MorphIcon
                  icon={iaProgreso?.estado === "en_curso" ? LoaderCircleData : SparklesData}
                  size={14}
                  className={
                    iaProgreso?.estado === "en_curso"
                      ? "animate-spin text-violet-300 [html[data-tema-claro='1']_&]:text-violet-700"
                      : ""
                  }
                />
                <span className="truncate">
                  {iaProgreso?.estado === "en_curso"
                    ? `${t("controles.ia_categorizando")} (${iaProgreso.pendientes ?? "…"})`
                    : t("controles.ia_categorizar")}
                </span>
              </button>
            </section>

            <section className="space-y-3 border-t border-app-line/70 pt-4">
              <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-[0.12em] text-app-muted">
                {t("controles.admin")}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onEliminarTodas}
                  title={t("controles.eliminar_seccion_titulo")}
                  className="btn-press flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/15"
                >
                  <Trash2 size={14} />
                  <span className="truncate">{t("controles.eliminar")}</span>
                </button>
                <button
                  onClick={onManageSources}
                  className="btn-press flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-app-line bg-app-raised/70 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-app-fg hover:border-[var(--accent)]/50 hover:bg-app-raised"
                >
                  <MorphIcon icon={isManageModalOpen ? SettingsData : SettingsData} size={14} />
                  <span className="truncate">{t("controles.fuentes")}</span>
                </button>
              </div>
            </section>

            <section className="space-y-3 border-t border-app-line/70 pt-4">
              <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-[0.12em] text-app-muted">
                {t("controles.vista")}
              </h2>
              <div>
                <span className="mb-1.5 block text-xs font-medium text-gray-400">
                  {t("controles.pestana")}
                </span>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("controles.pestana")}>
                  {[
                    { valor: "todas", etiqueta: t("stats.pendientes") },
                    { valor: "leidas", etiqueta: t("stats.leidas") },
                    { valor: "guardadas", etiqueta: t("stats.guardadas") },
                  ].map((opcion) => {
                    const activa = activeTab === opcion.valor;
                    return (
                      <button
                        key={opcion.valor}
                        type="button"
                        role="radio"
                        aria-checked={activa}
                        onClick={() => onSeleccionarTab(opcion.valor)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                          activa
                            ? "border-sky-500 bg-sky-500/15 text-sky-300"
                            : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        <MorphIcon
                          icon={activa ? CheckData : CircleData}
                          size={13}
                          strokeWidth={2.5}
                          className="shrink-0"
                        />
                        {opcion.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-xs font-medium text-gray-400">
                  {t("controles.pagina")}
                </span>
                <div className="flex gap-1.5" role="radiogroup" aria-label={t("controles.pagina")}>
                  {[15, 30, 60].map((n) => {
                    const activo = tamanoPagina === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => onCambiarTamanoPagina(n)}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          activo
                            ? "border-sky-500 bg-sky-500/15 text-sky-300"
                            : "border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenOnboarding}
                className="btn-press flex w-full items-center justify-center gap-1.5 rounded-xl border border-app-line bg-app-raised/70 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-app-fg hover:border-[var(--accent)]/50 hover:bg-app-raised"
              >
                <Sparkles size={14} />
                <span className="truncate">Sugerencia de fuentes</span>
              </button>
            </section>
          </div>
        )}
      </section>

      {/* Sección Filtros */}
      <section className="rounded-2xl border border-app-line/70 bg-app-bg/25 p-3 sm:p-3.5">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-app-fg font-semibold text-[clamp(0.75rem,1vw,0.875rem)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent-ink)]">
              <Filter size={15} />
            </span>
            <span className="truncate">{t("filtros.titulo")}</span>
            {numFiltrosActivos > 0 && (
              <span
                aria-hidden="true"
                className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-gray-950"
              >
                {numFiltrosActivos}
              </span>
            )}
          </span>
          <MorphIcon icon={filtersOpen ? ChevronUpData : ChevronDownData} size={18} className="text-app-muted" />
        </button>
      </section>

      {filtersOpen && (
        <div className="space-y-5 sm:space-y-6">
          {/* Botón limpiar filtros */}
          {hayFiltrosActivos && (
            <div className="sticky top-0 z-10 rounded-xl bg-app-surface/95 py-1 backdrop-blur-sm">
              <button
                onClick={onLimpiarFiltros}
                className="btn-press w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 flex items-center justify-center gap-2"
              >
                <XCircle size={15} /> {t("filtros.limpiar")} · {numFiltrosActivos}
              </button>
            </div>
          )}

          {/* Ordenar */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-400">{t("filtros.ordenar")}</span>
            <div
              className="flex flex-wrap gap-1.5 rounded-xl border border-app-line/50 bg-app-surface/40 p-2"
              role="radiogroup"
              aria-label={t("filtros.ordenar")}
            >
              {[
                { valor: "recientes", etiqueta: t("filtros.recientes") },
                { valor: "antiguas", etiqueta: t("filtros.antiguas") },
                { valor: "az", etiqueta: t("filtros.az") },
                { valor: "za", etiqueta: t("filtros.za") },
              ].map((opcion) => {
                const activo = orden === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => onCambiarOrden(opcion.valor)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                      activo
                        ? "border-sky-500 bg-sky-500/15 text-sky-300"
                        : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                    }`}
                  >
                    <MorphIcon
                      icon={activo ? CheckData : CircleData}
                      size={13}
                      strokeWidth={2.5}
                      className="shrink-0"
                    />
                    {opcion.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtro IA */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-400">{t("filtros.ia_estado")}</span>
            <div
              className="flex flex-wrap gap-1.5 rounded-xl border border-app-line/50 bg-app-surface/40 p-2"
              role="radiogroup"
              aria-label={t("filtros.ia_estado")}
            >
              {[
                { valor: "todas", etiqueta: t("filtros.ia_todas") },
                { valor: "con_ia", etiqueta: t("filtros.ia_con_ia") },
                { valor: "sin_ia", etiqueta: t("filtros.ia_sin_ia") },
              ].map((opcion) => {
                const activo = filtroIA === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => onCambiarFiltroIA(opcion.valor)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                      activo
                        ? "border-violet-500 bg-violet-500/15 text-violet-300 [html[data-tema-claro='1']_&]:border-violet-600 [html[data-tema-claro='1']_&]:bg-violet-600/10 [html[data-tema-claro='1']_&]:text-violet-800"
                        : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                    }`}
                  >
                    <MorphIcon
                      icon={activo ? CheckData : CircleData}
                      size={13}
                      strokeWidth={2.5}
                      className="shrink-0"
                    />
                    {opcion.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fuentes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-400">{t("filtros.fuente")}</span>
              <span className="flex items-center gap-2">
                {fuentesSeleccionadas.length > 0 && (
                  <span className="text-[11px] text-sky-400">
                    {fuentesSeleccionadas.length === 1
                      ? t("filtros.sel_una", { n: 1 })
                      : t("filtros.sel_varias", { n: fuentesSeleccionadas.length })}
                  </span>
                )}
                {fuentesDisponibles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSeleccionarTodasFuentes(fuentesSeleccionadas.length === 0)}
                    className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                  >
                    {fuentesSeleccionadas.length === 0 ? t("filtros.todas") : t("filtros.ninguna")}
                  </button>
                )}
              </span>
            </div>
            <div
              ref={filtroFuenteRef}
              tabIndex={-1}
              translate="no"
              className={`notranslate flex flex-wrap gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${
                fuentesExpandidas ? "" : "[&>*:nth-child(n+9)]:max-lg:hidden"
              }`}
            >
              {fuentesDisponibles.map((fuente) => {
                const activa = fuentesSeleccionadas.includes(String(fuente.id));
                return (
                  <button
                    key={fuente.id}
                    type="button"
                    aria-pressed={activa}
                    title={fuente.nombre}
                    onClick={() => onAlternarFuente(fuente.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 max-w-44 ${
                      activa
                        ? "border-sky-500 bg-sky-500/15 text-sky-300"
                        : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                    }`}
                  >
                    <MorphIcon
                      icon={activa ? CheckData : CircleData}
                      size={13}
                      strokeWidth={2.5}
                      className="shrink-0"
                    />
                    <IconoFuentePildora fuente={fuente} />
                    <span className="truncate">{fuente.nombre}</span>
                  </button>
                );
              })}
            </div>
            {fuentesDisponibles.length > 8 && (
              <button
                type="button"
                onClick={() => setFuentesExpandidas((e) => !e)}
                className="lg:hidden text-xs text-sky-400 hover:text-sky-300 font-medium px-1 py-1 text-left"
              >
                {fuentesExpandidas
                  ? t("filtros.ver_menos")
                  : t("filtros.ver_todas", { n: fuentesDisponibles.length })}
              </button>
            )}
          </div>

          {/* Categorías */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-gray-400">{t("filtros.categorias")}</label>
              <span className="flex items-center gap-2">
                {categoriasSeleccionadas.length > 0 && (
                  <span className="text-[11px] text-sky-400">
                    {categoriasSeleccionadas.length === 1
                      ? t("filtros.sel_una", { n: 1 })
                      : t("filtros.sel_varias", { n: categoriasSeleccionadas.length })}
                  </span>
                )}
                {categoriasDisponibles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onSeleccionarTodasCategorias(categoriasSeleccionadas.length === 0)}
                    className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                  >
                    {categoriasSeleccionadas.length === 0 ? t("filtros.todas") : t("filtros.ninguna")}
                  </button>
                )}
              </span>
            </div>
            <div
              className={`flex flex-wrap gap-1.5 ${
                categoriasExpandidas ? "" : "[&>*:nth-child(n+9)]:max-lg:hidden"
              }`}
            >
              {categoriasDisponibles.map((categoria) => {
                const activa = categoriasSeleccionadas.includes(categoria);
                return (
                  <button
                    key={categoria}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => onAlternarCategoria(categoria)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                      activa
                        ? "border-sky-500 bg-sky-500/15 text-sky-300"
                        : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                    }`}
                  >
                    <MorphIcon
                      icon={activa ? CheckData : CircleData}
                      size={13}
                      strokeWidth={2.5}
                      className="shrink-0"
                    />
                    {traducirCategoria(categoria, idioma)}
                  </button>
                );
              })}
            </div>

            {categoriasDisponibles.length > 8 && (
              <button
                type="button"
                onClick={() => setCategoriasExpandidas((e) => !e)}
                className="lg:hidden text-xs text-sky-400 hover:text-sky-300 font-medium px-1 py-1 text-left"
              >
                {categoriasExpandidas
                  ? t("filtros.ver_menos")
                  : t("filtros.ver_todas", { n: categoriasDisponibles.length })}
              </button>
            )}

            {categoriasDisponibles.length === 0 && (
              <p className="px-1 py-2 text-xs text-gray-500">{t("filtros.sin_categorias")}</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
