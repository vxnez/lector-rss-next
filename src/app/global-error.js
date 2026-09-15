// src/app/global-error.js
// Última red de seguridad: si un error no capturado tumba el árbol (p. ej.
// el traductor del navegador corrompe nodos del DOM durante una navegación),
// muestra recuperación real en vez de una página muerta.
// Reemplaza html/body, así que usa estilos propios sin depender del layout.
"use client";

import { useRouter } from "next/navigation";

export default function GlobalError({ error, reset }) {
  const router = useRouter();
  const mensaje =
    error?.message && typeof error.message === "string"
      ? error.message
      : "Error inesperado al cargar la vista.";

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070b12",
          color: "#e7edf5",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "1rem",
        }}
      >
        <div
          role="alert"
          style={{
            width: "100%",
            maxWidth: "28rem",
            background: "#0d1420",
            border: "1px solid #243247",
            borderRadius: "1rem",
            padding: "2rem",
            textAlign: "center",
            boxShadow: "0 24px 64px -24px rgba(0,0,0,0.7)",
          }}
        >
          <p
            style={{
              display: "inline-block",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#9fdcfc",
              border: "1px solid rgba(39,169,232,0.45)",
              background: "rgba(39,169,232,0.12)",
              borderRadius: "9999px",
              padding: "0.25rem 0.75rem",
              margin: "0 0 1rem",
            }}
          >
            RSS Dashboard
          </p>
          <h1 style={{ fontSize: "1.25rem", margin: "0 0 0.5rem" }}>
            Algo falló al cargar esta vista
          </h1>
          <p style={{ fontSize: "0.85rem", color: "#91a0b5", lineHeight: 1.6 }}>
            Si estabas usando el traductor del navegador entre noticias, prueba
            recargar: la vista se restaura sin perder tu sesión.
          </p>
          <p
            style={{
              fontSize: "0.72rem",
              color: "#5b6b82",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {mensaje}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
              marginTop: "1.25rem",
            }}
          >
            <button
              type="button"
              onClick={() => {
                router.push("/");
              }}
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "0.75rem",
                border: "1px solid #243247",
                background: "#121c2b",
                color: "#e7edf5",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Volver al inicio
            </button>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "0.65rem 1rem",
                borderRadius: "0.75rem",
                border: "none",
                background: "#0ea5e9",
                color: "#030712",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Recargar vista
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
