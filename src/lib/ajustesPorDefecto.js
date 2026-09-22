// src/lib/ajustesPorDefecto.js — Perfil limpio tras eliminar cuenta o re-registro.
// Las preferencias de lectura/apariencia viven en localStorage del navegador
// (no hay tabla de settings en servidor): si no se limpian al eliminar la
// cuenta, un re-registro en el mismo navegador hereda tamano de página,
// auto-marcado, movimiento, densidad, tema, fuente del lector, etc.
// Este módulo es la única fuente de verdad para "valores por defecto":
// restablecer = eliminar claves para que cada lector caiga a su default.
import { CLAVES_NOTIFICACIONES } from "@/lib/hooks/useNotificaciones";

export const AJUSTES_POR_DEFECTO = {
  lector_tema: null, // null = preferencia del sistema (ver temas.temaPreferidoSistema)
  lector_fuente_app: null, // null = Readex Pro (ver fuentes.FUENTE_POR_DEFECTO)
  lector_fuente_px: null, // null = 16 px base (ver fuentes.FUENTE_PX_DEFECTO)
  lector_familia_fuente: null, // legado del lector (botón Sans eliminado): se purga
  lector_tamano_fuente: null, // legado del lector (botones Normal/Grande/Extra): se purga
  lector_tamano_pagina: "30",
  lector_auto_leido: "0",
  lector_movimiento: "completo",
  lector_densidad: "comoda",
  lector_tamano_fuente: "normal",
  lector_imagen_oculta: "0",
};

// Claves de configuración de cuenta en localStorage (lectura/apariencia).
const CLAVES_AJUSTES = Object.keys(AJUSTES_POR_DEFECTO);

// Rastros de identidad/onboarding por email o invitado.
const PREFIJOS_RASTRO_CUENTA = ["welcome_seen_"];
const CLAVES_RASTRO_CUENTA = [
  "guest_has_seen_onboarding",
  "welcome_seen_invitado", // marca legacy, se honra en page.js
  "lector_recordar_correo", // login "recordarme": identificador residual
];

function clavesRastroCuenta() {
  const encontradas = [...CLAVES_RASTRO_CUENTA];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const clave = window.localStorage.key(i);
      if (clave && PREFIJOS_RASTRO_CUENTA.some((prefijo) => clave.startsWith(prefijo))) {
        encontradas.push(clave);
      }
    }
  } catch {
    // Sin almacenamiento: nada que enumerar.
  }
  return encontradas;
}

/**
 * Vuelve a los valores por defecto del sistema: elimina las claves de
 * lectura/apariencia para que cada lector use su default (tema del SO,
 * página 30, auto-leído off, movimiento completo, densidad cómoda...).
 */
export function restablecerAjustesLocales() {
  try {
    CLAVES_AJUSTES.forEach((clave) => window.localStorage.removeItem(clave));
    // Aviso de deslizamiento (sessionStorage de la pestaña): también se
    // reinicia para un perfil realmente limpio.
    window.sessionStorage.removeItem("lector_aviso_deslizar_vistas");
    window.sessionStorage.removeItem("lector_aviso_deslizar_ultimo_id");
  } catch {
    // Sin almacenamiento disponible: nada que restablecer.
  }
}

/**
 * Bandeja de notificaciones: vive en localStorage del navegador, así que al
 * eliminar la cuenta o salir hay que borrarla o los avisos viejos persisten
 * para la siguiente cuenta del mismo navegador.
 */
export function limpiarNotificacionesLocales() {
  try {
    CLAVES_NOTIFICACIONES.forEach((clave) => window.localStorage.removeItem(clave));
  } catch {
    // Sin almacenamiento disponible: nada que limpiar.
  }
}

/**
 * Limpieza total al eliminar la cuenta permanente: defaults + marcas de
 * bienvenida/onboarding del navegador + bandeja de notificaciones. Tras
 * esto, un re-registro con el mismo correo arranca con perfil
 * completamente limpio.
 */
export function limpiarRastrosCuenta() {
  restablecerAjustesLocales();
  limpiarNotificacionesLocales();
  try {
    clavesRastroCuenta().forEach((clave) => window.localStorage.removeItem(clave));
  } catch {
    // Sin almacenamiento disponible: nada que limpiar.
  }
}
