// src/lib/hooks/useIACategorizer.js
"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useIACategorizer({ session, recargarDatos, notify, t }) {
  // null = inactiva; { total, procesadas, pendientes, estado, diag }
  const [iaProgreso, setIaProgreso] = useState(null);
  const iaEnCursoRef = useRef(false);
  const iaAutoRef = useRef(null);

  const procesarColaClasificacion = useCallback(async () => {
    const excluidos = [];
    for (let intento = 0; intento < 12; intento++) {
      let restantes = 0;
      let loteNum = 0;
      let esperaMs = 250;
      try {
        const res = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clasificar_pendientes", lote: 24, excluir: excluidos }),
        });
        if (!res.ok) break;
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.ids)) {
          for (const id of data.ids) {
            if (!excluidos.includes(id)) excluidos.push(id);
          }
        }
        restantes = Number(data.restantes) || 0;
        loteNum = Number(data.lote) || 0;
        if (Number(data.reintentarEn) > 0) esperaMs = Number(data.reintentarEn) * 1000;
      } catch {
        break;
      }
      recargarDatos();
      if (restantes === 0 || loteNum === 0) break;
      await new Promise((resolve) => setTimeout(resolve, esperaMs));
    }
  }, [recargarDatos]);

  const handleCategorizarIA = useCallback(
    (opciones = {}) => {
      if (iaEnCursoRef.current) {
        if (opciones.silencioso) return;
        const pendientes = iaProgreso?.pendientes;
        notify(
          pendientes === null || pendientes === undefined
            ? t("avisos.ia_lanzada")
            : t("avisos.ia_en_curso", { n: pendientes }),
          "info"
        );
        return;
      }
      iaEnCursoRef.current = true;
      setIaProgreso({ total: null, procesadas: 0, pendientes: null, estado: "en_curso" });

      const pedirLote = async (excluir) => {
        const res = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clasificar_pendientes", lote: 24, excluir }),
        });
        if (!res.ok) throw new Error(t("avisos.ia_err"));
        const data = await res.json().catch(() => ({}));
        return {
          clasificados: Number(data.clasificados) || 0,
          restantes: Number(data.restantes) || 0,
          lote: Number(data.lote) || 0,
          ids: Array.isArray(data.ids) ? data.ids : [],
          esperaMs: Number(data.reintentarEn) > 0 ? Number(data.reintentarEn) * 1000 : 250,
          diag: typeof data.diag === "string" && data.diag ? data.diag : null,
        };
      };

      (async () => {
        let total = null;
        let procesadas = 0;
        let falloTransporte = false;
        let diagFinal = null;
        const excluidos = [];
        let rachaCuota = 0;
        try {
          for (let intento = 0; intento < 24; intento++) {
            let lote;
            try {
              lote = await pedirLote(excluidos);
            } catch {
              falloTransporte = true;
              break;
            }
            if (total === null) total = lote.clasificados + lote.restantes;
            procesadas += lote.clasificados;
            for (const id of lote.ids) {
              if (!excluidos.includes(id)) excluidos.push(id);
            }
            if (lote.diag && !diagFinal) diagFinal = lote.diag;
            if (
              (diagFinal === "auth" || diagFinal === "sin_clave" || diagFinal === "modelo") &&
              procesadas === 0
            ) {
              break;
            }
            if (lote.clasificados > 0 || lote.diag !== "cuota") {
              rachaCuota = 0;
            } else if (++rachaCuota >= 3) {
              break;
            }
            recargarDatos();
            if (lote.restantes === 0 || lote.lote === 0) break;
            const procesadasVista = total === null ? procesadas : Math.min(procesadas, total);
            setIaProgreso({ total, procesadas: procesadasVista, pendientes: lote.restantes, estado: "en_curso" });
            await new Promise((resolve) => setTimeout(resolve, lote.esperaMs));
          }
          if (procesadas > 0) {
            const totalVista = total ?? procesadas;
            setIaProgreso({ total: totalVista, procesadas: Math.min(procesadas, totalVista), pendientes: 0, estado: "ok" });
          } else if (falloTransporte && !diagFinal) {
            setIaProgreso({ total: null, procesadas: 0, pendientes: null, estado: "error", diag: null });
          } else if (diagFinal) {
            setIaProgreso({ total, procesadas: 0, pendientes: null, estado: "error", diag: diagFinal });
          } else {
            setIaProgreso({ total: total ?? 0, procesadas: 0, pendientes: 0, estado: "ok" });
          }
        } finally {
          iaEnCursoRef.current = false;
        }
      })().catch(() => {
        iaEnCursoRef.current = false;
        setIaProgreso({ total: null, procesadas: 0, pendientes: null, estado: "error", diag: null });
      });
    },
    [iaProgreso, notify, recargarDatos, t]
  );

  // Auto-categorización al iniciar sesión (una vez por cuenta)
  useEffect(() => {
    const clave = session?.user ? session.user.email || session.user.id : null;
    if (!clave || iaAutoRef.current === clave) return;
    iaAutoRef.current = clave;
    handleCategorizarIA({ silencioso: true });
  }, [session, handleCategorizarIA]);

  return {
    iaProgreso,
    setIaProgreso,
    handleCategorizarIA,
    procesarColaClasificacion,
  };
}
