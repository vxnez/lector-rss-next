// src/lib/historialCapas.js — Capas (modales/paneles) como estados navegables.
// Cada capa abierta empuja una entrada al History API: el gesto/botón atrás
// del móvil cierra la capa superior en vez de expulsar al login de Google.
// Solo cliente ("use client" en quien lo importe); guarda SSR incluida.
import { useCallback, useEffect, useRef } from "react";

// Pila de capas abiertas (LIFO): [{ id, onCerrar }].
const pila = [];
let siguienteId = 1;
// Marca la navegación programada propia (cerrar por botón/Escape): su
// popstate se ignora para no cerrar la capa que quedó debajo.
let navegacionPropia = false;

function alAtras() {
  if (navegacionPropia) {
    navegacionPropia = false;
    return;
  }
  const cima = pila.pop();
  try {
    cima?.onCerrar?.();
  } catch {
    // El cierre nunca debe romper la navegación del navegador.
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", alAtras);
}

function registrarCapa(onCerrar) {
  const id = `capa_${siguienteId++}`;
  try {
    window.history.pushState({ capa: id }, "");
  } catch {
    // Sin History API disponible: la capa funciona sin entrada navegable.
  }
  pila.push({ id, onCerrar });
  return id;
}

function retirarCapa(id, onCerrar) {
  const indice = pila.findIndex((c) => c.id === id);
  if (indice >= 0) pila.splice(indice, 1);
  try {
    navegacionPropia = true;
    window.history.back();
  } catch {
    navegacionPropia = false;
  }
  try {
    onCerrar?.();
  } catch {
    // Sin acción pendiente.
  }
}

function desprenderCapa(id) {
  const indice = pila.findIndex((c) => c.id === id);
  if (indice >= 0) pila.splice(indice, 1);
}

// Sincroniza UNA capa con el historial. Devuelve `cerrar` envuelto: úsalo en
// TODAS las vías de cierre (botón X, overlay, Escape interno) para consumir
// su entrada. El atrás del sistema cierra solo vía popstate.
export function useCapaHistorial(abierto, onCerrar) {
  const idRef = useRef(null);
  const cerrarRef = useRef(onCerrar);

  useEffect(() => {
    cerrarRef.current = onCerrar;
  });

  useEffect(() => {
    if (!abierto) {
      idRef.current = null;
      return undefined;
    }
    const id = registrarCapa(() => cerrarRef.current?.());
    idRef.current = id;
    return () => {
      // Desmonte con la capa abierta: se retira del registro sin tocar el
      // historial (la entrada huérfana es inofensiva y rara).
      if (idRef.current === id) {
        desprenderCapa(id);
        idRef.current = null;
      }
    };
  }, [abierto]);

  return useCallback(() => {
    const id = idRef.current;
    idRef.current = null;
    if (id) retirarCapa(id, () => cerrarRef.current?.());
    else cerrarRef.current?.();
  }, []);
}
