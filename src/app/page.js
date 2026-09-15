// src/app/page.js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import GitHubCard from "./components/GitHubCard";
import NewsFeed from "./components/NewsFeed";

// Modales diferidos: no entran al bundle inicial, se cargan al abrirse.
const AddFeedModal = dynamic(() => import("./components/AddFeedModal"), { ssr: false });
const ManageSourcesModal = dynamic(() => import("./components/ManageSourcesModal"), { ssr: false });
const PerfilModal = dynamic(() => import("./components/PerfilModal"), { ssr: false });
const AjustesPanel = dynamic(() => import("./components/AjustesPanel"), { ssr: false });
import {
  Settings,
  Plus,
  RotateCw,
  Sparkles,
  Filter,
  ChevronDown,
  Check,
  Trash2,
  Search,
  XCircle,
  Save,
  X,
} from "lucide-react";
import { TEMA_POR_DEFECTO, aplicarTema, esTemaValido } from "@/lib/temas";
import { useIdioma } from "@/lib/i18n";
import { dominioDeUrl } from "@/lib/formato";
import { paramsFeed, urlBase64ToUint8Array } from "@/lib/feed-utils";
import AppHeader from "./components/dashboard/AppHeader";
import StatsCards from "./components/dashboard/StatsCards";
import Paginacion from "./components/dashboard/Paginacion";
import Toast from "./components/dashboard/Toast";
import WelcomeModal from "./components/dashboard/WelcomeModal";
import ConfirmDeleteModal from "./components/dashboard/ConfirmDeleteModal";

function dominioDeFuente(urlFeed = "") {
  return dominioDeUrl(urlFeed);
}

function IconoFuentePildora({ fuente }) {
  const [fallo, setFallo] = useState(false);
  const dominio = dominioDeFuente(fuente?.url_feed || "");
  if (!dominio || fallo) {
    return (
      <span
        aria-hidden="true"
        className="grid h-4 w-4 shrink-0 place-content-center rounded-full bg-app-raised text-[9px] font-bold text-[var(--accent-ink)]"
      >
        {(fuente?.nombre || "?").trim().charAt(0).toUpperCase() || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/icon?domain=${dominio}`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className="h-4 w-4 shrink-0 rounded-full object-cover"
    />
  );
}

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [articulos, setArticulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // URL recibida por Web Share Target (?compartir=): se lee una sola vez en
  // el estado inicial, sin efectos, y se limpia de la barra de dirección.
  const [urlCompartida, setUrlCompartida] = useState(() => {
    try {
      return (new URLSearchParams(window.location.search).get("compartir") || "").trim();
    } catch {
      return "";
    }
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).has("compartir");
    } catch {
      return false;
    }
  });
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isPerfilOpen, setIsPerfilOpen] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  
  // Estado para el modal de bienvenida/tutorial de nuevos usuarios
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const [activeTab, setActiveTab] = useState("todas"); // "todas" | "guardadas" | "leidas"
  const [orden, setOrden] = useState("recientes");
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(false);
  const [panelMovilAbierto, setPanelMovilAbierto] = useState(false);
  const [fuentesDisponibles, setSourcesList] = useState([]);
  const [fuentesSeleccionadas, setFuentesSeleccionadas] = useState([]);
  const [vistasGuardadas, setVistasGuardadas] = useState([]);
  const [nombreVista, setNombreVista] = useState("");
  const [guardandoVista, setGuardandoVista] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [totalNoticias, setTotalNoticias] = useState(0);
  const [categoriasDisponibles, setCategoriasDisponibles] = useState([]);
  const [conteos, setConteos] = useState({ pendientes: 0, leidas: 0, guardadas: 0 });
  const [cargandoFeed, setCargandoFeed] = useState(false);
  const [nonceRecarga, setNonceRecarga] = useState(0);
  const [pushSoportado, setPushSoportado] = useState(false);
  const [pushActivado, setPushActivado] = useState(false);
  const [pushCargando, setPushCargando] = useState(false);
  // Panel lateral de ajustes + preferencias persistidas. Se leen una sola vez
  // en el estado inicial (el script pre-paint ya aplicó tema y movimiento).
  const [panelAjustes, setPanelAjustes] = useState(false);
  const [tema, setTema] = useState(() => {
    try {
      const guardado = window.localStorage.getItem("lector_tema");
      return esTemaValido(guardado) ? guardado : TEMA_POR_DEFECTO;
    } catch {
      return TEMA_POR_DEFECTO;
    }
  });
  const [tamanoPagina, setTamanoPagina] = useState(() => {
    try {
      const pag = Number(window.localStorage.getItem("lector_tamano_pagina"));
      return [15, 30, 60].includes(pag) ? pag : 30;
    } catch {
      return 30;
    }
  });
  const [autoMarcarLeida, setAutoMarcarLeida] = useState(() => {
    try {
      return window.localStorage.getItem("lector_auto_leido") === "1";
    } catch {
      return false;
    }
  });
  const [movimientoReducido, setMovimientoReducido] = useState(() => {
    try {
      return window.localStorage.getItem("lector_movimiento") === "reducido";
    } catch {
      return false;
    }
  });
  const [densidad, setDensidad] = useState(() => {
    try {
      return window.localStorage.getItem("lector_densidad") === "compacta"
        ? "compacta"
        : "comoda";
    } catch {
      return "comoda";
    }
  });
  const [toast, setToast] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);

  const { t, locale } = useIdioma();

  const notify = useCallback((message, type = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  // Modo invitado: usuario temporal en la BD con cookie de sesión (muere al
  // cerrar el navegador). Puede usar todo; al salir se elimina su información.
  const esInvitado = Boolean(session?.user?.invitado);

  const salirInvitado = useCallback(async () => {
    try {
      await fetch("/api/auth/invitado", { method: "DELETE" });
    } catch {
      // Aunque falle la limpieza, se cierra la sesión local.
    }
    setSession(null);
    setArticulos([]);
    setPagina(1);
    setTotalNoticias(0);
    setConteos({ pendientes: 0, leidas: 0, guardadas: 0 });
  }, []);



  const filtroFuenteRef = useRef(null);

  const irAFiltroFuentes = useCallback(() => {
    setFiltersOpen(true);
    window.setTimeout(() => {
      filtroFuenteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      filtroFuenteRef.current?.focus({ preventScroll: true });
    }, 60);
  }, []);

  const recargarSesion = useCallback(async () => {
    try {
      const resAuth = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionData = await resAuth.json();
      if (sessionData?.user) {
        setSession(sessionData);
      }
    } catch (err) {
      console.error("Error al recargar la sesión:", err);
    }
  }, []);

  const fetchSources = useCallback(async (signal) => {
    try {
      const res = await fetch("/api/sources", { cache: "no-store", signal });
      if (res.ok) {
        const data = await res.json();
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

  // Conteos globales para las tarjetas (no dependen de la página visible).
  const fetchConteos = useCallback(async (signal) => {
    try {
      const res = await fetch("/api/rss?tipo=conteos", { cache: "no-store", signal });
      if (res.ok) {
        const data = await res.json();
        setConteos({
          pendientes: Number(data.pendientes) || 0,
          leidas: Number(data.leidas) || 0,
          guardadas: Number(data.guardadas) || 0,
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") console.error("Error al obtener conteos:", err);
    }
  }, []);

  const procesarColaClasificacion = useCallback(async () => {
    for (let intento = 0; intento < 12; intento++) {
      let restantes = 0;
      let esperaMs = 500;
      try {
        const res = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clasificar_pendientes", lote: 12 }),
        });
        if (!res.ok) break;
        const data = await res.json().catch(() => ({}));
        restantes = Number(data.restantes) || 0;
        if (Number(data.reintentarEn) > 0) esperaMs = Number(data.reintentarEn) * 1000;
      } catch {
        break;
      }
      // Refresca la página visible (vía nonce) con las categorías ya clasificadas.
      setNonceRecarga((n) => n + 1);
      if (restantes === 0) break;
      await new Promise((resolve) => setTimeout(resolve, esperaMs));
    }
  }, []);

  // Service worker de push + estado de suscripción (solo navegadores compatibles).
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }
    let cancelado = false;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registro) => {
        if (cancelado) return;
        setPushSoportado(true);
        const existente = await registro.pushManager.getSubscription().catch(() => null);
        if (!cancelado) setPushActivado(Boolean(existente));
      })
      .catch(() => {
        if (!cancelado) setPushSoportado(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const gestionarPush = useCallback(async () => {
    if (pushCargando) return;
    setPushCargando(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const existente = await registro.pushManager.getSubscription();
      if (existente) {
        await existente.unsubscribe().catch(() => {});
        await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existente.endpoint }),
        });
        setPushActivado(false);
        notify(t("avisos.push_off"), "success");
        return;
      }
      if (Notification.permission === "denied") {
        notify(t("avisos.push_bloqueadas"), "error");
        return;
      }
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        notify(t("avisos.push_sin_permiso"), "error");
        return;
      }
      const resKey = await fetch("/api/push", { cache: "no-store" });
      const { publicKey } = await resKey.json();
      if (!publicKey) throw new Error(t("avisos.push_sin_clave"));
      const suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suscripcion),
      });
      if (!res.ok) throw new Error(t("avisos.push_no_guardada"));
      setPushActivado(true);
      notify(t("avisos.push_on"), "success");
    } catch (err) {
      console.error("Error con notificaciones push:", err);
      notify(err.message || t("avisos.push_err"), "error");
    } finally {
      setPushCargando(false);
    }
  }, [pushCargando, notify, t]);

  // Limpia ?compartir= de la barra sin recargar (no toca estado: sin aviso de lint).
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("compartir")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      // Sin URL compartida: arranque normal.
    }
  }, []);

  // Re-aplica tema, movimiento y densidad al montar: el script pre-paint ya
  // lo hizo, pero esto cubre cualquier caso donde no se ejecutara. Idempotente.
  useEffect(() => {
    aplicarTema(tema);
    try {
      if (window.localStorage.getItem("lector_movimiento") === "reducido") {
        document.documentElement.dataset.motion = "reduced";
      }
      if (window.localStorage.getItem("lector_densidad") === "compacta") {
        document.documentElement.dataset.densidad = "compacta";
      }
    } catch {
      // Sin almacenamiento disponible: se conserva lo aplicado.
    }
  }, [tema]);

  const cambiarDensidad = (valor) => {
    const normalizada = valor === "compacta" ? "compacta" : "comoda";
    try {
      window.localStorage.setItem("lector_densidad", normalizada);
      if (normalizada === "compacta") document.documentElement.dataset.densidad = "compacta";
      else delete document.documentElement.dataset.densidad;
    } catch {
      // Sin DOM/almacenamiento disponible: solo cambia el estado.
    }
    setDensidad(normalizada);
  };

  // Sesión inicial (cuenta o invitado) + modal de bienvenida. El feed lo
  // carga el efecto de datos paginados cuando hay sesión.
  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const resAuth = await fetch("/api/auth/session", { signal: controller.signal });
        const sessionData = await resAuth.json();

        if (controller.signal.aborted) return;

        if (sessionData?.user) {
          setSession(sessionData);
          const hasSeenWelcome = localStorage.getItem(`welcome_seen_${sessionData.user.email || sessionData.user.id}`);
          if (!hasSeenWelcome) setShowWelcomeModal(true);
        } else {
          // Sin cuenta: se entra como invitado si hay cookie de sesión válida.
          try {
            const resInvitado = await fetch("/api/auth/invitado", {
              cache: "no-store",
              signal: controller.signal,
            });
            if (!resInvitado.ok || controller.signal.aborted) return;
            setSession({ user: { name: "Invitado", invitado: true } });
            const hasSeenWelcome = localStorage.getItem("welcome_seen_invitado");
            if (!hasSeenWelcome) setShowWelcomeModal(true);
          } catch (err) {
            if (err.name !== "AbortError") console.error("Error al cargar invitado:", err);
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") console.error("Error al cargar sesión:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadSession();
    return () => controller.abort();
  }, []);

  const fetchVistas = useCallback(async (signal) => {
    try {
      const res = await fetch("/api/vistas", { cache: "no-store", signal });
      if (res.ok) {
        const data = await res.json();
        setVistasGuardadas(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err.name !== "AbortError") console.error("Error al obtener vistas:", err);
    }
  }, []);

  // Fuentes + conteos + vistas: al iniciar sesión y tras cambios estructurales.
  useEffect(() => {
    if (!session?.user) return undefined;
    const controller = new AbortController();
    async function cargarMeta() {
      await Promise.all([
        fetchSources(controller.signal),
        fetchConteos(controller.signal),
        fetchVistas(controller.signal),
      ]);
    }
    cargarMeta();
    return () => controller.abort();
  }, [session, fetchSources, fetchConteos, fetchVistas, nonceRecarga]);

  // Debounce de búsqueda: 400ms tras dejar de teclear.
  const busquedaRef = useRef("");
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

  // Feed paginado + facetas: página, pestaña, orden, búsqueda, filtros.
  useEffect(() => {
    if (!session?.user) return undefined;
    const controller = new AbortController();
    const { signal } = controller;

    async function cargarFeed() {
      setCargandoFeed(true);
      try {
        const feedParams = paramsFeed({
          page: pagina,
          limit: tamanoPagina,
          tab: activeTab,
          orden,
          q: busquedaAplicada,
          categorias: categoriasSeleccionadas,
          fuentes: fuentesSeleccionadas,
        });
        const facetaParams = new URLSearchParams({ tipo: "facetas", tab: activeTab });
        if (busquedaAplicada.trim()) facetaParams.set("q", busquedaAplicada.trim());
        if (fuentesSeleccionadas.length > 0) facetaParams.set("fuentes", fuentesSeleccionadas.join(","));

        const [resFeed, resFacetas] = await Promise.all([
          fetch(`/api/rss?${feedParams}`, { cache: "no-store", signal }),
          fetch(`/api/rss?${facetaParams}`, { cache: "no-store", signal }),
        ]);
        if (signal.aborted) return;

        if (resFeed.ok) {
          const data = await resFeed.json();
          const articles = Array.isArray(data) ? data : (data.articles || []);
          setArticulos(articles);
          setTotalNoticias(Array.isArray(data) ? articles.length : (Number(data.total) || 0));
          // Si la página quedó vacía por borrados y no es la primera, retrocede.
          if (!Array.isArray(data) && articles.length === 0 && (Number(data.total) || 0) > 0 && pagina > 1) {
            setPagina((p) => Math.max(p - 1, 1));
          }
          setLastUpdated(new Date());
        }
        if (resFacetas.ok) {
          const facetas = await resFacetas.json();
          const lista = (Array.isArray(facetas) ? facetas : []).map((f) => f.categoria).filter(Boolean);
          setCategoriasDisponibles(lista);
          // Purga en el mismo manejador (sin efecto separado): si una categoría
          // seleccionada dejó de existir, se retira para no dejar un filtro imposible.
          const disponibles = new Set(lista);
          setCategoriasSeleccionadas((actuales) => {
            if (actuales.length === 0) return actuales;
            const vigentes = actuales.filter((categoria) => disponibles.has(categoria));
            return vigentes.length === actuales.length ? actuales : vigentes;
          });
        }
      } catch (err) {
        if (err.name !== "AbortError") console.error("Error al cargar el feed:", err);
      } finally {
        if (!signal.aborted) setCargandoFeed(false);
      }
    }

    cargarFeed();
    return () => controller.abort();
  }, [session, pagina, tamanoPagina, activeTab, orden, busquedaAplicada, categoriasSeleccionadas, fuentesSeleccionadas, nonceRecarga]);

  const closeWelcomeModal = () => {
    if (session?.user) {
      const clave = esInvitado ? "invitado" : (session.user.email || session.user.id);
      if (clave) {
        try {
          localStorage.setItem(`welcome_seen_${clave}`, "true");
        } catch {
          // Sin almacenamiento disponible: solo se cierra el modal.
        }
      }
    }
    setShowWelcomeModal(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", restore_today: true }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(t("avisos.refresh_err_fuentes"));
      const data = await response.json().catch(() => ({}));

      // Vuelve a la primera página (o recarga si ya está en ella) y actualiza fuentes/conteos.
      if (pagina === 1) setNonceRecarga((n) => n + 1);
      else setPagina(1);
      fetchSources();
      fetchConteos();
      const restaurados = Number(data.restaurados) || 0;
      const pendientes = Number(data.pendientes) || 0;
      const omitidas = Number(data.omitidas) || 0;
      const purgados = Number(data.purgados) || 0;
      let mensaje = restaurados > 0
        ? t("avisos.refresh_restauradas", { n: restaurados })
        : t("avisos.refresh_ok");
      if (omitidas > 0) mensaje += t("avisos.sin_cambios", { n: omitidas });
      if (purgados > 0) mensaje += t("avisos.purgadas", { n: purgados });
      if (pendientes > 0) {
        mensaje += t("avisos.completando", { n: pendientes });
        procesarColaClasificacion();
      }
      notify(mensaje, "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Error al refrescar las noticias:", err);
      notify(err.message || t("avisos.refresh_err_feed"), "error");
    } finally {
      setRefreshing(false);
    }
  };

  // Modal propio de confirmación (sin confirm() nativo): respeta el tema y es accesible.
  const handleEliminarTodas = () => setConfirmarEliminar(true);

  const confirmarEliminarTodas = async () => {
    setConfirmarEliminar(false);
    const backupArticulos = [...articulos];
    setArticulos([]);
    setTotalNoticias(0);

    try {
      const res = await fetch("/api/rss?delete_all=true", { method: "DELETE" });
      if (!res.ok) throw new Error(t("avisos.eliminar_err"));
      setPagina(1);
      fetchConteos();
      notify(t("avisos.eliminadas_ok"), "success");
    } catch (err) {
      console.error("Error al eliminar todas las noticias:", err);
      setArticulos(backupArticulos);
      setNonceRecarga((n) => n + 1);
      notify(err.message || t("avisos.eliminar_feed"), "error");
    }
  };

  const toggleLeido = async (id, leidoActual) => {
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
      // La noticia puede salir de la pestaña actual: recarga página + conteos.
      setNonceRecarga((n) => n + 1);
      fetchConteos();
      return true;
    } catch {
      setArticulos((prev) =>
        prev.map((art) => (art.id === id ? { ...art, leido: leidoActual } : art))
      );
      return false;
    }
  };

  const toggleGuardado = async (id, guardadoActual) => {
    const guardadoNuevo = !guardadoActual;
    setArticulos((prev) =>
      prev.map((art) => (art.id === id ? { ...art, guardado: guardadoNuevo } : art))
    );

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
      setNonceRecarga((n) => n + 1);
      fetchConteos();
      return true;
    } catch {
      setArticulos((prev) =>
        prev.map((art) => (art.id === id ? { ...art, guardado: guardadoActual } : art))
      );
      return false;
    }
  };

  const actualizarCategoria = async (id, categoria) => {
    const articuloCopia = articulos.find((art) => art.id === id);
    setArticulos((prev) =>
      prev.map((art) =>
        art.id === id ? { ...art, categoria, clasificacion_metodo: "manual", clasificacion_confianza: 1 } : art
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
      setNonceRecarga((n) => n + 1);
      return true;
    } catch {
      if (articuloCopia) {
        setArticulos((prev) => prev.map((art) => (art.id === id ? articuloCopia : art)));
      }
      return false;
    }
  };

  const descartarArticulo = async (id) => {
    const articuloCopia = articulos.find((art) => art.id === id);
    setArticulos((prev) => prev.filter((art) => art.id !== id));

    try {
      const res = await fetch(`/api/rss?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("avisos.eliminar_feed"));
      // Rellena la página desde el servidor y actualiza conteos.
      setNonceRecarga((n) => n + 1);
      fetchConteos();
    } catch {
      if (articuloCopia) {
        setArticulos((prev) => [...prev, articuloCopia]);
      }
    }
  };

  const seleccionarTab = (tab) => {
    setActiveTab(tab);
    setCategoriasSeleccionadas([]);
    setPagina(1);
  };

  const cambiarOrden = (valor) => {
    setOrden(valor);
    setPagina(1);
  };

  const cambiarPagina = (nueva) => {
    setPagina(nueva);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const alternarCategoria = (categoria) => {
    setCategoriasSeleccionadas((actuales) => (
      actuales.includes(categoria)
        ? actuales.filter((actual) => actual !== categoria)
        : [...actuales, categoria]
    ));
    setPagina(1);
  };

  const alternarFuente = (fuenteId) => {
    const id = String(fuenteId);
    setFuentesSeleccionadas((actuales) => (
      actuales.includes(id)
        ? actuales.filter((actual) => actual !== id)
        : [...actuales, id]
    ));
    setPagina(1);
  };

  const limpiarFiltros = () => {
    setSearchQuery("");
    setBusquedaAplicada("");
    busquedaRef.current = "";
    setCategoriasSeleccionadas([]);
    setFuentesSeleccionadas([]);
    setPagina(1);
  };

  // Vistas guardadas: aplican pestaña + orden + categorías + fuentes + búsqueda.
  const aplicarVista = (vista) => {
    const config = vista.config || {};
    setActiveTab(config.tab || "todas");
    setOrden(config.orden || "recientes");
    setCategoriasSeleccionadas(Array.isArray(config.categorias) ? config.categorias : []);
    setFuentesSeleccionadas(
      (Array.isArray(config.fuentes) ? config.fuentes : []).map((id) => String(id))
    );
    const q = String(config.q || "");
    setSearchQuery(q);
    setBusquedaAplicada(q);
    busquedaRef.current = q;
    setPagina(1);
    if (panelMovilAbierto) setPanelMovilAbierto(false);
  };

  const guardarVistaActual = async (event) => {
    event.preventDefault();
    const nombre = nombreVista.trim();
    if (!nombre || guardandoVista) return;
    setGuardandoVista(true);
    try {
      const res = await fetch("/api/vistas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          config: {
            tab: activeTab,
            orden,
            categorias: categoriasSeleccionadas,
            fuentes: fuentesSeleccionadas,
            q: searchQuery.trim(),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("avisos.vista_err"));
      }
      setNombreVista("");
      await fetchVistas();
      notify(t("avisos.vista_guardada", { n: nombre }), "success");
    } catch (err) {
      notify(err.message || t("avisos.vista_err"), "error");
    } finally {
      setGuardandoVista(false);
    }
  };

  const eliminarVista = async (id) => {
    try {
      const res = await fetch(`/api/vistas?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("avisos.vista_eliminar_err"));
      await fetchVistas();
    } catch (err) {
      notify(err.message || t("avisos.vista_eliminar_err"), "error");
    }
  };

  const hayFiltrosActivos = Boolean(
    searchQuery.trim() || categoriasSeleccionadas.length > 0 || fuentesSeleccionadas.length > 0
  );

  const abrirPanelMovil = useCallback(() => {
    setControlsOpen(true);
    setFiltersOpen(true);
    setPanelMovilAbierto(true);
  }, []);

  const cerrarPanelMovil = useCallback(() => {
    setPanelMovilAbierto(false);
  }, []);

  // Preferencias del panel de ajustes (persistidas por navegador).
  const cambiarTema = useCallback((id) => {
    setTema(aplicarTema(id).id);
  }, []);

  const cambiarTamanoPagina = (n) => {
    try {
      window.localStorage.setItem("lector_tamano_pagina", String(n));
    } catch {
      // Sin almacenamiento disponible: solo cambia en esta vista.
    }
    setTamanoPagina(n);
    setPagina(1);
  };

  const cambiarAutoMarcar = (valor) => {
    try {
      window.localStorage.setItem("lector_auto_leido", valor ? "1" : "0");
    } catch {
      // Sin almacenamiento disponible: solo cambia en esta vista.
    }
    setAutoMarcarLeida(valor);
  };

  const cambiarMovimiento = (valor) => {
    try {
      window.localStorage.setItem("lector_movimiento", valor ? "reducido" : "completo");
      if (valor) document.documentElement.dataset.motion = "reduced";
      else delete document.documentElement.dataset.motion;
    } catch {
      // Sin DOM/almacenamiento disponible: solo cambia el estado.
    }
    setMovimientoReducido(valor);
  };

  // Los artículos ya llegan filtrados y ordenados del servidor.
  // Los totales de las tarjetas son globales (vía /api/rss?tipo=conteos).
  const totalGuardados = conteos.guardadas;
  const totalLeidos = conteos.leidas;
  const totalPendientes = conteos.pendientes;
  const totalPaginas = Math.max(Math.ceil(totalNoticias / tamanoPagina), 1);

  const tarjetasStats = [
    { label: t("stats.pendientes"), value: totalPendientes, color: "text-sky-300", tab: "todas", titulo: t("stats.ver_pendientes"), activo: "border-sky-500/60 ring-1 ring-sky-500/40" },
    { label: t("stats.leidas"), value: totalLeidos, color: "text-emerald-300", tab: "leidas", titulo: t("stats.ver_leidas"), activo: "border-emerald-500/60 ring-1 ring-emerald-500/40" },
    { label: t("stats.guardadas"), value: totalGuardados, color: "text-amber-300", tab: "guardadas", titulo: t("stats.ver_guardadas"), activo: "border-amber-500/60 ring-1 ring-amber-500/40" },
    { label: t("stats.fuentes"), value: fuentesDisponibles.length, color: "text-cyan-300", tab: null, titulo: t("stats.ir_fuentes"), activo: "" },
  ];

  return (
    <div className="min-h-screen bg-app-bg text-app-fg flex flex-col">
      <AppHeader
        session={session}
        esInvitado={esInvitado}
        panelAjustes={panelAjustes}
        onAbrirAjustes={() => setPanelAjustes(true)}
        t={t}
      />

      {esInvitado && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 sm:px-6 flex items-center justify-center gap-2 text-center">
          <p className="text-xs text-amber-200">
            {t("invitado.aviso_1")} <strong>{t("header.invitado").toLowerCase()}</strong>: {t("invitado.aviso_2")} <Link href="/register" className="underline font-medium">{t("invitado.crear")}</Link> {t("invitado.aviso_3")}
          </p>
        </div>
      )}

      {/* Main Content */}
      <main className="w-full px-3 py-4 sm:px-6 sm:py-6 flex-1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-48 rounded-xl border border-app-line bg-app-surface/70" />
            ))}
          </div>
        ) : session?.user ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Columna Izquierda / Central: Noticias */}
            <div className="contents lg:col-span-3 lg:block lg:space-y-6">
              <StatsCards
                tarjetas={tarjetasStats}
                activeTab={activeTab}
                onSeleccionarTab={seleccionarTab}
                onIrFuentes={irAFiltroFuentes}
              />

              <div className="order-3 lg:order-none flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <label className="relative flex-1 rounded-2xl border border-app-line bg-app-surface transition duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:border-[var(--accent)]/70 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("buscar.ph")}
                    aria-label={t("buscar.aria")}
                    className="w-full bg-transparent rounded-2xl pl-9 pr-3 py-2.5 text-sm text-app-fg placeholder:text-app-muted outline-none"
                  />
                </label>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {lastUpdated ? t("buscar.actualizado", { hora: lastUpdated.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) }) : t("buscar.sin")}
                </span>
              </div>

              <div className="order-4 lg:order-none">
                {cargandoFeed && articulos.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse" aria-label={t("vacio.cargando")}>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="h-48 rounded-xl border border-app-line bg-app-surface/70" />
                    ))}
                  </div>
                ) : totalNoticias === 0 ? (
                  <div className="bezel-outer my-8">
                    <div className="bezel-inner p-12 text-center space-y-4">
                      <p className="eyebrow mx-auto w-fit">{t("filtros.titulo")}</p>
                      <p className="text-base text-app-muted max-w-md mx-auto">
                        {activeTab === "guardadas"
                          ? t("vacio.guardadas")
                          : activeTab === "leidas"
                            ? t("vacio.leidas")
                            : t("vacio.todas")}
                      </p>
                      {activeTab === "todas" && (
                        <button
                          onClick={() => setIsAddModalOpen(true)}
                          className="btn-press group inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] transition hover:opacity-90"
                        >
                          <Plus size={16} /> {t("vacio.agregar")}
                          <span aria-hidden="true" className="cta-icon">
                            →
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <NewsFeed
                      articles={articulos}
                      onToggleRead={toggleLeido}
                      onToggleSave={toggleGuardado}
                      onUpdateCategory={actualizarCategoria}
                      onDelete={descartarArticulo}
                      autoMarcarLeida={autoMarcarLeida}
                    />
                    <Paginacion
                      pagina={pagina}
                      totalPaginas={totalPaginas}
                      totalNoticias={totalNoticias}
                      cargando={cargandoFeed}
                      onCambiar={cambiarPagina}
                      t={t}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Columna Derecha: Filtros y Orden */}
            {panelMovilAbierto && (
              <div
                aria-hidden="true"
                onClick={cerrarPanelMovil}
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
              />
            )}
            <button
              type="button"
              onClick={() => (panelMovilAbierto ? cerrarPanelMovil() : abrirPanelMovil())}
              title={t("controles.abrir")}
              aria-label={t("controles.abrir")}
              aria-expanded={panelMovilAbierto}
              className="lg:hidden fixed right-0 bottom-44 z-40 rounded-l-xl bg-sky-600/90 p-2.5 text-white shadow-xl backdrop-blur-sm transition hover:bg-sky-500"
            >
              <span className="relative block">
                <Settings size={20} />
                {hayFiltrosActivos && (
                  <span aria-hidden="true" className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400" />
                )}
              </span>
            </button>
            <aside className={`dashboard-control-sidebar order-5 lg:order-last bg-app-surface/40 border border-app-line/80 rounded-2xl p-4 sm:p-5 space-y-5 sm:space-y-6 lg:sticky lg:top-24 ${panelMovilAbierto ? "max-lg:fixed max-lg:inset-x-3 max-lg:bottom-3 max-lg:z-40 max-lg:max-h-[70dvh] max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:shadow-2xl" : "max-lg:hidden"}`}>
              <section className="border-b border-gray-800 pb-4 space-y-4">
                <button
                  type="button"
                  onClick={() => setControlsOpen((open) => !open)}
                  aria-expanded={controlsOpen}
                  className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-white font-semibold text-[clamp(0.75rem,1vw,0.875rem)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Settings size={16} className="text-sky-400" />
                    <span className="truncate">{t("controles.titulo")}</span>
                  </span>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${controlsOpen ? "rotate-180" : ""}`} />
                </button>

                {controlsOpen && (
                  <div className="space-y-4 border-t border-gray-800 pt-4">
                    <section className="space-y-3">
                      <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-wide text-gray-400">{t("controles.acciones")}</h2>
                      <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title={t("controles.refrescar_titulo")}
                    className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-gray-200 transition hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <RotateCw size={14} className={refreshing ? "animate-spin text-sky-400" : ""} />
                    <span className="truncate">{refreshing ? t("controles.actualizando") : t("controles.refrescar")}</span>
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="min-w-0 rounded-lg bg-sky-600 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-white transition hover:bg-sky-500 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span className="truncate">{t("controles.agregar")}</span>
                      </button>
                      </div>
                    </section>

                    <section className="space-y-3 border-t border-gray-800 pt-4">
                      <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-wide text-gray-400">{t("controles.admin")}</h2>
                      <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleEliminarTodas}
                    title={t("controles.eliminar_titulo")}
                    className="min-w-0 rounded-lg border border-red-900/50 bg-red-950/40 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-red-300 transition hover:bg-red-900/50 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span className="truncate">{t("controles.eliminar")}</span>
                  </button>
                  <button
                    onClick={() => setIsManageModalOpen(true)}
                    className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-gray-200 transition hover:bg-gray-800 flex items-center justify-center gap-1.5"
                  >
                    <Settings size={14} />
                    <span className="truncate">{t("controles.fuentes")}</span>
                      </button>
                      </div>
                      {/* Los avisos push se gestionan en Ajustes → Notificaciones */}
                    </section>
                  </div>
                )}
              </section>

              <section className="pt-4">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-white font-semibold text-[clamp(0.75rem,1vw,0.875rem)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Filter size={16} className="text-sky-400" />
                    <span className="truncate">{t("filtros.titulo")}</span>
                  </span>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                </button>
              </section>

              {filtersOpen && (
                <div className="space-y-5 sm:space-y-6">

              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-400">{t("filtros.ordenar")}</span>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("filtros.ordenar")}>
                  {[
                    { valor: "recientes", etiqueta: t("filtros.recientes") },
                    { valor: "az", etiqueta: t("filtros.az") },
                    { valor: "za", etiqueta: t("filtros.za") },
                  ].map((opcion) => {
                    const activo = orden === opcion.valor;
                    return (
                      <button
                        key={opcion.valor}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => cambiarOrden(opcion.valor)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                          activo
                            ? "border-sky-500 bg-sky-500/15 text-sky-300"
                            : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        {activo && <Check size={13} strokeWidth={3} className="shrink-0" />}
                        {opcion.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-400">{t("filtros.fuente")}</span>
                  {fuentesSeleccionadas.length > 0 && (
                    <span className="text-[11px] text-sky-400">
                      {fuentesSeleccionadas.length === 1
                        ? t("filtros.sel_una", { n: 1 })
                        : t("filtros.sel_varias", { n: fuentesSeleccionadas.length })}
                    </span>
                  )}
                </div>
                <div ref={filtroFuenteRef} tabIndex={-1} className="flex flex-wrap gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60">
                  {fuentesDisponibles.map((fuente) => {
                    const activa = fuentesSeleccionadas.includes(String(fuente.id));
                    return (
                      <button
                        key={fuente.id}
                        type="button"
                        aria-pressed={activa}
                        title={fuente.nombre}
                        onClick={() => alternarFuente(fuente.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 max-w-44 ${
                          activa
                            ? "border-sky-500 bg-sky-500/15 text-sky-300"
                            : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        {activa && <Check size={13} strokeWidth={3} className="shrink-0" />}
                        <IconoFuentePildora fuente={fuente} />
                        <span className="truncate">{fuente.nombre}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-gray-400">{t("filtros.categorias")}</label>
                  {categoriasSeleccionadas.length > 0 && (
                    <span className="text-[11px] text-sky-400">
                      {categoriasSeleccionadas.length === 1
                        ? t("filtros.sel_una", { n: 1 })
                        : t("filtros.sel_varias", { n: categoriasSeleccionadas.length })}
                    </span>
                  )}
                </div>
                <div className={`flex flex-wrap gap-1.5 ${categoriasExpandidas ? "" : "[&>*:nth-child(n+9)]:max-lg:hidden"}`}>
                  {categoriasDisponibles.map((categoria) => {
                    const activa = categoriasSeleccionadas.includes(categoria);
                    return (
                      <button
                        key={categoria}
                        type="button"
                        aria-pressed={activa}
                        onClick={() => alternarCategoria(categoria)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                          activa
                            ? "border-sky-500 bg-sky-500/15 text-sky-300"
                            : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        {activa && <Check size={13} strokeWidth={3} className="shrink-0" />}
                        {categoria}
                      </button>
                    );
                  })}
                </div>

                {categoriasDisponibles.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setCategoriasExpandidas((expandida) => !expandida)}
                    className="lg:hidden text-xs text-sky-400 hover:text-sky-300 font-medium px-1 py-1 text-left"
                  >
                    {categoriasExpandidas ? t("filtros.ver_menos") : t("filtros.ver_todas", { n: categoriasDisponibles.length })}
                  </button>
                )}

                {categoriasDisponibles.length === 0 && (
                  <p className="px-1 py-2 text-xs text-gray-500">{t("filtros.sin_categorias")}</p>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-400">{t("filtros.vistas")}</span>
                {vistasGuardadas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {vistasGuardadas.map((vista) => (
                      <span
                        key={vista.id}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-900 text-gray-300 transition hover:border-gray-500"
                      >
                        <button
                          type="button"
                          onClick={() => aplicarVista(vista)}
                          title={t("filtros.vista_aplicar", { n: vista.nombre })}
                          className="pl-3 pr-1 py-1.5 text-xs font-medium hover:text-white"
                        >
                          {vista.nombre}
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarVista(vista.id)}
                          title={t("filtros.vista_eliminar", { n: vista.nombre })}
                          aria-label={t("filtros.vista_eliminar", { n: vista.nombre })}
                          className="pr-2.5 pl-1 py-1.5 text-gray-500 hover:text-rose-400"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <form onSubmit={guardarVistaActual} className="flex gap-1.5">
                  <input
                    value={nombreVista}
                    onChange={(event) => setNombreVista(event.target.value)}
                    placeholder={t("filtros.vista_ph")}
                    aria-label={t("filtros.vista_aria")}
                    maxLength={100}
                    className="min-w-0 flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-500 focus:border-sky-600"
                  />
                  <button
                    type="submit"
                    disabled={!nombreVista.trim() || guardandoVista}
                    title={t("filtros.vista_guardar_titulo")}
                    className="shrink-0 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-200 transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Save size={13} />
                    {t("filtros.vista_guardar")}
                  </button>
                </form>
              </div>

              {(searchQuery || categoriasSeleccionadas.length > 0 || fuentesSeleccionadas.length > 0) && (
                <button
                  onClick={limpiarFiltros}
                  className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-xs font-medium text-gray-300 transition hover:border-gray-600 hover:text-white flex items-center justify-center gap-2"
                >
                  <XCircle size={15} /> {t("filtros.limpiar")}
                </button>
              )}
                </div>
              )}
            </aside>

          </div>
        ) : (
          <div className="text-center py-20 max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center justify-center p-3 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20 mb-2">
              <Sparkles size={32} />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {t("landing.titulo")}
            </h2>
            <p className="text-gray-400 leading-relaxed">
              {t("landing.texto")}
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Link
                href="/login"
                className="bg-sky-600 hover:bg-sky-500 text-white font-medium px-6 py-2.5 rounded-xl transition shadow-lg shadow-sky-600/20"
              >
                {t("landing.comenzar")}
              </Link>
            </div>
          </div>
        )}
      </main>

      <WelcomeModal abierto={showWelcomeModal} onCerrar={closeWelcomeModal} t={t} />

      {/* Panel lateral de ajustes + modales (el perfil no aplica en modo invitado) */}
      <AjustesPanel
        abierto={panelAjustes}
        onCerrar={() => setPanelAjustes(false)}
        tema={tema}
        onTema={cambiarTema}
        tamanoPagina={tamanoPagina}
        onTamanoPagina={cambiarTamanoPagina}
        autoMarcarLeida={autoMarcarLeida}
        onAutoMarcar={cambiarAutoMarcar}
        movimientoReducido={movimientoReducido}
        onMovimiento={cambiarMovimiento}
        densidad={densidad}
        onDensidad={cambiarDensidad}
        nombreUsuario={session?.user?.name || session?.user?.email || null}
        emailUsuario={esInvitado ? null : session?.user?.email || null}
        imagenUsuario={esInvitado ? null : session?.user?.image || null}
        esInvitado={esInvitado}
        onEditarPerfil={() => {
          setPanelAjustes(false);
          setIsPerfilOpen(true);
        }}
        onCerrarSesion={salirInvitado}
        pushSoportado={pushSoportado}
        pushActivado={pushActivado}
        pushCargando={pushCargando}
        onGestionarPush={gestionarPush}
        estadisticas={{
          fuentes: fuentesDisponibles.length,
          pendientes: conteos.pendientes,
          leidas: conteos.leidas,
          guardadas: conteos.guardadas,
        }}
        onNotify={notify}
        onAbrirGuia={() => setShowWelcomeModal(true)}
      />
      <AddFeedModal
        key={isAddModalOpen ? `agregar-${urlCompartida || "manual"}` : "agregar-cerrado"}
        isOpen={isAddModalOpen}
        initialUrl={urlCompartida}
        onClose={() => {
          setIsAddModalOpen(false);
          setUrlCompartida("");
        }}
        onSuccess={async (data) => {
          setPagina(1);
          setNonceRecarga((n) => n + 1);
          fetchSources();
          fetchConteos();
          if (Number(data?.pendientes) > 0) {
            notify(t("avisos.cola_agregada"), "success");
            procesarColaClasificacion();
          }
        }}
      />
      <ManageSourcesModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        onAgregarFuente={() => {
          setIsManageModalOpen(false);
          setIsAddModalOpen(true);
        }}
        onChange={() => {
          setPagina(1);
          setNonceRecarga((n) => n + 1);
          fetchSources();
          fetchConteos();
        }}
        onNotify={notify}
      />
      {!panelMovilAbierto && <GitHubCard />}
      {!esInvitado && (
      <PerfilModal
        key={isPerfilOpen ? "perfil-abierto" : "perfil-cerrado"}
        isOpen={isPerfilOpen}
        onClose={() => setIsPerfilOpen(false)}
        onSuccess={() => recargarSesion()}
        onNotify={notify}
      />
      )}
      <ConfirmDeleteModal
        abierto={confirmarEliminar}
        onCancelar={() => setConfirmarEliminar(false)}
        onConfirmar={confirmarEliminarTodas}
        t={t}
      />
      <Toast toast={toast} />
    </div>
  );
}