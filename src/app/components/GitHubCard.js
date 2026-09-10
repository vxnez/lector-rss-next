// src/app/components/GitHubCard.js
"use client";

import { useState } from "react";
import { Github, X } from "lucide-react";

const CLAVE_OCULTA = "github_card_oculta";
const URL_REPOSITORIO = "https://github.com/vxnez/lector-rss-next";

export default function GitHubCard() {
  const [oculta, setOculta] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(CLAVE_OCULTA) === "1";
    } catch {
      return false;
    }
  });

  if (oculta) return null;

  const ocultar = () => {
    try {
      window.localStorage.setItem(CLAVE_OCULTA, "1");
    } catch {
      // Sin almacenamiento disponible: solo se oculta en esta vista.
    }
    setOculta(true);
  };

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
          <Github size={18} className="shrink-0" />
          RSS Dashboard
        </span>
        <span className="notibody">Código fuente del proyecto en GitHub</span>
      </a>
      <button
        type="button"
        onClick={ocultar}
        aria-label="Ocultar tarjeta de GitHub"
        title="Ocultar"
        className="github-float-close"
      >
        <X size={14} />
      </button>
    </div>
  );
}
