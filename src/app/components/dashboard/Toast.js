// src/app/components/dashboard/Toast.js — Aviso flotante que sigue al tema.
"use client";

import { useRef, useEffect } from "react";
import { animateToastIn, prefersReducedMotion } from "@/lib/gsap";

export default function Toast({ toast }) {
  const ref = useRef(null);

  useEffect(() => {
    if (toast && ref.current) {
      animateToastIn(ref.current);
    }
  }, [toast]);

  if (!toast) return null;
  const esError = toast.type === "error";
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      translate="no"
      className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl notranslate ${
        esError ? "toast-app-error" : "toast-app"
      }`}
    >
      {toast.message}
    </div>
  );
}
