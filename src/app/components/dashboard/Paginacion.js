// src/app/components/dashboard/Paginacion.js — Paginación con elipsis.
"use client";

import { numerosPagina } from "@/lib/feed-utils";

export default function Paginacion({ pagina, totalPaginas, totalNoticias, cargando, onCambiar, t }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3 notranslate" translate="no">
      <p className="text-xs text-app-muted" role="status">
        {t("pag.estado", { a: pagina, b: totalPaginas, n: totalNoticias })}
        {cargando ? t("pag.cargando") : ""}
      </p>
      {totalPaginas > 1 && (
        <nav aria-label={t("pag.nav")} className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => onCambiar(pagina - 1)}
            disabled={pagina === 1 || cargando}
            aria-label={t("pag.aria_ant")}
            className="btn-press rounded-lg border border-app-line bg-app-surface px-3 py-1.5 text-xs font-medium text-app-fg hover:border-app-muted hover:text-app-fg disabled:opacity-40"
          >
            {t("pag.anterior")}
          </button>
          {numerosPagina(totalPaginas, pagina).map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} aria-hidden="true" className="px-1 text-xs text-app-muted">…</span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onCambiar(n)}
                disabled={cargando}
                aria-label={t("pag.ir_a", { n })}
                aria-current={n === pagina ? "page" : undefined}
                  className={`btn-press min-w-9 rounded-lg border px-3 py-1.5 text-xs font-medium tabular-nums disabled:opacity-40 ${
                    n === pagina
                      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent-ink)]"
                      : "border-app-line bg-app-surface text-app-muted hover:border-app-muted hover:text-app-fg"
                  }`}
              >
                {n}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onCambiar(pagina + 1)}
            disabled={pagina === totalPaginas || cargando}
            aria-label={t("pag.aria_sig")}
            className="btn-press rounded-lg border border-app-line bg-app-surface px-3 py-1.5 text-xs font-medium text-app-fg hover:border-app-muted hover:text-app-fg disabled:opacity-40"
          >
            {t("pag.siguiente")}
          </button>
        </nav>
      )}
    </div>
  );
}
