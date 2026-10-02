// src/lib/historialCapas.js — Capas (modales/paneles) como estados navegables.
// Cada capa abierta empuja una entrada al History API: el gesto/botón atrás
// del móvil cierra la capa superior en vez de expulsar al login de Google.
// Solo cliente ("use client" en quien lo importe); guarda SSR incluida.
import { useCallback, useEffect, useRef } from "react";

// Pila de capas abiertas (LIFO): [{ id, onCerrar }]. El orden replica el
// del historial del navegador: cada registro nace con su pushState.
const pila = [];
let siguienteId = 1;

function alAtras(event) {
  const destino = event?.state;
  // 1. Reconciliación por destino: si aterrizamos en una entrada nuestra,
  //    las capas por encima se consumieron sin handler (doble atrás rápido,
  //    back() coalescido por el navegador). Se cierran en silencio para
  //    resincronizar la UI con el historial real. Sin banderas: no hay nada
  //    que se quede colgado y trague el siguiente gesto.
  if (destino && typeof destino === "object" && typeof destino.capa === "string") {
    const indice = pila.findIndex((c) => c.id === destino.capa);
    if (indice >= 0) {
      while (pila.length - 1 > indice) {
        const saltada = pila.pop();
        try {
          saltada?.onCerrar?.();
        } catch {
          // El cierre nunca rompe la navegación.
        }
      }
      return;
    }
  }
  // 2. Destino ajeno (entrada inicial, sitio externo): la cima ya no está en
  //    el historial; se cierra para no dejar la UI desincronizada.
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
  // Se retira ANTES de navegar: el popstate resultante aterriza en la
  // entrada de abajo y la reconciliación lo confirma sin cerrar de más.
  // Sin banderas globales.
  const indice = pila.findIndex((c) => c.id === id);
  if (indice >= 0) pila.splice(indice, 1);
  try {
    window.history.back();
  } catch {
    // Sin historial disponible: solo se cierra la UI.
  }
  // El cierre se difiere tras la navegación (siguiente tarea): el popstate
  // de ESTE back debe procesarse antes de que el render re-registre capas
  // (p. ej. la guardia de salida). Si el onCerrar corriera primero, el
  // evento aterrizaría sobre la entrada recién pusheada y reabriría la capa
  // en bucle. El orden tarea( popstate)→tarea( cierre) lo garantiza.
  window.setTimeout(() => {
    try {
      onCerrar?.();
    } catch {
      // Sin acción pendiente.
    }
  }, 0);
}

function desprenderCapa(id) {
  const indice = pila.findIndex((c) => c.id === id);
  if (indice >= 0) pila.splice(indice, 1);
}

// Sincroniza UNA capa con el historial. Devuelve `cerrar` envuelto: úsalo en
// TODAS las vías de cierre (botón X, overlay, Escape interno) para consumir
// su entrada. El cierre corre diferido tras la navegación para no reabrir en
// bucle; si la capa se reabrió en el intertanto, respeta la instancia nueva.
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
    // Si la capa se reabrió antes de que corra el cierre diferido, el
    // diferido la dejaría cerrada por error: solo cierra si sigue cerrada.
    if (id) retirarCapa(id, () => {
      if (idRef.current === null) cerrarRef.current?.();
    });
    else cerrarRef.current?.();
  }, []);
}
