// src/app/components/FuenteSelect.js
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

function dominioDe(urlFeed = "") {
  try {
    return new URL(urlFeed).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function IconoFuente({ fuente }) {
  const [fallo, setFallo] = useState(false);
  const dominio = dominioDe(fuente?.url_feed || "");
  if (!dominio || fallo) {
    return (
      <span
        aria-hidden="true"
        className="grid h-5 w-5 shrink-0 place-content-center rounded bg-gray-800 text-[10px] font-bold text-sky-400"
      >
        {(fuente?.nombre || "?").trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${dominio}&sz=64`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className="h-5 w-5 shrink-0 rounded object-contain"
    />
  );
}

export default function FuenteSelect({ fuentes = [], valor, onChange, buttonRef }) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarFuera = (event) => {
      if (contenedorRef.current && !contenedorRef.current.contains(event.target)) {
        setAbierto(false);
      }
    };
    const cerrarEscape = (event) => {
      if (event.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", cerrarFuera);
    document.addEventListener("keydown", cerrarEscape);
    return () => {
      document.removeEventListener("mousedown", cerrarFuera);
      document.removeEventListener("keydown", cerrarEscape);
    };
  }, [abierto]);

  const opciones = [{ id: "todas", nombre: "Todas las fuentes", url_feed: "" }, ...fuentes];
  const actual = opciones.find((opcion) => String(opcion.id) === String(valor)) || opciones[0];

  const elegir = (id) => {
    onChange(String(id));
    setAbierto(false);
  };

  return (
    <div ref={contenedorRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label="Fuente RSS"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-xs text-gray-200 transition hover:border-gray-700 focus:border-sky-600"
      >
        <IconoFuente fuente={actual} />
        <span className="min-w-0 flex-1 truncate text-left">{actual.nombre}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-500 transition-transform ${abierto ? "rotate-180" : ""}`}
        />
      </button>
      {abierto && (
        <div role="listbox" aria-label="Fuente RSS" className="fuente-menu absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto">
          {opciones.map((opcion) => {
            const seleccionada = String(opcion.id) === String(valor);
            return (
              <button
                key={opcion.id}
                type="button"
                role="option"
                aria-selected={seleccionada}
                onClick={() => elegir(opcion.id)}
                className={`value${seleccionada ? " seleccionada" : ""}`}
              >
                <IconoFuente fuente={opcion} />
                <span className="min-w-0 flex-1 truncate text-left">{opcion.nombre}</span>
                {seleccionada && <Check size={14} className="shrink-0 text-sky-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
