// src/app/auth/error/page.js — Página de error de autenticación propia.
// Sustituye la página genérica inglesa de NextAuth (/api/auth/error) por una
// tarjeta del sistema de diseño, en el idioma de la app y con reintento.
"use client";

import { useState } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { useIdioma } from "@/lib/i18n";

// Errores NextAuth con causa probablemente transitoria (reintentables).
const ERRORES_TRANSITORIOS = new Set([
  "OAuthCallback",
  "Callback",
  "OAuthSignin",
  "OAuthCreateAccount",
  "EmailCreateAccount",
  "SessionRequired",
  "Default",
]);

export default function PaginaErrorAuth() {
  const { t } = useIdioma();
  const [codigo] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("error") || "";
    } catch {
      return "";
    }
  });

  const mensaje = codigo === "AccessDenied"
    ? t("auth_error.denegado")
    : ERRORES_TRANSITORIOS.has(codigo)
      ? t("auth_error.transitorio")
      : t("auth_error.generico");

  return (
    <div className="auth-ambient min-h-screen flex items-center justify-center bg-app-bg text-app-fg p-4">
      <div className="bezel-outer w-full max-w-md stagger-in relative z-10">
        <div className="bezel-inner p-8 text-center space-y-4">
          <span className="mx-auto grid h-12 w-12 place-content-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400">
            <TriangleAlert size={22} />
          </span>
          <h1 className="text-balance text-2xl font-bold tracking-tighter text-app-fg">
            {t("auth_error.titulo")}
          </h1>
          <p className="text-pretty text-sm leading-relaxed text-app-muted">{mensaje}</p>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="btn-press inline-flex items-center justify-center rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90"
            >
              {t("auth_error.reintentar")}
            </Link>
            <Link
              href="/"
              className="btn-press inline-flex items-center justify-center rounded-full border border-app-line bg-app-surface px-5 py-2.5 text-sm font-medium text-app-fg hover:border-[var(--accent)]/60"
            >
              {t("auth_error.inicio")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
