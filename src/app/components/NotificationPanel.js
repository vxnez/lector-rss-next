// src/app/components/NotificationPanel.js — Bandeja central de notificaciones.
// Presentacional: el estado vive en useNotificaciones (page.js) y la
// campanita de apertura en AppHeader. Controles: marcar todas leídas,
// selección múltiple para borrado y gestión estándar de bandeja.
"use client";

import { useState, useEffect, useRef } from "react";
import { useBloquearScroll } from "@/lib/useBloquearScroll";
import { esRuidoCuotaIA } from "@/lib/hooks/useNotificaciones";
import { useIdioma } from "@/lib/i18n";
import { X, Check, CheckCheck, Trash2, Bell, AlertCircle, ChevronLeft, Sparkles, CheckCircle2, MoveHorizontal } from "lucide-react";

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

// Barra de la corrida IA: terminada = 100 %. El total era una estimación del
// primer lote y la corrida puede cerrar antes (cuota, tope de intentos, red).
function BarraProgresoIA({ progreso, t }) {
  const ok = progreso?.estado === "ok";
  const total = Number(progreso?.total) || 0;
  const hechas = Number(progreso?.procesadas) || 0;
  const indeterminado = !ok && total <= 0;
  const pct = ok
    ? 100
    : Math.round(Math.max(0, Math.min(1, total > 0 ? hechas / total : 0)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={t("ia_bar.titulo")}
      aria-valuemin={0}
      aria-valuemax={ok ? 100 : (indeterminado ? undefined : total)}
      aria-valuenow={ok ? 100 : (indeterminado ? undefined : hechas)}
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-500/20 [html[data-tema-claro='1']_&]:bg-violet-600/20"
    >
      <div
        className={`h-full rounded-full bg-violet-500 [html[data-tema-claro='1']_&]:bg-violet-600 ${indeterminado ? "w-full animate-pulse" : "transition-[width] duration-500"}`}
        style={indeterminado ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}

function movimientoReducidoActivo() {
  try {
    if (document.documentElement.dataset.motion === "reduced") return true;
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

function NotificacionItem({
  item,
  modoSeleccion,
  seleccionada,
  onToggleSeleccion,
  onEliminar,
  onMarcarLeida,
  anunciar,
  t,
}) {
  const tipo = TIPOS[item.tipo] || TIPOS.info;
  const Icon = tipo.icon;
  const leida = item.leida;
  // La fijada (IA) nunca se opaca ni se puede eliminar: solo se actualiza
  // cuando el usuario ejecuta la categorización con IA. Tampoco se desliza.
  const esFijada = item.pinned === true;
  const deslizable = !esFijada && !modoSeleccion;

  const frenteRef = useRef(null);
  const baseX = useRef(0);
  const dxActual = useRef(0);
  const arrastrando = useRef(false);
  const idPuntero = useRef(null);
  const pintarDx = (dx) => {
    dxActual.current = dx;
    const el = frenteRef.current;
    if (el) el.style.transform = dx === 0 ? "" : `translateX(${dx}px)`;
  };

  const asentar = (dx) => {
    const el = frenteRef.current;
    if (el) {
      el.classList.remove("swipe-arrastrando");
      el.classList.add("swipe-asentando");
    }
    pintarDx(dx);
  };

  const alPunteroAbajo = (event) => {
    if (!deslizable || movimientoReducidoActivo()) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    arrastrando.current = true;
    idPuntero.current = event.pointerId;
    baseX.current = event.clientX - dxActual.current;
    const el = frenteRef.current;
    if (el) {
      el.classList.add("swipe-arrastrando");
      el.classList.remove("swipe-asentando");
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Sin captura disponible: el gesto sigue funcionando con mouse.
    }
  };

  const alPunteroMover = (event) => {
    if (!arrastrando.current || event.pointerId !== idPuntero.current) return;
    const ancho = event.currentTarget.offsetWidth || 1;
    let dx = event.clientX - baseX.current;
    // Sin acción de leer disponible: el deslizamiento a la derecha rebota.
    if (leida) dx = Math.min(dx, 0);
    const tope = Math.round(ancho * 0.45);
    if (dx > tope) dx = tope + Math.round((dx - tope) * 0.3);
    if (dx < -tope) dx = -tope + Math.round((dx + tope) * 0.3);
    pintarDx(Math.round(dx));
  };

  const alPunteroArriba = (event) => {
    if (!arrastrando.current || event.pointerId !== idPuntero.current) return;
    arrastrando.current = false;
    idPuntero.current = null;
    const ancho = event.currentTarget.offsetWidth || 1;
    const dx = dxActual.current;
    if (!leida && dx >= Math.round(ancho * 0.4)) {
      asentar(0);
      onMarcarLeida();
      anunciar(t("ajustes.notificaciones.leida_anuncio"));
    } else if (dx <= -Math.round(ancho * 0.4)) {
      asentar(0);
      onEliminar();
      anunciar(t("ajustes.notificaciones.eliminada_anuncio"));
    } else {
      // Sin fondo de acciones: todo arrastre parcial vuelve a su sitio.
      asentar(0);
    }
  };

  const cerrarDeslizado = () => {
    asentar(0);
  };

  const alToqueFila = () => {
    if (modoSeleccion && !esFijada) onToggleSeleccion();
  };

  return (
    <div className="swipe-row relative overflow-hidden rounded-xl">
      <div
        ref={frenteRef}
        onPointerDown={alPunteroAbajo}
        onPointerMove={alPunteroMover}
        onPointerUp={alPunteroArriba}
        onPointerCancel={cerrarDeslizado}
        onClick={alToqueFila}
        role={modoSeleccion && !esFijada ? "checkbox" : undefined}
        aria-checked={modoSeleccion && !esFijada ? seleccionada : undefined}
        aria-label={modoSeleccion && !esFijada ? t("ajustes.notificaciones.seleccionar_item") : undefined}
        title={!deslizable || movimientoReducidoActivo() ? undefined : t("ajustes.notificaciones.deslizar_pista")}
        className={`swipe-frente group relative flex items-start gap-3 rounded-xl border bg-app-surface px-3 py-2.5 transition-[background-color,border-color,opacity,box-shadow] duration-200 ease-out ${tipo.bg} ${tipo.border} ${leida && !esFijada ? "opacity-60" : ""} ${seleccionada ? "ring-2 ring-[var(--accent)]" : ""} ${modoSeleccion && !esFijada ? "cursor-pointer" : ""}`}
      >
        {modoSeleccion && !esFijada ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={seleccionada}
            aria-label={t("ajustes.notificaciones.seleccionar_item")}
            onClick={(event) => {
              event.stopPropagation();
              onToggleSeleccion();
            }}
            className={`touch-target mt-0.5 grid h-12 w-12 shrink-0 place-content-center rounded-xl border transition lg:h-8 lg:w-8 ${
              seleccionada
                ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]"
                : "border-app-line text-app-muted"
            }`}
          >
            {seleccionada && <Check size={18} strokeWidth={3} />}
          </button>
        ) : (
          <span className={`shrink-0 mt-0.5 ${tipo.color}`} aria-hidden="true">
            <Icon size={16} />
          </span>
        )}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${leida && !esFijada ? "text-app-muted" : "text-app-fg"}`}>
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
        {item.progreso && (
          <BarraProgresoIA progreso={item.progreso} t={t} />
        )}
      </div>
      {!esFijada && !modoSeleccion && (
        <div className="flex shrink-0 flex-col gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
          {!leida && (
            <button
              type="button"
              onClick={onMarcarLeida}
              className="touch-target btn-press rounded-lg p-1.5 text-app-muted hover:text-app-fg"
              aria-label={t("ajustes.notificaciones.marcar_leida")}
            >
              <Check size={18} />
            </button>
          )}
          <button
            type="button"
            onClick={onEliminar}
            className="touch-target btn-press rounded-lg p-1.5 text-app-muted hover:text-rose-400"
            aria-label={t("ajustes.notificaciones.eliminar")}
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}
      </div>
    </div>
  );
}

const CLAVE_PISTA_SWIPE = "lector_pista_swipe";

// Aviso emergente desechable que enseña el gesto (una sola vez por navegador).
// Sustituye al fondo verde/rojo bajo la tarjeta: menos ruido visual.
function PistaDeslizar({ visible, onCerrar, t }) {
  if (!visible) return null;
  return (
    <div className="anim-toast flex items-center gap-2 rounded-xl border border-app-line bg-app-raised/60 px-3 py-2">
      <MoveHorizontal size={16} aria-hidden="true" className="shrink-0 text-app-muted" />
      <p className="min-w-0 flex-1 text-xs leading-snug text-app-muted">
        {t("ajustes.notificaciones.pista_swipe")}
      </p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label={t("ajustes.notificaciones.pista_cerrar")}
        className="touch-target shrink-0 rounded-lg p-1 text-app-muted transition hover:text-app-fg"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function NotificationPanel({
  abierto,
  onCerrar,
  notificaciones,
  noLeidas,
  pushActivado,
  onEliminarUna,
  onMarcarLeida,
  onMarcarTodasLeidas,
  onEliminarSeleccionadas,
}) {
  const { t } = useIdioma();
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [anuncio, setAnuncio] = useState("");
  const anunciar = (mensaje) => setAnuncio(mensaje);
  // La pista del gesto se muestra una sola vez por navegador y solo si el
  // gesto está disponible (sin movimiento reducido).
  const [pistaVista, setPistaVista] = useState(() => {
    try {
      if (window.localStorage.getItem(CLAVE_PISTA_SWIPE) === "1") return true;
      if (document.documentElement.dataset.motion === "reduced") return true;
      if (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return true;
      }
      return false;
    } catch {
      return true;
    }
  });

  const cerrarPista = () => {
    setPistaVista(true);
    try {
      window.localStorage.setItem(CLAVE_PISTA_SWIPE, "1");
    } catch {
      // Sin almacenamiento: la pista reaparece, sin romper nada.
    }
  };

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

  // Exclusión en render (cinturón y tirantes): aunque el hook ya filtra al
  // ingerir e hidratar, nada de ruido de cuota llega a pintarse.
  const visibles = notificaciones.filter((n) => !esRuidoCuotaIA(n));

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
        className="anim-panel-responsive fixed z-[70] flex flex-col border-app-line bg-app-surface shadow-2xl inset-x-0 bottom-0 top-auto max-h-[85dvh] rounded-t-3xl border-t lg:inset-y-0 lg:right-0 lg:left-auto lg:top-auto lg:bottom-auto lg:max-h-none lg:w-[min(24rem,90vw)] lg:rounded-t-none lg:border-t-0 lg:border-l"
        role="region"
        aria-label={t("ajustes.notificaciones.panel")}
      >
      {/* Tirador del bottom sheet (solo móvil) */}
      <div aria-hidden="true" className="pt-2 lg:hidden">
        <div className="mx-auto h-1 w-10 rounded-full bg-app-line" />
      </div>
      {/* Anuncios de lector de pantalla para acciones por gesto */}
      <p aria-live="polite" role="status" className="sr-only">{anuncio}</p>
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-app-line px-3 py-3">
        <button
          type="button"
          onClick={onCerrar}
          aria-label={t("ajustes.notificaciones.minimizar")}
          className="touch-target rounded-lg p-1.5 text-app-muted transition hover:bg-app-raised hover:text-app-fg"
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
            className="touch-target shrink-0 rounded-lg p-1.5 text-app-muted transition hover:bg-app-raised hover:text-app-fg"
            aria-label={t("ajustes.notificaciones.cancelar_seleccion")}
          >
            <X size={18} />
          </button>
        ) : visibles.some((n) => !n.leida && !n.pinned) ? (
          <>
            <button
              type="button"
              onClick={onMarcarTodasLeidas}
              disabled={noLeidas === 0}
              aria-label={t("ajustes.notificaciones.marcar_todas_leidas")}
              title={t("ajustes.notificaciones.marcar_todas_leidas")}
              className="touch-target shrink-0 rounded-lg px-2.5 py-1.5 text-app-muted transition hover:bg-app-raised hover:text-app-fg disabled:opacity-40"
            >
              <CheckCheck size={18} aria-hidden="true" className="sm:hidden" />
              <span className="hidden text-xs font-medium sm:inline">
                {t("ajustes.notificaciones.marcar_todas_leidas")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setModoSeleccion(true); }}
              className="touch-target shrink-0 rounded-lg p-1.5 text-app-muted transition hover:bg-app-raised hover:text-app-fg"
              aria-label={t("ajustes.notificaciones.seleccionar")}
            >
              <Check size={18} />
            </button>
          </>
        ) : null}
      </div>

      {/* Lista */}
      <div className="panel-scroll flex-1 overflow-y-auto px-3 py-3 space-y-2">
        <PistaDeslizar
          visible={!pistaVista && !modoSeleccion && visibles.some((n) => !n.pinned)}
          onCerrar={cerrarPista}
          t={t}
        />
        {visibles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-app-muted/50">
            <Bell size={32} className="mb-2 opacity-50" />
            <p className="text-sm font-medium">{t("ajustes.notificaciones.vacio")}</p>
            <p className="text-xs text-center px-4">{t("ajustes.notificaciones.vacio_d")}</p>
          </div>
        ) : (
          visibles.map((item) => (
            <NotificacionItem
              key={item.id}
              item={item}
              modoSeleccion={modoSeleccion}
              seleccionada={seleccionadas.has(item.id)}
              onToggleSeleccion={() => toggleSeleccion(item.id)}
              onEliminar={() => onEliminarUna(item.id)}
              onMarcarLeida={() => onMarcarLeida(item.id)}
              anunciar={anunciar}
              t={t}
            />
          ))
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
            className="touch-target flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/15 transition"
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
