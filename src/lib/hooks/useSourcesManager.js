// src/lib/hooks/useSourcesManager.js
"use client";

import { useState, useCallback, useEffect } from "react";
import { fetchJson, bumpCacheVersion } from "@/lib/fetchCache";

export function useSourcesManager(session) {
  const [sourcesList, setSourcesList] = useState([]);
  const [conteos, setConteos] = useState({ pendientes: 0, leidas: 0, guardadas: 0 });
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [nonceRecarga, setNonceRecarga] = useState(0);

  // Recarga estructural (mutación): invalida caché client-side y pide datos frescos.
  const recargarDatos = useCallback(() => {
    bumpCacheVersion();
    setNonceRecarga((n) => n + 1);
  }, []);

  const fetchSources = useCallback(async (signal) => {
    try {
      const data = await fetchJson("/api/sources", { ttlMs: 90000, signal });
      if (data) {
        const sourcesArr = Array.isArray(data) ? data : (data.sources || data.data || []);
        const formattedSources = sourcesArr.map((s) => ({
          id: s.id || s._id || s.fuente_id || s.url || s.nombre,
          nombre: s.nombre || s.name || s.titulo || s.domain || s.url || "Fuente sin nombre",
          url_feed: s.url_feed || s.url || "",
          categoria: s.categoria || "General",
          articulos_count: s.articulos_count || 0,
          ultima_actualizacion: s.ultima_actualizacion || null,
          estado: s.estado || "activa",
        }));
        setSourcesList(formattedSources);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error al obtener fuentes:", err);
      }
    }
  }, []);

  const fetchConteos = useCallback(async (signal) => {
    try {
      const data = await fetchJson("/api/rss?tipo=conteos", { signal });
      if (data) {
        setConteos({
          pendientes: Number(data.pendientes) || 0,
          leidas: Number(data.leidas) || 0,
          guardadas: Number(data.guardadas) || 0,
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error al obtener conteos:", err);
      }
    }
  }, []);

  // Al cambiar de cuenta se invalida la caché
  const idSesion = session?.user?.id;
  useEffect(() => {
    bumpCacheVersion();
  }, [idSesion]);

  // Cargar fuentes y conteos cuando hay sesión activa o cambia nonceRecarga
  useEffect(() => {
    if (!session?.user) return undefined;
    const controller = new AbortController();

    async function cargarMeta() {
      await Promise.all([
        fetchSources(controller.signal),
        fetchConteos(controller.signal),
      ]);
    }

    cargarMeta();
    return () => controller.abort();
  }, [session, fetchSources, fetchConteos, nonceRecarga]);

  return {
    sourcesList,
    setSourcesList,
    conteos,
    setConteos,
    categoriasDisponibles,
    setCategoriasDisponibles,
    nonceRecarga,
    recargarDatos,
    fetchSources,
    fetchConteos,
  };
}
