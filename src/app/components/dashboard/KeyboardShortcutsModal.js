// src/app/components/dashboard/KeyboardShortcutsModal.js
"use client";

import { useEffect } from "react";
import { X, Keyboard, Command } from "lucide-react";
import { useBloquearScroll } from "@/lib/useBloquearScroll";

export default function KeyboardShortcutsModal({ abierto, onCerrar, t }) {
  useBloquearScroll(abierto);

  useEffect(() => {
    if (!abierto) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const grupos = [
    {
      titulo: t("atajos.g_nav"),
      atajos: [
        { teclas: ["J", "↓"], descripcion: t("atajos.nav_siguiente") },
        { teclas: ["K", "↑"], descripcion: t("atajos.nav_anterior") },
        { teclas: ["Enter", "O"], descripcion: t("atajos.nav_abrir") },
        { teclas: ["/"], descripcion: t("atajos.nav_buscar") },
        { teclas: ["Esc"], descripcion: t("atajos.nav_esc") },
      ],
    },
    {
      titulo: t("atajos.g_lector"),
      atajos: [
        { teclas: ["D", "→"], descripcion: t("atajos.lector_siguiente") },
        { teclas: ["A", "←"], descripcion: t("atajos.lector_anterior") },
      ],
    },
    {
      titulo: t("atajos.g_acciones"),
      atajos: [
        { teclas: ["M"], descripcion: t("atajos.acc_leer") },
        { teclas: ["S"], descripcion: t("atajos.acc_guardar") },
        { teclas: ["X"], descripcion: t("atajos.acc_descartar") },
      ],
    },
    {
      titulo: t("atajos.g_secciones"),
      atajos: [
        { teclas: ["1"], descripcion: t("atajos.sec_pendientes") },
        { teclas: ["2"], descripcion: t("atajos.sec_leidas") },
        { teclas: ["3"], descripcion: t("atajos.sec_guardadas") },
        { teclas: ["?"], descripcion: t("atajos.sec_guia") },
      ],
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-atajos"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm anim-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="bezel-outer w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="bezel-inner p-6 space-y-6 bg-app-surface text-app-fg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-app-line/70 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
                <Keyboard size={18} />
              </span>
              <div>
                <h2 id="titulo-atajos" className="text-base font-bold text-app-fg">
                  {t("atajos.titulo")}
                </h2>
                <p className="text-xs text-app-muted">{t("atajos.subtitulo")}</p>
              </div>
            </div>
            <button
              onClick={onCerrar}
              aria-label={t("atajos.cerrar")}
              className="btn-press rounded-lg p-1.5 text-app-muted hover:bg-app-raised hover:text-app-fg transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Grupos de Atajos */}
          <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
            {grupos.map((grupo) => (
              <div key={grupo.titulo} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-app-muted px-1">
                  {grupo.titulo}
                </h3>
                <div className="divide-y divide-app-line/50 rounded-xl border border-app-line bg-app-bg/50 overflow-hidden">
                  {grupo.atajos.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                      <span className="text-app-fg font-medium">{item.descripcion}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.teclas.map((tecla, kIdx) => (
                          <span key={kIdx} className="flex items-center gap-1">
                            {kIdx > 0 && <span className="text-app-muted text-[10px]">o</span>}
                            <kbd className="min-w-[1.75rem] px-1.5 py-1 text-center font-mono text-[11px] font-bold rounded-md bg-app-raised border border-app-line text-[var(--accent-ink)] shadow-sm">
                              {tecla}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-app-line/70 pt-3 text-[11px] text-app-muted">
            <span className="flex items-center gap-1">
              <Command size={12} className="opacity-70" />
              Presiona <kbd className="px-1 rounded bg-app-raised border border-app-line text-[10px]">?</kbd> en cualquier momento para ver esta ayuda.
            </span>
            <button
              onClick={onCerrar}
              className="btn-press rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-[var(--on-accent-strong)] hover:opacity-90 transition"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
