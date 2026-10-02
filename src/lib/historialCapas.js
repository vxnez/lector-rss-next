// src/lib/historialCapas.js — Capas (modales/paneles) como estados navegables.
// Cada capa abierta empuja una entrada al History API: el gesto/botón atrás
// del móvil cierra la capa superior en vez de expulsar al login de Google.
// Solo cliente ("use client" en quien lo importe); guarda SSR incluida.
import { useCallback, useEffect, useRef } from "react";

// Pila de capas abiertas (LIFO): [{ id, onCerrar }]. El orden replica el
// del historial del navegador: cada registro nace con su pushState.
const pila = [];
let siguienteId = 1;

// Bandera atómica de procesamiento: el hilo JS no puede reentrar a un
// listener síncrono, pero si un refactor futuro awaitara dentro del handler,
// el evento solapado se reencola en vez de ejecutarse encima (nunca se
// pierde ni se duplica trabajo).
let procesandoAtras = false;

function alAtras(event) {
  if (procesandoAtras) {
    window.setTimeout(() => alAtras(event), 0);
    return;
  }
  procesandoAtras = true;
  try {
    manejarAtras(event);
  } finally {
    procesandoAtras = false;
  }
}

function manejarAtras(event) {
  const destino = event?.state;
  // 1. Reconciliación por destino: si aterrizamos en una entrada nuestra,
  //    las capas por encima se consumieron sin handler (doble atrás rápido,
  //    back() coalescido por el navegador). Se cierran en silencio para
  //    resincronizar la UI con el historial real. Sin banderas: no hay nada
  //    que se quede colgado y trague el siguiente gesto.
  if (destino && typeof destino === "object" && typeof destino.capa === "string") {
    const indice = pila.findIndex((c) => c.id === destino.capa);
    if (indice >= 0) {
      // Drenar PRIMERO y notificar DESPUÉS: los onCerrar pueden re-registrar
      // (la guardia rearma su centinela) y hacerlo dentro del while sería un
      // livelock — cada push revalida la condición y el hilo no sale nunca.
      const caidas = [];
      while (pila.length - 1 > indice) {
        caidas.push(pila.pop());
      }
      for (const caida of caidas) {
        try {
          caida?.onCerrar?.();
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

// Exportación solo para pruebas de lógica (verificar-historial.cjs): expone
// el registro y el manejador tal cual se embarcan, sin duplicar código.
export const __historialTest = { pila, registrarCapa, retirarCapa, manejarAtras };

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

  return useCallback((alAbrir) => {
    const id = idRef.current;
    idRef.current = null;
    // Si la capa se reabrió antes de que corra el cierre diferido, el
    // diferido la dejaría cerrada por error: solo cierra si sigue cerrada.
    // `alAbrir` (p. ej. Ajustes → Perfil) corre AQUÍ, tras el popstate del
    // cierre: si abriera antes, la reconciliación vería su entrada como
    // "saltada" y la mataría al instante (modal que parpadea y muere).
    const hacer = () => {
      cerrarRef.current?.();
      alAbrir?.();
    };
    if (id) retirarCapa(id, () => {
      if (idRef.current === null) hacer();
    });
    else hacer();
  }, []);
}

// Guardia persistente del feed: mantiene SIEMPRE un centinela DOBLE sobre la
// página (búfer + centinela). Al consumirse el centinela se rearma EN LA MISMA
// tarea del popstate y abre el diálogo: entre un gesto y el siguiente nunca
// hay ventana sin centinela, así que ningún atrás puede expulsar a login.
// Además el atrás nunca abandona el documento (aterriza en el búfer propio):
// cero parpadeos de la pantalla de login. El diálogo, al abrirse, apila su
// propia capa encima (ciclo feed→diálogo→feed). Solo se desarma sin sesión.
// `hayBloqueo` (opcional): si al consumirse hay una capa abierta por encima
// (registro invertido en el mismo commit), se rearma sin abrir el diálogo.
export function useCapaGuardia(activa, onAbrir, hayBloqueo) {
  const idRef = useRef(null);
  const bufRef = useRef(null);
  const abrirRef = useRef(onAbrir);
  const bloqueoRef = useRef(hayBloqueo);

  useEffect(() => {
    abrirRef.current = onAbrir;
    bloqueoRef.current = hayBloqueo;
  });

  useEffect(() => {
    if (!activa) {
      idRef.current = null;
      bufRef.current = null;
      return undefined;
    }
    // Búfer (una sola vez): el suelo sobre el que siempre cae el atrás.
    // Su registro es mudo: la reconciliación lo usa solo como ancla.
    if (!bufRef.current) {
      bufRef.current = registrarCapa(() => {});
    }
    const armar = () => {
      const id = registrarCapa(() => {
        // Registro viejo (p. ej. tras fin de sesión): ignorar.
        if (idRef.current !== id) return;
        // Rearme síncrono en el popstate.
        idRef.current = armar();
        if (!bloqueoRef.current?.()) abrirRef.current?.();
      });
      return id;
    };
    idRef.current = armar();
    return () => {
      // Desarme (fin de sesión): se retira del registro sin navegar; las
      // entradas huérfanas las absorbe la reconciliación al volver atrás.
      if (idRef.current) {
        desprenderCapa(idRef.current);
        idRef.current = null;
      }
      if (bufRef.current) {
        desprenderCapa(bufRef.current);
        bufRef.current = null;
      }
    };
  }, [activa]);
}
