// src/lib/hooks/useFeedState.js
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { paramsFeed } from "@/lib/feed-utils";
import { fetchJson, leerCache, prefetchJson, bumpCacheVersion } from "@/lib/fetchCache";
import {
  sincronizarArticulosOffline,
  obtenerArticulosOffline,
  eliminarArticuloOffline,
} from "@/lib/offlineStorage";

export function useFeedState({
  session,
  fuentesDisponibles,
  categoriasDisponibles,
  setCategoriasDisponibles,
  nonceRecarga,
  recargarDatos,
  fetchConteos,
  notify,
  t,
}) {
  const [activeTab, setActiveTab] = useState("todas");
  const [orden, setOrden] = useState("recientes");
  const [filtroIA, setFiltroIA] = useState("todas");
  const [pagina, setPagina] = useState(1);
  const [tamanoPagina, setTamanoPagina] = useState(() => {
    try {
      const pag = Number(window.localStorage.getItem("lector_tamano_pagina"));
      return [15, 30, 60].includes(pag) ? pag : 30;
    } catch {
      return 30;
    }
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const busquedaRef = useRef("");

  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [fuentesSeleccionadas, setFuentesSeleccionadas] = useState([]);

  const [articulos, setArticulos] = useState([]);
  const [totalNoticias, setTotalNoticias] = useState(0);
  const [cargandoFeed, setCargandoFeed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const claveFeedActualRef = useRef("");

  // Debounce de búsqueda: 400ms
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      if (busquedaRef.current !== searchQuery) {
        busquedaRef.current = searchQuery;
        setPagina(1);
        setBusquedaAplicada(searchQuery);
      }
    }, 400);
    return () => window.clearTimeout(temporizador);
  }, [searchQuery]);

  // Carga del feed paginado con SWR y prefetch
  useEffect(() => {
    if (!session?.user) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    let idleId = null;

    const cancelarIdle = () => {
      try {
        if (idleId === null || typeof window === "undefined") return;
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
        else window.clearTimeout(idleId);
      } catch {
        // Sin API idle
      } finally {
        idleId = null;
      }
    };

    async function cargarFeed() {
      const feedParams = paramsFeed({
        page: pagina,
        limit: tamanoPagina,
        tab: activeTab,
        orden,
        q: busquedaAplicada,
        categorias: categoriasSeleccionadas,
        fuentes: fuentesSeleccionadas,
        ia: filtroIA,
      });
      const urlFeed = `/api/rss?${feedParams}`;
      const facetaParams = new URLSearchParams({ tipo: "facetas", tab: activeTab });
      if (busquedaAplicada.trim()) facetaParams.set("q", busquedaAplicada.trim());
      if (fuentesSeleccionadas.length > 0) facetaParams.set("fuentes", fuentesSeleccionadas.join(","));
      if (filtroIA === "con_ia" || filtroIA === "sin_ia") facetaParams.set("ia", filtroIA);
      const urlFacetas = `/api/rss?${facetaParams}`;
      claveFeedActualRef.current = urlFeed;

      const instantanea = leerCache(urlFeed);
      if (instantanea) {
        const arts = Array.isArray(instantanea) ? instantanea : instantanea.articles || [];
        setArticulos(arts);
        setTotalNoticias(Array.isArray(instantanea) ? arts.length : Number(instantanea.total) || 0);
        setLastUpdated(new Date());
      }
      setCargandoFeed(!instantanea);

      try {
        const [data, facetas] = await Promise.all([
          fetchJson(urlFeed, { ttlMs: 30000, signal }),
          fetchJson(urlFacetas, { ttlMs: 60000, signal }),
        ]);
        if (signal.aborted || claveFeedActualRef.current !== urlFeed) return;

        if (data) {
          const articles = Array.isArray(data) ? data : data.articles || [];
          const total = Array.isArray(data) ? articles.length : Number(data.total) || 0;
          setArticulos(articles);
          setTotalNoticias(total);

          // Sincronizar artículos guardados con IndexedDB para disponibilidad offline
          if (activeTab === "guardadas") {
            sincronizarArticulosOffline(articles);
          } else {
            const guardados = articles.filter((a) => Boolean(a.guardado));
            if (guardados.length > 0) sincronizarArticulosOffline(guardados);
          }

          if (!Array.isArray(data) && articles.length === 0 && total > 0 && pagina > 1) {
            setPagina((p) => Math.max(p - 1, 1));
          }
          setLastUpdated(new Date());

          // Prefetch páginas vecinas
          const totalPags = Math.max(Math.ceil(total / tamanoPagina), 1);
          const armarParams = (paginaObjetivo) =>
            paramsFeed({
              page: paginaObjetivo,
              limit: tamanoPagina,
              tab: activeTab,
              orden,
              q: busquedaAplicada,
              categorias: categoriasSeleccionadas,
              fuentes: fuentesSeleccionadas,
              ia: filtroIA,
            });

          for (const vecina of [pagina - 1, pagina + 1]) {
            if (vecina < 1 || vecina > totalPags) continue;
            prefetchJson(`/api/rss?${armarParams(vecina)}`, { ttlMs: 30000 });
          }

          // Precarga en tiempo ocioso (+2/+3)
          const profundas = [pagina + 2, pagina + 3].filter((p) => p >= 1 && p <= totalPags);
          if (profundas.length > 0 && typeof window !== "undefined") {
            const vista = urlFeed;
            const correrCadena = () => {
              (async () => {
                for (const profunda of profundas) {
                  if (signal.aborted || claveFeedActualRef.current !== vista) return;
                  await prefetchJson(`/api/rss?${armarParams(profunda)}`, { ttlMs: 30000 });
                }
              })().catch(() => {});
            };
            try {
              idleId = window.requestIdleCallback
                ? window.requestIdleCallback(correrCadena, { timeout: 4000 })
                : window.setTimeout(correrCadena, 1200);
            } catch {
              // Sin temporizadores
            }
          }
        }

        if (facetas && setCategoriasDisponibles) {
          const lista = (Array.isArray(facetas) ? facetas : [])
            .map((f) => f.categoria)
            .filter(Boolean);
          setCategoriasDisponibles(lista);

          const disponibles = new Set(lista);
          setCategoriasSeleccionadas((actuales) => {
            if (actuales.length === 0) return actuales;
            const vigentes = actuales.filter((categoria) => disponibles.has(categoria));
            return vigentes.length === actuales.length ? actuales : vigentes;
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error al cargar feed:", err);
          // Fallback offline para artículos guardados
          if (activeTab === "guardadas") {
            try {
              const offlineArts = await obtenerArticulosOffline();
              if (offlineArts && offlineArts.length > 0) {
                setArticulos(offlineArts);
                setTotalNoticias(offlineArts.length);
                setLastUpdated(new Date());
              }
            } catch {
              // Sin IndexedDB
            }
          }
        }
      } finally {
        if (!signal.aborted) setCargandoFeed(false);
      }
    }

    cargarFeed();
    return () => {
      cancelarIdle();
      controller.abort();
    };
  }, [
    session,
    pagina,
    tamanoPagina,
    activeTab,
    orden,
    busquedaAplicada,
    categoriasSeleccionadas,
    fuentesSeleccionadas,
    filtroIA,
    nonceRecarga,
    setCategoriasDisponibles,
  ]);

  // Manejadores de navegación y filtros
  const seleccionarTab = useCallback((tab) => {
    setActiveTab(tab);
    setCategoriasSeleccionadas([]);
    setPagina(1);
  }, []);

  const cambiarOrden = useCallback((valor) => {
    setOrden(valor);
    setPagina(1);
  }, []);

  const cambiarFiltroIA = useCallback((valor) => {
    setFiltroIA(valor === "con_ia" || valor === "sin_ia" ? valor : "todas");
    setPagina(1);
  }, []);

  const cambiarPagina = useCallback((nueva) => {
    setPagina(nueva);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const alternarCategoria = useCallback((categoria) => {
    setCategoriasSeleccionadas((actuales) =>
      actuales.includes(categoria)
        ? actuales.filter((actual) => actual !== categoria)
        : [...actuales, categoria]
    );
    setPagina(1);
  }, []);

  const alternarFuente = useCallback((fuenteId) => {
    const id = String(fuenteId);
    setFuentesSeleccionadas((actuales) =>
      actuales.includes(id) ? actuales.filter((actual) => actual !== id) : [...actuales, id]
    );
    setPagina(1);
  }, []);

  const seleccionarTodasFuentes = useCallback(
    (valor) => {
      setFuentesSeleccionadas(valor ? fuentesDisponibles.map((f) => String(f.id)) : []);
      setPagina(1);
    },
    [fuentesDisponibles]
  );

  const seleccionarTodasCategorias = useCallback(
    (valor) => {
      setCategoriasSeleccionadas(valor ? [...categoriasDisponibles] : []);
      setPagina(1);
    },
    [categoriasDisponibles]
  );

  const limpiarFiltros = useCallback(() => {
    setSearchQuery("");
    setBusquedaAplicada("");
    busquedaRef.current = "";
    setCategoriasSeleccionadas([]);
    setFuentesSeleccionadas([]);
    setFiltroIA("todas");
    setPagina(1);
  }, []);

  const cambiarTamanoPagina = useCallback((n) => {
    try {
      window.localStorage.setItem("lector_tamano_pagina", String(n));
    } catch {
      // Sin localStorage
    }
    setTamanoPagina(n);
    setPagina(1);
  }, []);

  // Mutaciones de artículos (Optimistic UI)
  const toggleLeido = useCallback(
    async (id, leidoActual) => {
      const leidoNuevo = !leidoActual;
      setArticulos((prev) =>
        prev.map((art) => (art.id === id ? { ...art, leido: leidoNuevo } : art))
      );

      try {
        const res = await fetch("/api/rss", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, leido: leidoNuevo }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo actualizar el estado de lectura.");
        }
        recargarDatos();
        fetchConteos();
        return true;
      } catch {
        setArticulos((prev) =>
          prev.map((art) => (art.id === id ? { ...art, leido: leidoActual } : art))
        );
        return false;
      }
    },
    [fetchConteos, recargarDatos]
  );

  const toggleGuardado = useCallback(
    async (id, guardadoActual) => {
      const guardadoNuevo = !guardadoActual;
      const indiceRespaldo = articulos.findIndex((a) => a.id === id);
      const respaldo = indiceRespaldo >= 0 ? articulos[indiceRespaldo] : null;
      setArticulos((prev) =>
        prev.map((art) => (art.id === id ? { ...art, guardado: guardadoNuevo } : art))
      );

      // Sincronización optimista en IndexedDB
      if (guardadoNuevo) {
        const artObj = articulos.find((a) => a.id === id);
        if (artObj) sincronizarArticulosOffline([{ ...artObj, guardado: 1 }]);
      } else {
        eliminarArticuloOffline(id);
      }

      try {
        const res = await fetch("/api/rss", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, guardado: guardadoNuevo }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo actualizar el estado guardado.");
        }
        // NO refetchear la lista actual o pisaría la marca optimista: se
        // excluye en vista local según pestaña. Pero SÍ se invalida la caché
        // en memoria (bump): sin esto, al cambiar de pestaña se repinta el
        // snapshot viejo y el TTL de 30s sirve respuestas obsoletas, de modo
        // que el item no aparece en Leídas/Guardadas hasta recargar el
        // navegador. El bump no dispara refetch por sí solo (sin cambio de
        // nonce), así que el optimismo local se conserva y la próxima
        // pestaña ya pide datos frescos al backend.
        bumpCacheVersion();
        if (guardadoNuevo && activeTab !== "guardadas") {
          setArticulos((prev) => prev.filter((art) => art.id !== id));
          setTotalNoticias((prev) => Math.max((Number(prev) || 1) - 1, 0));
        } else if (!guardadoNuevo && activeTab === "guardadas") {
          setArticulos((prev) => prev.filter((art) => art.id !== id));
          setTotalNoticias((prev) => Math.max((Number(prev) || 1) - 1, 0));
        }
        fetchConteos();
        return true;
      } catch {
        // Revertir en memoria e IndexedDB
        if (guardadoNuevo) {
          eliminarArticuloOffline(id);
        } else {
          const artObj = articulos.find((a) => a.id === id);
          if (artObj) sincronizarArticulosOffline([{ ...artObj, guardado: 1 }]);
        }
        if (respaldo) {
          setArticulos((prev) => {
            const sin = prev.filter((art) => art.id !== id);
            sin.splice(Math.min(Math.max(indiceRespaldo, 0), sin.length), 0, respaldo);
            return sin;
          });
        } else {
          setArticulos((prev) =>
            prev.map((art) => (art.id === id ? { ...art, guardado: guardadoActual } : art))
          );
        }
        recargarDatos();
        fetchConteos();
        return false;
      }
    },
    [activeTab, articulos, fetchConteos, recargarDatos]
  );

  const actualizarCategoria = useCallback(
    async (id, categoria) => {
      const articuloCopia = articulos.find((art) => art.id === id);
      setArticulos((prev) =>
        prev.map((art) =>
          art.id === id
            ? { ...art, categoria, clasificacion_metodo: "manual", clasificacion_confianza: 1 }
            : art
        )
      );

      try {
        const res = await fetch("/api/rss", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, categoria }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "No se pudo actualizar la categoría.");
        }
        recargarDatos();
        return true;
      } catch {
        if (articuloCopia) {
          setArticulos((prev) => prev.map((art) => (art.id === id ? articuloCopia : art)));
        }
        return false;
      }
    },
    [articulos, recargarDatos]
  );

  const descartarArticulo = useCallback(
    async (id) => {
      eliminarArticuloOffline(id);
      const articuloCopia = articulos.find((art) => art.id === id);
      setArticulos((prev) => prev.filter((art) => art.id !== id));

      try {
        const res = await fetch(`/api/rss?id=${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(t("avisos.eliminar_feed"));
        recargarDatos();
        fetchConteos();
      } catch {
        if (articuloCopia) {
          setArticulos((prev) => [...prev, articuloCopia]);
          if (articuloCopia.guardado) {
            sincronizarArticulosOffline([articuloCopia]);
          }
        }
      }
    },
    [articulos, fetchConteos, recargarDatos, t]
  );

  const hayFiltrosActivos = Boolean(
    searchQuery.trim() ||
      categoriasSeleccionadas.length > 0 ||
      fuentesSeleccionadas.length > 0 ||
      filtroIA !== "todas"
  );

  const numFiltrosActivos =
    (searchQuery.trim() ? 1 : 0) +
    categoriasSeleccionadas.length +
    fuentesSeleccionadas.length +
    (filtroIA !== "todas" ? 1 : 0);

  const totalPaginas = Math.max(Math.ceil(totalNoticias / tamanoPagina), 1);

  return {
    activeTab,
    setActiveTab,
    seleccionarTab,
    orden,
    cambiarOrden,
    filtroIA,
    cambiarFiltroIA,
    pagina,
    setPagina,
    cambiarPagina,
    tamanoPagina,
    cambiarTamanoPagina,
    searchQuery,
    setSearchQuery,
    busquedaAplicada,
    categoriasSeleccionadas,
    fuentesSeleccionadas,
    alternarCategoria,
    alternarFuente,
    seleccionarTodasFuentes,
    seleccionarTodasCategorias,
    limpiarFiltros,
    hayFiltrosActivos,
    numFiltrosActivos,
    totalPaginas,
    articulos,
    setArticulos,
    totalNoticias,
    setTotalNoticias,
    cargandoFeed,
    lastUpdated,
    toggleLeido,
    toggleGuardado,
    actualizarCategoria,
    descartarArticulo,
  };
}
