// src/lib/lectura.js — Utilidades del lector de noticias (cliente y servidor).

// Minutos estimados de lectura a ~200 palabras por minuto (mínimo 1).
export function tiempoLecturaMinutos(...textos) {
  const palabras = textos
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 200));
}
