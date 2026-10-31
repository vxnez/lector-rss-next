// src/lib/gsap.js — Utilidades de animación GSAP para el dashboard.
// Solo cliente: nunca importar desde Server Components.
// Respeta prefers-reduced-motion y los tokens de tema.
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

// Curvas del sistema (emilkowalski): ease-out fuerte para entradas,
// drawer iOS para paneles.
export const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
export const EASE_DRAWER = "cubic-bezier(0.32, 0.72, 0, 1)";

// Duraciones por tipo de elemento (ms → s para GSAP).
export const DURATION = {
  button: 0.16,
  tooltip: 0.15,
  dropdown: 0.2,
  modal: 0.28,
  toast: 0.4,
  drawer: 0.35,
};

// Verifica si el usuario prefiere movimiento reducido.
export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Hook para animar entrada de un elemento con GSAP.
// Usa transform/opacity (GPU) — nunca layout properties.
export function useGsapEnter(ref, options = {}) {
  const {
    from = { opacity: 0, y: 12, scale: 0.98 },
    to = { opacity: 1, y: 0, scale: 1 },
    duration = DURATION.modal,
    ease = EASE_OUT,
    delay = 0,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled || !ref.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, from, {
        ...to,
        duration,
        ease,
        delay,
        clearProps: "all",
      });
    });
    return () => ctx.revert();
  }, [ref, enabled, from, to, duration, ease, delay]);
}

// Hook para animar lista con stagger (escalón entre items).
export function useGsapStagger(containerRef, selector = "> *", options = {}) {
  const {
    from = { opacity: 0, y: 8 },
    to = { opacity: 1, y: 0 },
    duration = 0.3,
    ease = EASE_OUT,
    stagger = 0.05,
    delay = 0,
    enabled = true,
  } = options;

  useEffect(() => {
    if (!enabled || !containerRef.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current.querySelectorAll(selector),
        from,
        {
          ...to,
          duration,
          ease,
          stagger,
          delay,
          clearProps: "all",
        }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [containerRef, selector, enabled, from, to, duration, ease, stagger, delay]);
}

// Hook para animar salida (fade-out + scale-down).
export function useGsapExit(ref, trigger, options = {}) {
  const {
    to = { opacity: 0, scale: 0.95, y: 8 },
    duration = DURATION.modal,
    ease = EASE_OUT,
  } = options;

  useEffect(() => {
    if (!trigger || !ref.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.to(ref.current, {
        ...to,
        duration,
        ease,
        clearProps: "all",
      });
    });
    return () => ctx.revert();
  }, [ref, trigger, to, duration, ease]);
}

// Animación de presión para botones (scale 0.97 en :active).
export function useGsapPress(ref) {
  useEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const el = ref.current;
    const onDown = () => gsap.to(el, { scale: 0.97, duration: DURATION.button, ease: EASE_OUT });
    const onUp = () => gsap.to(el, { scale: 1, duration: DURATION.button, ease: EASE_OUT });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerleave", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerleave", onUp);
    };
  }, [ref]);
}

// Animación de entrada de modal (scale 0.95 → 1 + blur).
export function animateModalIn(element) {
  if (!element || prefersReducedMotion()) return;
  gsap.fromTo(
    element,
    { opacity: 0, y: 10, scale: 0.95, filter: "blur(4px)" },
    { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: DURATION.modal, ease: EASE_OUT, clearProps: "all" }
  );
}

// Animación de salida de modal.
export function animateModalOut(element, onComplete) {
  if (!element || prefersReducedMotion()) {
    onComplete?.();
    return;
  }
  gsap.to(element, {
    opacity: 0,
    y: 10,
    scale: 0.95,
    filter: "blur(4px)",
    duration: DURATION.modal,
    ease: EASE_OUT,
    clearProps: "all",
    onComplete,
  });
}

// Animación de toast (entrada desde abajo-derecha).
export function animateToastIn(element) {
  if (!element || prefersReducedMotion()) return;
  gsap.fromTo(
    element,
    { opacity: 0, y: 12, scale: 0.97, filter: "blur(3px)" },
    { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: DURATION.toast, ease: EASE_OUT, clearProps: "all" }
  );
}

// Animación de lista con stagger (escalón entre items).
export function animateStagger(container, selector = "> *", options = {}) {
  if (!container || prefersReducedMotion()) return;
  const { duration = 0.3, stagger = 0.05, y = 8 } = options;
  gsap.fromTo(
    container.querySelectorAll(selector),
    { opacity: 0, y },
    { opacity: 1, y: 0, duration, ease: EASE_OUT, stagger, clearProps: "all" }
  );
}

// Animación de contador numérico (para stats).
export function animateCounter(element, from, to, duration = 0.6) {
  if (!element || prefersReducedMotion()) {
    element.textContent = to;
    return;
  }
  const obj = { val: from };
  gsap.to(obj, {
    val: to,
    duration,
    ease: EASE_OUT,
    onUpdate: () => {
      element.textContent = Math.round(obj.val);
    },
  });
}