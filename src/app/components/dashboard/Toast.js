// src/app/components/dashboard/Toast.js — Aviso flotante que sigue al tema.
"use client";

export default function Toast({ toast }) {
  if (!toast) return null;
  const esError = toast.type === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl ${
        esError ? "toast-app-error" : "toast-app"
      }`}
    >
      {toast.message}
    </div>
  );
}
