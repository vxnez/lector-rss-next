// src/app/components/dashboard/WelcomeModal.js — Guía de bienvenida.
"use client";

import { X, Sparkles, ExternalLink } from "lucide-react";

export default function WelcomeModal({ abierto, onCerrar, t }) {
  if (!abierto) return null;
  return (
    <div className="anim-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="anim-modal bg-app-surface border border-app-line rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto overscroll-contain">
        <button
          onClick={onCerrar}
          aria-label={t("comun.cerrar")}
          className="btn-press absolute top-4 right-4 text-app-muted hover:text-app-fg p-1.5 rounded-lg bg-app-raised/50 hover:bg-app-raised"
        >
          <X size={20} />
        </button>
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[var(--accent)]/10 text-[var(--accent-ink)] rounded-full text-xs font-semibold border border-[var(--accent)]/20">
            <Sparkles size={14} /> {t("guia.etiqueta")}
          </div>
          <h3 className="text-2xl font-bold text-app-fg tracking-tight">{t("guia.titulo")}</h3>
          <p className="text-sm text-app-muted leading-relaxed">
            {t("guia.intro")} {t("guia.intro_b")}
          </p>
        </div>
        <div className="space-y-4 bg-app-bg/60 p-4 rounded-xl border border-app-line text-xs sm:text-sm text-app-fg">
          {[
            { n: "1", titulo: t("guia.p1t"), cuerpo: t("guia.p1d") },
            { n: "2", titulo: t("guia.p2t"), cuerpo: t("guia.p2d") },
            { n: "3", titulo: t("guia.p3t"), cuerpo: `${t("guia.p3d_a")} "${t("guia.agregar_feed")}" ${t("guia.p3d_b")}` },
          ].map((paso) => (
            <div key={paso.n} className="flex items-start gap-3">
              <span className="bg-[var(--accent-strong)] text-[var(--on-accent-strong)] font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs mt-0.5">{paso.n}</span>
              <div>
                <strong className="text-app-fg block mb-0.5">{paso.titulo}</strong>
                <p className="text-app-muted">
                  {paso.cuerpo}{" "}
                  {paso.n === "1" && (
                    <a href="https://github.com/vxnez/rssfeeds" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-ink)] hover:underline inline-flex items-center gap-1 font-medium">
                      vxnez/rssfeeds <ExternalLink size={12} />
                    </a>
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCerrar}
            className="btn-press group w-full bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium py-2.5 px-4 rounded-full transition flex items-center justify-center gap-2 text-sm"
          >
            {t("guia.entendido")}
          </button>
        </div>
      </div>
    </div>
  );
}
