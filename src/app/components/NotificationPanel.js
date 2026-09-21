// src/app/components/NotificationPanel.js — Bandeja central de notificaciones.
// Presentacional: el estado vive en useNotificaciones (page.js) y la
// campanita de apertura en AppHeader. Controles: marcar todas leídas,
// selección múltiple para borrado y gestión estándar de bandeja.
"use client";

import { useState, useEffect } from "react";
import { useBloquearScroll } from "@/lib/useBloquearScroll";
import { useIdioma } from "@/lib/i18n";
import { X, Check, CheckCheck, Trash2, Bell, AlertCircle, ChevronLeft, Sparkles, CheckCircle2 } from "lucide-react";

const TIPOS = {
  info: { icon: Bell, color: "text-sky-400 [html[data-tema-claro='1']_&]:text-sky-600", bg: "bg-sky-500/10 [html[data-tema-claro='1']_&]:bg-sky-600/10", border: "border-sky-500/30 [html[data-tema-claro='1']_&]:border-sky-600/30" },
  success: { icon: CheckCircle2, color: "text-emerald-400 [html[data-tema-claro='1']_&]:text-emerald-600", bg: "bg-emerald-500/10 [html[data-tema-claro='1']_&]:bg-emerald-600/10", border: "border-emerald-500/30 [html[data-tema-claro='1']_&]:border-emerald-600/30" },
  error: { icon: AlertCircle, color: "text-rose-400 [html[data-tema-claro='1']_&]:text-rose-600", bg: "bg-rose-500/10 [html[data-tema-claro='1']_&]:bg-rose-600/10", border: "border-rose-500/30 [html[data-tema-claro='1']_&]:border-rose-600/30" },
  ia: { icon: Sparkles, color: "text-violet-400 [html[data-tema-claro='1']_&]:text-violet-600", bg: "bg-violet-500/10 [html[data-tema-claro='1']_&]:bg-violet-600/10", border: "border-violet-500/30 [html[data-tema-claro='1']_&]:border-violet-600/30" },
};

function formatearHora(fecha) {
  try {
    return new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" }).format(new Date(fecha));
  } catch {
    return "";
  }
}

function NotificacionItem({ item, seleccionada, onToggleSeleccion, onEliminar, onMarcarLeida, t }) {
  const tipo = TIPOS[item.tipo] || TIPOS.info;
  const Icon = tipo.icon;
  const leida = item.leida;

  return (
    <div
      className={`group relative flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all duration-200 ${tipo.bg} ${tipo.border} ${leida ? "opacity-60" : ""} ${seleccionada ? "ring-2 ring-[var(--accent)]" : ""}`}
    >
      <input
        type="checkbox"
        className="sr-only peer"
        checked={seleccionada}
        onChange={onToggleSeleccion}
      />
      <span
        className={`shrink-0 mt-0.5 ${tipo.color}`}
        aria-hidden="true"
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${leida ? "text-app-muted" : "text-app-fg"}`}>
          {item.titulo}
        </p>
        <p className="mt-0.5 text-xs text-app-muted line-clamp-1">
          {item.mensaje}
        </p>
        <p className="mt-1 text-[10px] text-app-muted/60 flex items-center gap-1">
          <span>{formatearHora(item.fecha)}</span>
          {item.pinned && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent)]">
              <CheckCircle2 size={8} strokeWidth={3} />
              {t("ajustes.notificaciones.pinned")}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity peer-checked:opacity-100">
        {!leida && (
          <button
            type="button"
            onClick={onMarcarLeida}
            className="btn-press rounded-lg p-1.5 text-app-muted hover:text-app-fg"
            aria-label={t("ajustes.notificaciones.marcar_leida")}
          >
            <Check size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onEliminar}
          className="btn-press rounded-lg p-1.5 text-app-muted hover:text-rose-400"
          aria-label={t("ajustes.notificaciones.eliminar")}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function NotificationPanel({
  abierto,
  onCerrar,
  notificaciones,
  noLeidas,
  iaProgreso,
  onCerrarIA,
  pushActivado,
  onEliminarUna,
  onMarcarLeida,
  onMarcarTodasLeidas,
  onEliminarSeleccionadas,
}) {
  const { t } = useIdioma();
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState(new Set());

  // Mismo comportamiento que AjustesPanel: fondo sin scroll ni interacción,
  // Escape cierra. Sin setState en el cuerpo del efecto.
  useBloquearScroll(abierto);
  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclado = (event) => {
      if (event.key !== "Escape") return;
      setModoSeleccion(false);
      setSeleccionadas(new Set());
      onCerrar();
    };
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  // Barra IA: corrida terminada = 100 %. El total era una estimación del
  // primer lote y la corrida puede cerrar antes (cuota, tope de intentos, red).
  const iaOk = iaProgreso?.estado === "ok";
  const iaTotal = Number(iaProgreso?.total) || 0;
  const iaProcesadas = Number(iaProgreso?.procesadas) || 0;
  const iaIndeterminado = !iaOk && iaTotal <= 0;
  const iaPct = iaOk
    ? 100
    : Math.round(Math.max(0, Math.min(1, iaTotal > 0 ? iaProcesadas / iaTotal : 0)) * 100);

  const toggleSeleccion = (id) => {
    setSeleccionadas((prev) => {
      const nuevas = new Set(prev);
      if (nuevas.has(id)) nuevas.delete(id);
      else nuevas.add(id);
      return nuevas;
    });
  };

  const borrarSeleccion = () => {
    onEliminarSeleccionadas(seleccionadas);
    setSeleccionadas(new Set());
    setModoSeleccion(false);
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onCerrar}
        className="anim-fondo-fundido fixed inset-0 z-[65] bg-black/60 backdrop-blur-[2px]"
      />
      <div
        className="anim-panel-derecha fixed inset-y-0 right-0 z-[70] flex w-[min(24rem,90vw)] flex-col border-l border-app-line bg-app-surface shadow-2xl"
        role="region"
        aria-label={t("ajustes.notificaciones.panel")}
      >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-app-line px-3 py-3">
        <button
          type="button"
          onClick={onCerrar}
          aria-label={t("ajustes.notificaciones.minimizar")}
          className="rounded-lg p-1.5 text-app-muted transition hover:bg-app-raised hover:text-app-fg"
        >
          <ChevronLeft size={20} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-base font-bold text-app-fg">
          {t("ajustes.notificaciones.titulo")}
        </h2>
        {modoSeleccion ? (
          <button
            type="button"
            onClick={() => { setModoSeleccion(false); setSeleccionadas(new Set()); }}
            className="rounded-lg p-1.5 text-app-muted transition hover:bg-app-raised hover:text-app-fg"
            aria-label={t("ajustes.notificaciones.cancelar_seleccion")}
          >
            <X size={18} />
          </button>
        ) : notificaciones.some((n) => !n.leida && !n.pinned) ? (
          <>
            <button
              type="button"
              onClick={onMarcarTodasLeidas}
              disabled={noLeidas === 0}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-app-muted transition hover:bg-app-raised hover:text-app-fg disabled:opacity-40"
            >
              {t("ajustes.notificaciones.marcar_todas_leidas")}
            </button>
            <button
              type="button"
              onClick={() => { setModoSeleccion(true); }}
              className="rounded-lg p-1.5 text-app-muted transition hover:bg-app-raised hover:text-app-fg"
              aria-label={t("ajustes.notificaciones.seleccionar")}
            >
              <Check size={18} />
            </button>
          </>
        ) : null}
      </div>

      {/* Lista */}
      <div className="panel-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {notificaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-app-muted/50">
            <Bell size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">{t("ajustes.notificaciones.vacio")}</p>
            <p className="text-xs text-center px-4">{t("ajustes.notificaciones.vacio_d")}</p>
          </div>
        ) : (
          notificaciones.map((item) => (
            <NotificacionItem
              key={item.id}
              item={item}
              seleccionada={seleccionadas.has(item.id)}
              onToggleSeleccion={() => toggleSeleccion(item.id)}
              onEliminar={() => onEliminarUna(item.id)}
              onMarcarLeida={() => onMarcarLeida(item.id)}
              t={t}
            />
          ))
        )}

        {/* IA Progress con barra - siempre visible si hay progreso */}
        {iaProgreso && (
          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0 text-violet-400 [html[data-tema-claro='1']_&]:text-violet-600" aria-hidden="true">
                {iaProgreso.estado === "error" ? <AlertCircle size={16} /> : iaProgreso.estado === "ok" ? <CheckCheck size={16} /> : <Sparkles size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-app-fg">
                  {iaProgreso.estado === "ok" ? t("ia_bar.ok") : t("ia_bar.titulo")}
                </p>
                <p className="mt-0.5 text-xs text-app-muted">
                  {iaProgreso.estado === "error"
                    ? (iaProgreso.diag ? t(`avisos.ia_err_${iaProgreso.diag}`) : t("avisos.ia_err"))
                    : iaProgreso.estado === "ok"
                    ? (iaProgreso.procesadas > 0 ? t("avisos.ia_ok", { n: iaProgreso.procesadas }) : t("avisos.ia_sin_pendientes"))
                    : t("ia_bar.avance", {
                        a: iaProgreso.procesadas || 0,
                        total: iaProgreso.total || 0,
                        p: iaProgreso.pendientes || 0
                      })}
                </p>
                <div
                  role="progressbar"
                  aria-label={t("ia_bar.titulo")}
                  aria-valuemin={0}
                  aria-valuemax={iaOk ? 100 : (iaIndeterminado ? undefined : iaTotal)}
                  aria-valuenow={iaOk ? 100 : (iaIndeterminado ? undefined : iaProcesadas)}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-500/20 [html[data-tema-claro='1']_&]:bg-violet-600/20"
                >
                  <div
                    className={`h-full rounded-full bg-violet-500 [html[data-tema-claro='1']_&]:bg-violet-600 ${iaIndeterminado ? "w-full animate-pulse" : "transition-[width] duration-500"}`}
                    style={iaIndeterminado ? undefined : { width: `${iaPct}%` }}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {(iaProgreso.estado === "ok" || iaProgreso.estado === "error") && (
                  <button
                    type="button"
                    onClick={onCerrarIA}
                    className="btn-press rounded-lg p-1 opacity-70 hover:opacity-100"
                    aria-label={t("ia_bar.cerrar")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Push status */}
        {pushActivado !== undefined && (
          <div className="rounded-xl border border-app-line bg-app-surface/50 px-3 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-app-muted" />
                <span className="text-sm font-medium text-app-fg">{t("ajustes.notificaciones.push_estado")}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pushActivado ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700/50 text-gray-500"}`}>
                {pushActivado ? t("ajustes.notificaciones.activado") : t("ajustes.notificaciones.desactivado")}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer acciones selección múltiple */}
      {modoSeleccion && seleccionadas.size > 0 && (
        <div className="border-t border-app-line p-3">
          <button
            type="button"
            onClick={borrarSeleccion}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/15 transition"
          >
            <Trash2 size={14} />
            {t("ajustes.notificaciones.eliminar_seleccionadas", { n: seleccionadas.size })}
          </button>
        </div>
      )}
      </div>
    </>
  );
}
