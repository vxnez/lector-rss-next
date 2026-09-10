// src/app/components/GitHubCard.js
"use client";

import { useState } from "react";
import { Minus } from "lucide-react";

const CLAVE_MINIMIZADA = "github_card_min";
const URL_REPOSITORIO = "https://github.com/vxnez/lector-rss-next";

function GitHubIcon({ size = 18, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export default function GitHubCard() {
  const [minimizada, setMinimizada] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(CLAVE_MINIMIZADA) === "1";
    } catch {
      return false;
    }
  });

  const guardar = (valor) => {
    setMinimizada(valor);
    try {
      window.localStorage.setItem(CLAVE_MINIMIZADA, valor ? "1" : "0");
    } catch {
      // Sin almacenamiento disponible: solo cambia en esta vista.
    }
  };

  if (minimizada) {
    return (
      <button
        type="button"
        onClick={() => guardar(false)}
        title="Mostrar tarjeta de GitHub"
        aria-label="Mostrar tarjeta de GitHub"
        className="github-float-min fixed right-0 bottom-5 z-40 h-28 w-2.5 rounded-l-md"
      />
    );
  }

  return (
    <div className="github-float fixed bottom-5 right-5 z-40">
      <a
        href={URL_REPOSITORIO}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Abrir el repositorio RSS Dashboard en GitHub"
        className="github-float-link"
      >
        <span className="notiglow" aria-hidden="true" />
        <span className="notiborderglow" aria-hidden="true" />
        <span className="notititle">
          <GitHubIcon size={18} className="shrink-0" />
          RSS Dashboard
        </span>
        <span className="notibody">Código fuente del proyecto en GitHub</span>
      </a>
      <button
        type="button"
        onClick={() => guardar(true)}
        aria-label="Minimizar tarjeta de GitHub"
        title="Minimizar"
        className="github-float-close"
      >
        <Minus size={14} />
      </button>
    </div>
  );
}
