// src/app/components/AjustesPanel.js — Panel lateral izquierdo de ajustes.
// Secciones: Apariencia (temas), Cuenta (perfil) y Lectura (página,
// automarcado, movimiento). El padre lo monta solo cuando está abierto.
"use client";

import { useEffect, useRef } from "react";
import { X, Check, User, Palette, BookOpen, BellRing } from "lucide-react";
import { TEMAS } from "@/lib/temas";

const TAMANOS_PAGINA = [15, 30, 60];

function Interruptor({ activado, onCambiar, etiqueta, descripcion }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activado}
      aria-label={etiqueta}
      onClick={() => onCambiar(!activado)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-left transition hover:border-gray-600"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-200">{etiqueta}</span>
        {descripcion && <span className="block text-xs text-gray-500">{descripcion}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          activado ? "bg-sky-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            activado ? "left-[1.375rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export default function AjustesPanel({
  abierto,
  onCerrar,
  tema,
  onTema,
  tamanoPagina,
  onTamanoPagina,
  autoMarcarLeida,
  onAutoMarcar,
  movimientoReducido,
  onMovimiento,
  nombreUsuario,
  esInvitado,
  onEditarPerfil,
  onIrNotificaciones,
}) {
  const cerrarRef = useRef(null);

  // Escape cierra; al abrir, el foco va al botón cerrar.
  useEffect(() => {
    if (!abierto) return undefined;
    cerrarRef.current?.focus();
    const alTeclado = (event) => {
      if (event.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onCerrar}
        className="anim-fondo-fundido fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes"
        className="anim-panel-izquierda fixed inset-y-0 left-0 z-50 flex w-[min(22rem,88vw)] flex-col border-r border-gray-800 bg-gray-900 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-4 py-3.5">
          <h2 className="text-base font-bold text-white">Ajustes</h2>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar ajustes"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          {/* Apariencia */}
          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Palette size={13} /> Apariencia
            </h3>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema de color">
              {TEMAS.map((t) => {
                const activo = tema === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => onTema(t.id)}
                    title={t.claro ? `${t.nombre} (claro)` : `${t.nombre} (oscuro)`}
                    className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                      activo
                        ? "border-sky-500 bg-sky-500/15"
                        : "border-gray-800 bg-gray-950 hover:border-gray-600"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }}
                      className="h-7 w-7 shrink-0 rounded-full border border-gray-700"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-200">
                      {t.nombre}
                    </span>
                    {activo && <Check size={14} strokeWidth={3} className="shrink-0 text-sky-400" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Cuenta */}
          <section className="space-y-2.5 border-t border-gray-800 pt-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <User size={13} /> Cuenta
            </h3>
            <p className="truncate rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm text-gray-200">
              {nombreUsuario || "Sin sesión"}
              {esInvitado && <span className="text-gray-500"> (invitado)</span>}
            </p>
            {!esInvitado && nombreUsuario && (
              <button
                type="button"
                onClick={onEditarPerfil}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
              >
                <User size={15} /> Editar perfil
              </button>
            )}
          </section>

          {/* Lectura */}
          <section className="space-y-2.5 border-t border-gray-800 pt-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <BookOpen size={13} /> Lectura
            </h3>
            <div>
              <span id="etiqueta-tamano-pagina" className="mb-1.5 block text-xs font-medium text-gray-400">
                Noticias por página
              </span>
              <div className="flex gap-1.5" role="radiogroup" aria-labelledby="etiqueta-tamano-pagina">
                {TAMANOS_PAGINA.map((n) => {
                  const activo = tamanoPagina === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => onTamanoPagina(n)}
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
            <Interruptor
              activado={autoMarcarLeida}
              onCambiar={onAutoMarcar}
              etiqueta="Marcar como leída al abrir"
              descripcion="Al abrir una noticia se marca leída sola."
            />
            <Interruptor
              activado={movimientoReducido}
              onCambiar={onMovimiento}
              etiqueta="Reducir animaciones"
              descripcion="Calma transiciones y efectos de movimiento."
            />
          </section>

          {/* Notificaciones */}
          <section className="space-y-2.5 border-t border-gray-800 pt-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <BellRing size={13} /> Notificaciones
            </h3>
            <button
              type="button"
              onClick={onIrNotificaciones}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
            >
              <BellRing size={15} /> Gestionar avisos push
            </button>
            <p className="text-xs leading-relaxed text-gray-500">
              Los avisos se activan desde Controles del dashboard.
            </p>
          </section>
        </div>
      </aside>
    </>
  );
}
