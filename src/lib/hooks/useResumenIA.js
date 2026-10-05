// src/lib/hooks/useResumenIA.js — Resumen IA por artículo (viñetas).
// Lógica de fetch compartida entre el panel desktop y la sheet móvil:
// una sola inferencia por texto (el servidor cachea 24 h), estados
// cargando/ok/error con diag y reintento. Solo cliente.
"use client";

import { useCallback, useEffect, useState } from "react";
import { paramsAuthIA } from "@/lib/clavesIA";

export function useResumenIA(titulo, texto, activo) {
  const [estado, setEstado] = useState(() => (!texto ? "error" : "cargando"));
  const [puntos, setPuntos] = useState([]);
  const [diag, setDiag] = useState(() => (!texto ? "corto" : null));
  const [proveedor, setProveedor] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!activo || !texto) return undefined;
    const ctrl = new AbortController();
    const temporizador = setTimeout(() => ctrl.abort(), 30000);
    // Cadena .then (no setState síncrono en el cuerpo del efecto).
    fetch("/api/rss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resumir_articulo", titulo, resumen: texto, ...paramsAuthIA() }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (ctrl.signal.aborted) return;
        if (!res.ok) throw new Error(data?.error || "Error");
        if (Array.isArray(data?.puntos) && data.puntos.length > 0) {
          setPuntos(data.puntos);
          setProveedor(data.proveedor || "");
          setEstado("ok");
        } else {
          setDiag(data?.diag || "respuesta");
          setEstado("error");
        }
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setDiag("respuesta");
        setEstado("error");
      })
      .finally(() => clearTimeout(temporizador));
    return () => {
      clearTimeout(temporizador);
      ctrl.abort();
    };
  }, [activo, titulo, texto, intento]);

  const reintentar = useCallback(() => {
    setEstado("cargando");
    setDiag(null);
    setPuntos([]);
    setIntento((n) => n + 1);
  }, []);

  return { estado, puntos, diag, proveedor, reintentar };
}
