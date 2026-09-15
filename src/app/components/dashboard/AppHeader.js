// src/app/components/dashboard/AppHeader.js — Navbar con tokens de tema.
"use client";

import Link from "next/link";
import { Rss, Settings, LogIn, UserPlus } from "lucide-react";

export default function AppHeader({ session, esInvitado, panelAjustes, onAbrirAjustes, t }) {
  const botonAjustes = (
    <button
      type="button"
      onClick={onAbrirAjustes}
      title={t("header.ajustes_titulo")}
      aria-label={t("header.ajustes_aria")}
      aria-expanded={panelAjustes}
      className="btn-press rounded-xl p-2 text-app-muted transition hover:bg-app-raised/70 hover:text-app-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <Settings size={20} />
    </button>
  );

  const logoApp = (
    <h1 className="text-base sm:text-xl font-bold tracking-tight text-app-fg flex items-center gap-2 min-w-0">
      <span
        style={{
          backgroundColor: "var(--accent-strong)",
          color: "var(--on-accent-strong)",
          boxShadow: "0 6px 20px -8px color-mix(in srgb, var(--accent) 70%, transparent)",
        }}
        className="p-1.5 rounded-xl font-black text-sm flex items-center justify-center transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]"
      >
        <Rss size={18} className="stroke-[3]" />
      </span>
      <span className="truncate">RSS Dashboard</span>
    </h1>
  );

  return (
    <header className="border-b border-app-line bg-app-surface/70 backdrop-blur-xl supports-[backdrop-filter]:bg-app-surface/60 px-3 py-3 sm:px-6 sm:py-4 flex justify-between items-center gap-3 sticky top-0 z-20 shadow-[0_1px_0_color-mix(in_srgb,var(--accent)_12%,transparent)]">
      <div className="flex items-center gap-2 min-w-0">
        {session?.user ? (
          <>
            {botonAjustes}
            {esInvitado && (
              <span className="text-xs bg-amber-500/10 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap">
                {t("header.invitado")}
              </span>
            )}
          </>
        ) : (
          logoApp
        )}
      </div>
      {session?.user && !esInvitado && (
        <p className="hidden md:block flex-1 text-center text-sm text-app-muted truncate px-2">
          {session.user.genero === "mujer" ? t("header.bienvenida") : t("header.bienvenido")},{" "}
          <strong className="text-app-fg">{session.user.name || session.user.email}</strong>
        </p>
      )}
      <div className="flex items-center gap-4">
        {session?.user ? (
          logoApp
        ) : (
          <div className="flex gap-2 shrink-0">
            <Link
              href="/login"
              className="btn-press text-sm bg-app-raised hover:opacity-90 text-app-fg px-4 py-2 rounded-full flex items-center gap-1.5 transition border border-app-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">{t("header.login")}</span>
            </Link>
            <Link
              href="/register"
              className="btn-press group text-sm bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] px-4 py-2 rounded-full flex items-center gap-2 transition shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--accent)_70%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            >
              <UserPlus size={16} />
              <span className="hidden sm:inline">{t("header.registro")}</span>
              <span aria-hidden="true" className="cta-icon hidden sm:grid">
                →
              </span>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
