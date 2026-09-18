// src/app/components/dashboard/ConfirmDeleteModal.js — Confirmación accesible.
// Con `seccion` muestra el alcance contextual (solo la pestaña activa).
"use client";

export default function ConfirmDeleteModal({ abierto, onCancelar, onConfirmar, t, seccion }) {
  if (!abierto) return null;
  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-eliminar-todo" className="anim-modal bg-app-surface border border-app-line rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <h3 id="titulo-eliminar-todo" className="text-lg font-bold text-app-fg">
          {seccion ? t("eliminar.titulo_seccion") : t("eliminar.titulo")}
        </h3>
        <p className="text-sm text-app-muted leading-relaxed">
          {seccion ? t("eliminar.texto_seccion", { n: seccion.total, seccion: seccion.nombre }) : t("eliminar.texto")}
        </p>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            onClick={onCancelar}
            className="btn-press px-4 py-2 bg-app-raised hover:opacity-90 rounded-xl text-sm font-medium text-app-fg"
          >
            {t("eliminar.cancelar")}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="btn-press px-4 py-2 bg-red-700 hover:bg-red-600 rounded-xl text-sm font-medium text-white hover:shadow-lg hover:shadow-red-900/30"
          >
            {t("eliminar.confirmar")}
          </button>
        </div>
      </div>
    </div>
  );
}
