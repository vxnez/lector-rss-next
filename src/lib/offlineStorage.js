// src/lib/offlineStorage.js — Almacenamiento Offline en IndexedDB para noticias guardadas.
// Permite leer las noticias guardadas incluso si el usuario pierde la conexión (avión, metro, sin red).
"use client";

const DB_NAME = "lector_rss_offline";
const DB_VERSION = 1;
const STORE_GUARDADAS = "articulos_guardados";

function abrirDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_GUARDADAS)) {
        db.createObjectStore(STORE_GUARDADAS, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Guarda o actualiza un lote de artículos en IndexedDB
 */
export async function sincronizarArticulosOffline(articulos = []) {
  try {
    const db = await abrirDB();
    if (!db || !Array.isArray(articulos) || articulos.length === 0) return;

    const tx = db.transaction(STORE_GUARDADAS, "readwrite");
    const store = tx.objectStore(STORE_GUARDADAS);

    for (const art of articulos) {
      if (art && art.id) {
        store.put(art);
      }
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("No se pudo sincronizar en IndexedDB:", err);
    return false;
  }
}

/**
 * Obtiene todos los artículos guardados disponibles offline
 */
export async function obtenerArticulosOffline() {
  try {
    const db = await abrirDB();
    if (!db) return [];

    const tx = db.transaction(STORE_GUARDADAS, "readonly");
    const store = tx.objectStore(STORE_GUARDADAS);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const resultado = request.result || [];
        // Orden cronológico por defecto (más recientes primero)
        resultado.sort((a, b) => {
          const fA = new Date(a.fecha_publicacion || 0).getTime();
          const fB = new Date(b.fecha_publicacion || 0).getTime();
          return fB - fA;
        });
        resolve(resultado);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn("No se pudieron leer artículos de IndexedDB:", err);
    return [];
  }
}

/**
 * Elimina un artículo específico de IndexedDB
 */
export async function eliminarArticuloOffline(id) {
  try {
    const db = await abrirDB();
    if (!db) return;

    const tx = db.transaction(STORE_GUARDADAS, "readwrite");
    const store = tx.objectStore(STORE_GUARDADAS);
    store.delete(id);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Error eliminando artículo de IndexedDB:", err);
  }
}

/**
 * Limpia todos los artículos offline
 */
export async function limpiarArticulosOffline() {
  try {
    const db = await abrirDB();
    if (!db) return;

    const tx = db.transaction(STORE_GUARDADAS, "readwrite");
    const store = tx.objectStore(STORE_GUARDADAS);
    store.clear();

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Error limpiando almacén de IndexedDB:", err);
  }
}
