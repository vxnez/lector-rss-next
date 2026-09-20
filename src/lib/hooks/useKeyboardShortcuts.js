// src/lib/hooks/useKeyboardShortcuts.js
"use client";

import { useEffect, useRef } from "react";

export function useKeyboardShortcuts({
  articles = [],
  articuloActivoId,
  setArticuloActivoId,
  onAbrirArticulo,
  onToggleRead,
  onToggleSave,
  onDelete,
  onFocusSearch,
  onCambiarTab,
  onToggleAyuda,
  modalAbierto = false,
}) {
  const articulosRef = useRef(articles);
  const activoIdRef = useRef(articuloActivoId);
  const modalAbiertoRef = useRef(modalAbierto);

  useEffect(() => {
    articulosRef.current = articles;
  }, [articles]);

  useEffect(() => {
    activoIdRef.current = articuloActivoId;
  }, [articuloActivoId]);

  useEffect(() => {
    modalAbiertoRef.current = modalAbierto;
  }, [modalAbierto]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Si hay un modal abierto o el usuario escribe en un input/textarea, no interceptar
      if (modalAbiertoRef.current) return;
      const target = e.target;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // Si presiona Escape en un input, desenfocarlo
      if (e.key === "Escape") {
        if (isInput) {
          target.blur();
          return;
        }
        setArticuloActivoId(null);
        return;
      }

      if (isInput) return;

      const lista = articulosRef.current || [];
      if (lista.length === 0 && e.key !== "?" && e.key !== "/") return;

      const currentId = activoIdRef.current;
      const currentIndex = lista.findIndex((a) => a.id === currentId);

      // 1. Navegación J / Flecha Abajo (Siguiente)
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = currentIndex < lista.length - 1 ? currentIndex + 1 : 0;
        const nextArt = lista[nextIndex];
        if (nextArt) {
          setArticuloActivoId(nextArt.id);
          const el = document.getElementById(`noticia-${nextArt.id}`);
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        return;
      }

      // 2. Navegación K / Flecha Arriba (Anterior)
      if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : lista.length - 1;
        const prevArt = lista[prevIndex];
        if (prevArt) {
          setArticuloActivoId(prevArt.id);
          const el = document.getElementById(`noticia-${prevArt.id}`);
          el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        return;
      }

      // 3. Abrir lector: Enter u O
      if (e.key === "Enter" || e.key === "o" || e.key === "O") {
        if (currentIndex >= 0 && lista[currentIndex]) {
          e.preventDefault();
          onAbrirArticulo?.(lista[currentIndex]);
        }
        return;
      }

      // 4. Marcar como leído / no leído: M o R
      if (e.key === "m" || e.key === "M" || e.key === "r" || e.key === "R") {
        if (currentIndex >= 0 && lista[currentIndex]) {
          e.preventDefault();
          const art = lista[currentIndex];
          onToggleRead?.(art.id, Boolean(art.leido));
        }
        return;
      }

      // 5. Guardar / quitar favoritos: S
      if (e.key === "s" || e.key === "S") {
        if (currentIndex >= 0 && lista[currentIndex]) {
          e.preventDefault();
          const art = lista[currentIndex];
          onToggleSave?.(art.id, Boolean(art.guardado));
        }
        return;
      }

      // 6. Eliminar / descartar: X o Delete
      if (e.key === "x" || e.key === "X" || e.key === "Delete") {
        if (currentIndex >= 0 && lista[currentIndex]) {
          e.preventDefault();
          const art = lista[currentIndex];
          onDelete?.(art.id);
        }
        return;
      }

      // 7. Enfocar buscador: /
      if (e.key === "/") {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }

      // 8. Pestañas: 1, 2, 3
      if (e.key === "1") {
        e.preventDefault();
        onCambiarTab?.("todas");
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        onCambiarTab?.("leidas");
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        onCambiarTab?.("guardadas");
        return;
      }

      // 9. Ayuda de atajos: ?
      if (e.key === "?") {
        e.preventDefault();
        onToggleAyuda?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onAbrirArticulo,
    onCambiarTab,
    onDelete,
    onFocusSearch,
    onToggleAyuda,
    onToggleRead,
    onToggleSave,
    setArticuloActivoId,
  ]);
}
