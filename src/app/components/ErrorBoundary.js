// src/app/components/ErrorBoundary.js
// Contiene crashes de subárboles (p. ej. el lector cuando el traductor del
// navegador reestructura nodos del DOM que React gestiona) para que no tumben
// toda la página. Se resetea solo al cambiar `resetKey`.
"use client";

import { Component } from "react";
import { useIdioma } from "@/lib/i18n";

export function LectorErrorFallback({ onReset }) {
  const { t } = useIdioma();
  return (
    <div
      className="anim-modal bg-app-surface border border-app-line rounded-2xl w-full max-w-3xl shadow-2xl p-6 sm:p-8 text-center space-y-4"
      role="alert"
    >
      <p className="eyebrow mx-auto w-fit">{t("lector.error_eyebrow")}</p>
      <h2 className="text-lg sm:text-xl font-bold text-app-fg">{t("lector.error_titulo")}</h2>
      <p className="text-sm text-app-muted max-w-md mx-auto leading-relaxed">
        {t("lector.error_texto")}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="btn-press group inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90"
      >
        {t("lector.reintentar")}
        <span aria-hidden="true" className="cta-icon hidden sm:grid">
          →
        </span>
      </button>
    </div>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      console.error("Error contenido por ErrorBoundary:", error, info?.componentStack);
    } catch {
      // El logging nunca debe romper el fallback.
    }
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      const { fallback: Fallback, fallbackProps } = this.props;
      if (Fallback) {
        return (
          <Fallback
            {...fallbackProps}
            onReset={() => this.setState({ error: null })}
          />
        );
      }
      return null;
    }
    return this.props.children;
  }
}
