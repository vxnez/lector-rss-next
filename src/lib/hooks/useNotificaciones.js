// src/lib/hooks/useNotificaciones.js — Bandeja central de notificaciones (solo cliente).
// Fuente de verdad para AppHeader (campanita + contador) y NotificationPanel
// (lista). Ingiere toasts y el progreso IA (pinned) y persiste en localStorage.
"use client";

import { useState, useEffect, useCallback } from "react";
import { useIdioma } from "@/lib/i18n";

const CLAVE_ABIERTA = "notification_panel_abierta";
const CLAVE_ITEMS = "notification_panel_items";
const MAX_ITEMS = 50;

export function useNotificaciones({ toast, onCerrarToast, iaProgreso }) {
  const { t } = useIdioma();
  const [items, setItems] = useState([]);
  const [abierta, setAbierta] = useState(false);

  const guardar = useCallback((nuevas) => {
    try {
      window.localStorage.setItem(CLAVE_ITEMS, JSON.stringify(nuevas.slice(0, MAX_ITEMS)));
    } catch {
      // Sin almacenamiento disponible.
    }
  }, []);

  // Hidratación inicial (lectura de localStorage solo en cliente).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      setAbierta(window.localStorage.getItem(CLAVE_ABIERTA) === "1");
      const guardados = JSON.parse(window.localStorage.getItem(CLAVE_ITEMS) || "[]");
      if (Array.isArray(guardados)) setItems(guardados);
    } catch {
      // Sin almacenamiento disponible.
    }
  }, []);

  // Toast -> notificación (evento externo -> bandeja).
  useEffect(() => {
    if (!toast) return;
    const nueva = {
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      tipo: toast.type === "error" ? "error" : "success",
      titulo: toast.type === "error" ? t("ajustes.notificaciones.error") : t("ajustes.notificaciones.exito"),
      mensaje: toast.message,
      fecha: Date.now(),
      leida: false,
      pinned: false,
    };
    setItems((prev) => {
      const actualizados = [nueva, ...prev].slice(0, MAX_ITEMS);
      guardar(actualizados);
      return actualizados;
    });
    onCerrarToast();
  }, [toast, t, onCerrarToast, guardar]);

  // IA Progress -> notificación pinned (índice calculado dentro del setter).
  useEffect(() => {
    if (!iaProgreso) return;

    const esError = iaProgreso.estado === "error";
    const esOk = iaProgreso.estado === "ok";
    const enCurso = iaProgreso.estado === "en_curso";

    const itemIA = {
      id: "ia_progress",
      tipo: "ia",
      titulo: esOk ? t("ia_bar.ok") : t("ia_bar.titulo"),
      mensaje: esError
        ? (iaProgreso.diag ? t(`avisos.ia_err_${iaProgreso.diag}`) : t("avisos.ia_err"))
        : esOk
        ? (iaProgreso.procesadas > 0 ? t("avisos.ia_ok", { n: iaProgreso.procesadas }) : t("avisos.ia_sin_pendientes"))
        : enCurso
        ? t("ia_bar.lanzando")
        : t("ia_bar.avance", {
            a: iaProgreso.procesadas || 0,
            total: iaProgreso.total || 0,
            p: iaProgreso.pendientes || 0
          }),
      fecha: Date.now(),
      leida: esOk || esError,
      pinned: true,
      progreso: iaProgreso,
    };

    setItems((prev) => {
      const idx = prev.findIndex((n) => n.pinned && n.tipo === "ia");
      let nuevos = [...prev];
      if (idx >= 0) {
        nuevos[idx] = itemIA;
      } else {
        nuevos = [itemIA, ...nuevos];
      }
      guardar(nuevos.slice(0, MAX_ITEMS));
      return nuevos;
    });
  }, [iaProgreso, t, guardar]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fijarAbierta = useCallback((valor) => {
    setAbierta(valor);
    try {
      window.localStorage.setItem(CLAVE_ABIERTA, valor ? "1" : "0");
    } catch {
      // Sin almacenamiento disponible.
    }
  }, []);

  const eliminarUna = useCallback((id) => {
    setItems((prev) => {
      const nuevos = prev.filter((n) => n.id !== id);
      guardar(nuevos);
      return nuevos;
    });
  }, [guardar]);

  const marcarLeida = useCallback((id) => {
    setItems((prev) => {
      const nuevos = prev.map((n) => (n.id === id ? { ...n, leida: true } : n));
      guardar(nuevos);
      return nuevos;
    });
  }, [guardar]);

  const marcarTodasLeidas = useCallback(() => {
    setItems((prev) => {
      const nuevos = prev.map((n) => ({ ...n, leida: true }));
      guardar(nuevos);
      return nuevos;
    });
  }, [guardar]);

  const eliminarSeleccionadas = useCallback((ids) => {
    setItems((prev) => {
      const nuevos = prev.filter((n) => !ids.has(n.id) || n.pinned);
      guardar(nuevos);
      return nuevos;
    });
  }, [guardar]);

  const noLeidas = items.filter((n) => !n.leida && !n.pinned).length;
  const iaEnCurso = iaProgreso?.estado === "en_curso";

  return {
    items,
    abierta,
    fijarAbierta,
    noLeidas,
    iaEnCurso,
    eliminarUna,
    marcarLeida,
    marcarTodasLeidas,
    eliminarSeleccionadas,
  };
}
