// src/app/page.js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import GitHubCard from "./components/GitHubCard";
import NewsFeed from "./components/NewsFeed";
import MorphIcon from "./components/MorphIcon";
import { Plus, Search, LayoutGrid, Rows, AlignJustify, Keyboard, WifiOff } from "lucide-react";
import { Filter as FilterData, X as XData } from "lucide";

import { TEMA_POR_DEFECTO, aplicarTema, temaInicial } from "@/lib/temas";
import { useIdioma } from "@/lib/i18n";
import { urlBase64ToUint8Array } from "@/lib/feed-utils";
import { bumpCacheVersion } from "@/lib/fetchCache";
import { inicializarMicrointeracciones } from "@/lib/animaciones";

import { useSourcesManager } from "@/lib/hooks/useSourcesManager";
import { useIACategorizer } from "@/lib/hooks/useIACategorizer";
import { useFeedState } from "@/lib/hooks/useFeedState";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";


import AppHeader from "./components/dashboard/AppHeader";
import StatsCards from "./components/dashboard/StatsCards";
import Paginacion from "./components/dashboard/Paginacion";
import Toast from "./components/dashboard/Toast";
import IAProgressCard from "./components/dashboard/IAProgressCard";
import OnboardingSurvey from "./components/dashboard/OnboardingSurvey";
import ConfirmDeleteModal from "./components/dashboard/ConfirmDeleteModal";
import DashboardSidebar from "./components/dashboard/DashboardSidebar";
import KeyboardShortcutsModal from "./components/dashboard/KeyboardShortcutsModal";

// Modales diferidos: no entran al bundle inicial, se cargan al abrirse.
const AddFeedModal = dynamic(() => import("./components/AddFeedModal"), { ssr: false });
const ManageSourcesModal = dynamic(() => import("./components/ManageSourcesModal"), { ssr: false });
const PerfilModal = dynamic(() => import("./components/PerfilModal"), { ssr: false });
const AjustesPanel = dynamic(() => import("./components/AjustesPanel"), { ssr: false });

export default function HomePage() {
  const router = useRouter();
  const { t, locale } = useIdioma();

  // Inyecta public/tema-inicial.js sin usar <script>
  // en JSX (Turbopack advierte sobre scripts dentro de componentes React).
  // useEffect (no useLayoutEffect) para no romper la hidratación.
  useEffect(() => {
    try {
      if (document.querySelector('script[data-tema-inicial]')) return;
      const script = document.createElement('script');
      script.src = '/tema-inicial.js';
      script.dataset.temaInicial = '1';
      document.head.appendChild(script);
    } catch {
      // Sin DOM disponible: se aplican los valores por defecto del CSS.
    }
  }, []);

  // Conectividad de red
  const estaOnline = true; // determinista: evita hydration mismatch; 
  // el event listener de online/offline (useOnlineStatus) se activa post-hidratación

  // Estados de sesión y carga
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Notificaciones Toast
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, type = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
  }, []);

  // Web Share Target (?compartir=)
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

  // Modales
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isPerfilOpen, setIsPerfilOpen] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [showOnboardingSurvey, setShowOnboardingSurvey] = useState(false);
  const [panelAjustes, setPanelAjustes] = useState(false);

  // Estados visuales del sidebar y controles
  const [controlsOpen, setControlsOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [panelMovilAbierto, setPanelMovilAbierto] = useState(false);

  // Push Notifications
  const [pushSoportado, setPushSoportado] = useState(false);
  const [pushActivado, setPushActivado] = useState(false);
  const [pushCargando, setPushCargando] = useState(false);

  // Atajos de teclado y selección activa
  const searchInputRef = useRef(null);
  const [articuloActivoId, setArticuloActivoId] = useState(null);
  const [articuloParaAbrir, setArticuloParaAbrir] = useState(null);
  const [ayudaAtajosAbierta, setAyudaAtajosAbierta] = useState(false);

  // Modo de vista: "cards" | "magazine" | "compact"
  const [modoVista, setModoVista] = useState(() => {
    try {
      const guardado = window.localStorage.getItem("lector_modo_vista");
      return ["cards", "magazine", "compact"].includes(guardado) ? guardado : "cards";
    } catch {
      return "cards";
    }
  });

  const cambiarModoVista = useCallback((nuevoModo) => {
    try {
      window.localStorage.setItem("lector_modo_vista", nuevoModo);
    } catch {
      // Ignorar
    }
    setModoVista(nuevoModo);
  }, []);

  // Preferencias de usuario
  const [tema, setTema] = useState(() => {
    try {
      return temaInicial();
    } catch {
      return TEMA_POR_DEFECTO;
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
      return window.localStorage.getItem("lector_densidad") === "compacta" ? "compacta" : "comoda";
    } catch {
      return "comoda";
    }
  });

  // Hook de Fuentes y Conteos
  const {
    sourcesList,
    conteos,
    setConteos,
    categoriasDisponibles,
    setCategoriasDisponibles,
    nonceRecarga,
    recargarDatos,
    fetchSources,
    fetchConteos,
  } = useSourcesManager(session);

  // Hook de Clasificación IA
  const { iaProgreso, setIaProgreso, handleCategorizarIA, procesarColaClasificacion } =
    useIACategorizer({ session, recargarDatos, notify, t });

  // Hook de Estado del Feed
  const {
    activeTab,
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
  } = useFeedState({
    session,
    fuentesDisponibles: sourcesList,
    categoriasDisponibles,
    setCategoriasDisponibles,
    nonceRecarga,
    recargarDatos,
    fetchConteos,
    notify,
    t,
  });

  const algunModalAbierto = Boolean(
    isAddModalOpen ||
      isManageModalOpen ||
      isPerfilOpen ||
      confirmarEliminar ||
      showOnboardingSurvey ||
      panelAjustes ||
      ayudaAtajosAbierta ||
      articuloParaAbrir
  );

  useKeyboardShortcuts({
    articles: articulos,
    articuloActivoId,
    setArticuloActivoId,
    onAbrirArticulo: (art) => setArticuloParaAbrir(art),
    onToggleRead: toggleLeido,
    onToggleSave: toggleGuardado,
    onDelete: descartarArticulo,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCambiarTab: seleccionarTab,
    onToggleAyuda: () => setAyudaAtajosAbierta((prev) => !prev),
    modalAbierto: algunModalAbierto,
  });

  const esInvitado = Boolean(session?.user?.invitado);

  const salirInvitado = useCallback(async () => {
    try {
      await fetch("/api/auth/invitado", { method: "DELETE" });
    } catch {
      // Limpieza local de todas formas
    }
    setSession(null);
    setArticulos([]);
    bumpCacheVersion();
    setPagina(1);
    setTotalNoticias(0);
    setConteos({ pendientes: 0, leidas: 0, guardadas: 0 });
    router.push("/login");
  }, [router, setArticulos, setConteos, setPagina, setTotalNoticias]);

  const recargarSesion = useCallback(async () => {
    try {
      const resAuth = await fetch("/api/auth/session", { cache: "no-store" });
      const sessionData = await resAuth.json();
      if (sessionData?.user) {
        setSession(sessionData);
      }
    } catch (err) {
      console.error("Error al recargar sesión:", err);
    }
  }, []);

  const irAGestionFuentes = useCallback(() => {
    setIsManageModalOpen(true);
  }, []);

  // Microinteracciones y Service Worker
  useEffect(() => {
    const limpiar = inicializarMicrointeracciones(document);
    return limpiar;
  }, []);

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

  // Limpiar parámetro ?compartir=
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).has("compartir")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch {
      // Ignorar
    }
  }, []);

  // Aplicar tema, movimiento y densidad
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
      // Ignorar
    }
  }, [tema]);

  const cambiarDensidad = (valor) => {
    const normalizada = valor === "compacta" ? "compacta" : "comoda";
    try {
      window.localStorage.setItem("lector_densidad", normalizada);
      if (normalizada === "compacta") document.documentElement.dataset.densidad = "compacta";
      else delete document.documentElement.dataset.densidad;
    } catch {
      // Ignorar
    }
    setDensidad(normalizada);
  };

  const cambiarTema = useCallback((id) => {
    setTema(aplicarTema(id).id);
  }, []);

  const cambiarAutoMarcar = (valor) => {
    try {
      window.localStorage.setItem("lector_auto_leido", valor ? "1" : "0");
    } catch {
      // Ignorar
    }
    setAutoMarcarLeida(valor);
  };

  const cambiarMovimiento = (valor) => {
    try {
      window.localStorage.setItem("lector_movimiento", valor ? "reducido" : "completo");
      if (valor) document.documentElement.dataset.motion = "reduced";
      else delete document.documentElement.dataset.motion;
    } catch {
      // Ignorar
    }
    setMovimientoReducido(valor);
  };

  // Carga inicial de sesión
  useEffect(() => {
    const controller = new AbortController();

    async function loadSession() {
      try {
        const resAuth = await fetch("/api/auth/session", { signal: controller.signal });
        const sessionData = await resAuth.json();

        if (controller.signal.aborted) return;

        if (sessionData?.user) {
          setSession(sessionData);
          if (Number(sessionData.user?.bienvenidaVista ?? 1) === 0) {
            setShowOnboardingSurvey(true);
          }
        } else {
          try {
            const resInvitado = await fetch("/api/auth/invitado", {
              cache: "no-store",
              signal: controller.signal,
            });
            if (!resInvitado.ok || controller.signal.aborted) return;
            setSession({ user: { name: "Invitado", invitado: true } });
            let guiaVista = false;
            try {
              guiaVista = Boolean(
                localStorage.getItem("guest_has_seen_onboarding") ||
                  localStorage.getItem("welcome_seen_invitado")
              );
            } catch {
              // Ignorar
            }
            if (!guiaVista) setShowOnboardingSurvey(true);
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

  const closeOnboardingSurvey = () => {
    if (session?.user) {
      const clave = esInvitado
        ? "guest_has_seen_onboarding"
        : `welcome_seen_${session.user.email || session.user.id}`;
      try {
        localStorage.setItem(clave, "true");
      } catch {
        // Ignorar
      }
      if (!esInvitado) {
        setSession((previa) =>
          previa?.user ? { ...previa, user: { ...previa.user, bienvenidaVista: 1 } } : previa
        );
        fetch("/api/bienvenida", { method: "POST" }).catch(() => {});
      }
    }
    setShowOnboardingSurvey(false);
    handleCategorizarIA({ silencioso: true });
  };

  const handleAgregarFuenteOnboarding = useCallback(
    async (titulo, url_feed, categoria, opciones = {}) => {
      try {
        const res = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url_feed: url_feed.trim(),
            categoria: (categoria || "General").trim(),
            ...(opciones.forzar_conversion === true ? { forzar_conversion: true } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 409) throw new Error(data.error || t("fuentes.err_conexion"));
        setPagina(1);
        recargarDatos();
        fetchSources();
        fetchConteos();
        if (Number(data?.pendientes) > 0) {
          notify(t("avisos.cola_agregada"), "success");
        }
        handleCategorizarIA({ silencioso: true });
        return data;
      } catch (err) {
        console.error("Error agregando fuente desde onboarding:", err);
        throw err;
      }
    },
    [fetchConteos, fetchSources, handleCategorizarIA, notify, recargarDatos, setPagina, t]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    bumpCacheVersion();
    try {
      const response = await fetch("/api/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", restore_today: true }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(t("avisos.refresh_err_fuentes"));
      const data = await response.json().catch(() => ({}));

      if (pagina === 1) recargarDatos();
      else setPagina(1);
      fetchSources();
      fetchConteos();
      const restaurados = Number(data.restaurados) || 0;
      const pendientes = Number(data.pendientes) || 0;
      const omitidas = Number(data.omitidas) || 0;
      const purgados = Number(data.purgados) || 0;
      const nuevos = Number(data.nuevos) || 0;
      const sinCambios =
        data.fuentesSinCambios !== undefined && data.fuentesSinCambios !== null
          ? Number(data.fuentesSinCambios) || 0
          : omitidas;
      let mensaje =
        restaurados > 0
          ? t("avisos.refresh_restauradas", { n: restaurados })
          : t("avisos.refresh_ok");
      if (nuevos > 0) mensaje += t("avisos.refresh_nuevas", { n: nuevos });
      if (sinCambios > 0) mensaje += t("avisos.sin_cambios", { n: sinCambios });
      if (purgados > 0) mensaje += t("avisos.purgadas", { n: purgados });
      if (pendientes > 0) {
        mensaje += t("avisos.completando", { n: pendientes });
        procesarColaClasificacion();
      }
      notify(mensaje, "success");
      if (nuevos > 0) handleCategorizarIA({ silencioso: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Error al refrescar las noticias:", err);
      notify(err.message || t("avisos.refresh_err_feed"), "error");
    } finally {
      setRefreshing(false);
    }
  };

  const confirmarEliminarTodas = async () => {
    setConfirmarEliminar(false);
    bumpCacheVersion();
    const backupArticulos = [...articulos];
    setArticulos([]);
    setTotalNoticias(0);

    const backupConteos = { ...conteos };
    const claveTab = activeTab === "guardadas" ? "guardadas" : activeTab === "leidas" ? "leidas" : "pendientes";
    setConteos((prev) => ({ ...prev, [claveTab]: 0 }));

    try {
      const res = await fetch(`/api/rss?delete_all=true&tab=${activeTab}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("avisos.eliminar_err"));
      setPagina(1);
      recargarDatos();
      fetchConteos();
      notify(t("avisos.eliminadas_ok"), "success");
    } catch (err) {
      console.error("Error al eliminar todas las noticias:", err);
      setArticulos(backupArticulos);
      setConteos(backupConteos);
      recargarDatos();
      fetchConteos();
      notify(err.message || t("avisos.eliminar_feed"), "error");
    }
  };

  const tarjetasStats = [
    {
      label: t("stats.pendientes"),
      value: conteos.pendientes,
      color: "text-sky-300",
      tab: "todas",
      titulo: t("stats.ver_pendientes"),
      activo: "border-sky-500/60 ring-1 ring-sky-500/40",
    },
    {
      label: t("stats.leidas"),
      value: conteos.leidas,
      color: "text-emerald-300",
      tab: "leidas",
      titulo: t("stats.ver_leidas"),
      activo: "border-emerald-500/60 ring-1 ring-emerald-500/40",
    },
    {
      label: t("stats.guardadas"),
      value: conteos.guardadas,
      color: "text-amber-300",
      tab: "guardadas",
      titulo: t("stats.ver_guardadas"),
      activo: "border-amber-500/60 ring-1 ring-amber-500/40",
    },
    {
      label: t("stats.fuentes"),
      value: sourcesList.length,
      color: "text-cyan-300",
      tab: null,
      titulo: t("stats.ir_fuentes"),
      activo: "",
    },
  ];

  return (
    <div className="app-ambient min-h-screen bg-app-bg text-app-fg flex flex-col">
      <div aria-hidden="true" className="grain-overlay" />
      <AppHeader
        session={session}
        esInvitado={esInvitado}
        panelAjustes={panelAjustes}
        onAbrirAjustes={() => setPanelAjustes(true)}
        t={t}
      />

      {!estaOnline && (
        <div className="mx-auto mt-3 w-full max-w-[1440px] px-3 sm:px-6 anim-fade-in">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 flex items-center justify-center gap-2 text-center text-xs text-amber-200 shadow-sm">
            <WifiOff size={14} className="shrink-0 text-amber-400" />
            <span>
              <strong>Modo sin conexión:</strong> Estás navegando sin internet. Tus artículos guardados siguen disponibles en la pestaña <em>Guardadas</em> gracias a IndexedDB.
            </span>
          </div>
        </div>
      )}

      {esInvitado && (
        <div className="mx-auto mt-3 w-full max-w-[1440px] px-3 sm:px-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center justify-center gap-2 text-center">
            <p className="text-xs text-amber-200">
              {t("invitado.aviso_1")} <strong>{t("header.invitado").toLowerCase()}</strong>:{" "}
              {t("invitado.aviso_2")}{" "}
              <Link href="/register" className="underline font-medium">
                {t("invitado.crear")}
              </Link>{" "}
              {t("invitado.aviso_3")}
            </p>
          </div>
        </div>
      )}

      {/* Contenido Principal */}
      <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-3 py-6 sm:px-6 sm:py-8 flex-1 outline-none">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label={t("vacio.cargando")}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                style={{ "--stagger-delay": `${Math.min(index * 60, 300)}ms` }}
                className="stagger-in skeleton-shimmer h-48 rounded-2xl"
              />
            ))}
          </div>
        ) : session?.user ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            {/* Columna Izquierda: Noticias */}
            <div className="contents lg:col-span-3 lg:block lg:space-y-6">
              <StatsCards
                tarjetas={tarjetasStats}
                activeTab={activeTab}
                onSeleccionarTab={seleccionarTab}
                onIrFuentes={irAGestionFuentes}
              />

              <div className="order-3 lg:order-none flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <label className="relative flex-1 rounded-2xl border border-app-line bg-app-surface transition duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:border-[var(--accent)]/70 focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={t("buscar.ph")}
                    aria-label={t("buscar.aria")}
                    className="w-full bg-transparent rounded-2xl pl-9 pr-3 py-2.5 text-sm text-app-fg placeholder:text-app-muted outline-none"
                  />
                </label>

                {/* Selector de Modos de Vista y Atajos de Teclado */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                  <div className="flex items-center rounded-xl border border-app-line bg-app-surface p-1 text-app-muted">
                    <button
                      type="button"
                      onClick={() => cambiarModoVista("cards")}
                      title="Vista cuadrícula de tarjetas"
                      aria-label="Vista cuadrícula de tarjetas"
                      className={`btn-press p-1.5 rounded-lg transition ${
                        modoVista === "cards"
                          ? "bg-[var(--accent)]/15 text-[var(--accent-ink)] font-bold shadow-sm"
                          : "hover:text-app-fg hover:bg-app-raised"
                      }`}
                    >
                      <LayoutGrid size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarModoVista("magazine")}
                      title="Vista revista (horizontal)"
                      aria-label="Vista revista (horizontal)"
                      className={`btn-press p-1.5 rounded-lg transition ${
                        modoVista === "magazine"
                          ? "bg-[var(--accent)]/15 text-[var(--accent-ink)] font-bold shadow-sm"
                          : "hover:text-app-fg hover:bg-app-raised"
                      }`}
                    >
                      <Rows size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarModoVista("compact")}
                      title="Vista titulares compactos"
                      aria-label="Vista titulares compactos"
                      className={`btn-press p-1.5 rounded-lg transition ${
                        modoVista === "compact"
                          ? "bg-[var(--accent)]/15 text-[var(--accent-ink)] font-bold shadow-sm"
                          : "hover:text-app-fg hover:bg-app-raised"
                      }`}
                    >
                      <AlignJustify size={15} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAyudaAtajosAbierta(true)}
                    title="Atajos de teclado (?)"
                    aria-label="Atajos de teclado"
                    className="btn-press flex items-center gap-1 px-2.5 py-2 rounded-xl border border-app-line bg-app-surface text-app-muted hover:text-app-fg hover:border-[var(--accent)]/60 transition text-xs"
                  >
                    <Keyboard size={15} />
                    <span className="hidden xl:inline text-[11px] font-mono">?</span>
                  </button>

                  <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline pl-1">
                    {lastUpdated
                      ? t("buscar.actualizado", {
                          hora: lastUpdated.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
                        })
                      : t("buscar.sin")}
                  </span>
                </div>
              </div>

              <div className="order-4 lg:order-none">
                {cargandoFeed && articulos.length === 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-label={t("vacio.cargando")}>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div key={index} className="skeleton-shimmer h-48 rounded-2xl" />
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
                          className="btn-press group inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90"
                        >
                          <Plus size={16} /> {t("vacio.agregar")}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <NewsFeed
                      articles={articulos}
                      tab={activeTab}
                      modoVista={modoVista}
                      articuloActivoId={articuloActivoId}
                      articuloParaAbrir={articuloParaAbrir}
                      onLectorCerrado={() => setArticuloParaAbrir(null)}
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

            {/* Columna Derecha: Sidebar de Filtros y Controles */}
            {panelMovilAbierto && (
              <div
                aria-hidden="true"
                onClick={() => setPanelMovilAbierto(false)}
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
              />
            )}
            <button
              type="button"
              onClick={() => setPanelMovilAbierto((prev) => !prev)}
              title={t("controles.abrir")}
              aria-label={t("controles.abrir")}
              aria-expanded={panelMovilAbierto}
              className="btn-press fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-transparent bg-[var(--accent-strong)] p-2.5 text-[var(--on-accent-strong)] hover:opacity-90 lg:hidden"
            >
              <span className="relative block">
                <MorphIcon icon={panelMovilAbierto ? XData : FilterData} size={21} strokeWidth={2.25} />
                {hayFiltrosActivos && (
                  <span aria-hidden="true" className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400" />
                )}
              </span>
            </button>

            <DashboardSidebar
              controlsOpen={controlsOpen}
              setControlsOpen={setControlsOpen}
              filtersOpen={filtersOpen}
              setFiltersOpen={setFiltersOpen}
              panelMovilAbierto={panelMovilAbierto}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onCategorizarIA={handleCategorizarIA}
              iaProgreso={iaProgreso}
              onEliminarTodas={() => setConfirmarEliminar(true)}
              onManageSources={() => setIsManageModalOpen(true)}
              isManageModalOpen={isManageModalOpen}
              activeTab={activeTab}
              onSeleccionarTab={seleccionarTab}
              tamanoPagina={tamanoPagina}
              onCambiarTamanoPagina={cambiarTamanoPagina}
              onOpenOnboarding={() => setShowOnboardingSurvey(true)}
              hayFiltrosActivos={hayFiltrosActivos}
              numFiltrosActivos={numFiltrosActivos}
              onLimpiarFiltros={limpiarFiltros}
              orden={orden}
              onCambiarOrden={cambiarOrden}
              filtroIA={filtroIA}
              onCambiarFiltroIA={cambiarFiltroIA}
              fuentesDisponibles={sourcesList}
              fuentesSeleccionadas={fuentesSeleccionadas}
              onAlternarFuente={alternarFuente}
              onSeleccionarTodasFuentes={seleccionarTodasFuentes}
              categoriasDisponibles={categoriasDisponibles}
              categoriasSeleccionadas={categoriasSeleccionadas}
              onAlternarCategoria={alternarCategoria}
              onSeleccionarTodasCategorias={seleccionarTodasCategorias}
              t={t}
            />
          </div>
        ) : (
          <div className="text-center py-20 max-w-2xl mx-auto space-y-6">
            <div className="inline-flex items-center justify-center p-3 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20 mb-2">
              <Plus size={32} />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">{t("landing.titulo")}</h2>
            <p className="text-gray-400 leading-relaxed">{t("landing.texto")}</p>
            <div className="flex justify-center gap-4 pt-4">
              <Link
                href="/login"
                className="bg-sky-600 hover:bg-sky-500 text-white font-medium px-6 py-2.5 rounded-xl transition hover:shadow-lg hover:shadow-sky-600/20"
              >
                {t("landing.comenzar")}
              </Link>
            </div>
          </div>
        )}
      </main>

      <footer className="mx-auto w-full max-w-[1440px] px-3 pb-8 sm:px-6">
        <div className="flex flex-col gap-3 rounded-2xl border border-app-line bg-app-surface/60 px-4 py-4 text-xs text-app-muted backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-pretty">
            <strong className="font-semibold text-app-fg">RSS Dashboard</strong>
            {" — "}
            Tus fuentes, clasificadas y listas para leer.
          </p>
          <nav aria-label="Legal" className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/" className="transition hover:text-app-fg">
              Inicio
            </Link>
            <span aria-hidden="true" className="text-app-line">/</span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: movimientoReducido ? "auto" : "smooth" })}
              className="btn-press transition hover:text-app-fg"
            >
              Volver arriba
            </button>
            <span aria-hidden="true" className="text-app-line">/</span>
            <span>{new Date().getFullYear()} RSS Dashboard</span>
          </nav>
        </div>
      </footer>

      <OnboardingSurvey
        key={showOnboardingSurvey ? "guia-abierta" : "guia-cerrada"}
        abierto={showOnboardingSurvey}
        onCerrar={closeOnboardingSurvey}
        t={t}
        onCompletado={handleRefresh}
        onAgregarFuente={handleAgregarFuenteOnboarding}
      />

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
          fuentes: sourcesList.length,
          pendientes: conteos.pendientes,
          leidas: conteos.leidas,
          guardadas: conteos.guardadas,
        }}
        onNotify={notify}
        onAbrirGuia={() => setShowOnboardingSurvey(true)}
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
          recargarDatos();
          fetchSources();
          fetchConteos();
          if (data?.convertida) {
            notify(t("avisos.fuente_convertida"), "success");
          }
          if (Number(data?.pendientes) > 0) {
            notify(t("avisos.cola_agregada"), "success");
          }
          handleCategorizarIA({ silencioso: true });
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
          recargarDatos();
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
        seccion={{
          nombre:
            activeTab === "guardadas"
              ? t("stats.guardadas")
              : activeTab === "leidas"
              ? t("stats.leidas")
              : t("stats.pendientes"),
          total:
            activeTab === "guardadas"
              ? conteos.guardadas
              : activeTab === "leidas"
              ? conteos.leidas
              : conteos.pendientes,
        }}
      />

      <Toast toast={toast} />
      <IAProgressCard progreso={iaProgreso} onCerrar={() => setIaProgreso(null)} t={t} />
      <KeyboardShortcutsModal
        abierto={ayudaAtajosAbierta}
        onCerrar={() => setAyudaAtajosAbierta(false)}
        t={t}
      />
    </div>
  );
}