// src/app/page.js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import dynamic from "next/dynamic";
import GitHubCard from "./components/GitHubCard";
import NewsFeed from "./components/NewsFeed";
import MorphIcon from "./components/MorphIcon";
import { Plus, Search, LayoutGrid, Rows, AlignJustify, Keyboard, WifiOff, SearchX, TriangleAlert, RotateCw } from "lucide-react";
import { Filter as FilterData, X as XData } from "lucide";

import { TEMA_POR_DEFECTO, aplicarTema, temaInicial } from "@/lib/temas";
import { FUENTE_POR_DEFECTO, FUENTE_PX_DEFECTO, FUENTE_PX_MIN, FUENTE_PX_MAX, aplicarFuente, aplicarFuentePx, fuenteInicial, fuentePxInicial } from "@/lib/fuentes";
import { useIdioma } from "@/lib/i18n";
import { urlBase64ToUint8Array } from "@/lib/feed-utils";
import { useCapaGuardia, useCapaHistorial } from "@/lib/historialCapas";
import { bumpCacheVersion } from "@/lib/fetchCache";
import { inicializarMicrointeracciones } from "@/lib/animaciones";
import { aplicarAparienciaBase, purgarSesionLocal } from "@/lib/ajustesPorDefecto";

import { useSourcesManager } from "@/lib/hooks/useSourcesManager";
import { useIACategorizer } from "@/lib/hooks/useIACategorizer";
import { useNotificaciones } from "@/lib/hooks/useNotificaciones";
import { useFeedState } from "@/lib/hooks/useFeedState";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";


import AppHeader from "./components/dashboard/AppHeader";
import StatsCards from "./components/dashboard/StatsCards";
import Paginacion from "./components/dashboard/Paginacion";
import NotificationPanel from "./components/NotificationPanel";
import OnboardingSurvey from "./components/dashboard/OnboardingSurvey";
import ConfirmDeleteModal from "./components/dashboard/ConfirmDeleteModal";
import DashboardSidebar from "./components/dashboard/DashboardSidebar";
import KeyboardShortcutsModal from "./components/dashboard/KeyboardShortcutsModal";

// Modales diferidos: no entran al bundle inicial, se cargan al abrirse.
const AddFeedModal = dynamic(() => import("./components/AddFeedModal"), { ssr: false });
const ManageSourcesModal = dynamic(() => import("./components/ManageSourcesModal"), { ssr: false });
const PerfilModal = dynamic(() => import("./components/PerfilModal"), { ssr: false });
const AjustesPanel = dynamic(() => import("./components/AjustesPanel"), { ssr: false });

// Filtro local "Hoy": compara fecha de publicación con el día local.
// Solo memoria, cero backend (las pestañas de StatsCards ya cubren los
// estados leído/guardado en servidor; duplicarlas aquí saturaría la UI).
function esDeHoy(fechaStr) {
  if (!fechaStr) return false;
  const f = new Date(fechaStr);
  if (Number.isNaN(f.getTime())) return false;
  const ahora = new Date();
  return (
    f.getFullYear() === ahora.getFullYear() &&
    f.getMonth() === ahora.getMonth() &&
    f.getDate() === ahora.getDate()
  );
}

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
  const busquedaZonaRef = useRef(null);
  const [busquedaVisible, setBusquedaVisible] = useState(true);

  // La lupa del header aparece solo cuando la barra de búsqueda sale de vista.
  useEffect(() => {
    const el = busquedaZonaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const obs = new IntersectionObserver(
      ([entrada]) => setBusquedaVisible(entrada.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [session, loading]);

  const irABusqueda = useCallback(() => {
    try {
      busquedaZonaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => searchInputRef.current?.focus({ preventScroll: true }), 450);
    } catch {
      try {
        searchInputRef.current?.focus();
      } catch {
        // Sin DOM disponible.
      }
    }
  }, []);
  const [articuloActivoId, setArticuloActivoId] = useState(null);
  const [articuloParaAbrir, setArticuloParaAbrir] = useState(null);
  const [ayudaAtajosAbierta, setAyudaAtajosAbierta] = useState(false);

  // Modo de vista: "cards" | "magazine" | "compact"
  const [modoVista, setModoVista] = useState(() => {    try {
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

  // Píldora rápida "Hoy": filtro 100% local sobre la página cargada.
  const [soloHoy, setSoloHoy] = useState(false);

  // Preferencias de usuario
  const [tema, setTema] = useState(() => {
    try {
      return temaInicial();
    } catch {
      return TEMA_POR_DEFECTO;
    }
  });
  const [fuenteApp, setFuenteApp] = useState(() => {
    try {
      return fuenteInicial();
    } catch {
      return FUENTE_POR_DEFECTO;
    }
  });
  const [fuentePx, setFuentePx] = useState(() => {
    try {
      return fuentePxInicial();
    } catch {
      return FUENTE_PX_DEFECTO;
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
    errorFeed,
    lastUpdated,
    modoCache,
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

  // Parche instantáneo por lote IA: actualiza categorías en sitio sin
  // refetch completo (el dashboard sigue fluido durante la corrida). Bajo el
  // filtro "Pendientes de IA", lo recién clasificado con categoría real se
  // excluye en vista local (mismo optimismo que guardado), con su total.
  const aplicarLoteIA = useCallback((resultados) => {
    if (!Array.isArray(resultados) || resultados.length === 0) return;
    const mapa = new Map(
      resultados
        .filter((r) => r && r.id !== undefined && r.id !== null && r.categoria)
        .map((r) => [Number(r.id), r])
    );
    if (mapa.size === 0) return;
    const esReal = (c) => {
      const s = String(c || "").trim().toLowerCase();
      return s !== "" && s !== "general";
    };
    let excluidos = 0;
    setArticulos((prev) => {
      const next = [];
      for (const art of prev) {
        const r = mapa.get(Number(art.id));
        if (!r) {
          next.push(art);
          continue;
        }
        if (filtroIA === "sin_ia" && esReal(r.categoria)) {
          excluidos += 1;
          continue;
        }
        next.push({
          ...art,
          categoria: r.categoria,
          clasificacion_metodo: r.metodo || art.clasificacion_metodo,
          clasificacion_confianza:
            r.confianza !== undefined && r.confianza !== null
              ? r.confianza
              : art.clasificacion_confianza,
        });
      }
      return next;
    });
    if (excluidos > 0) {
      setTotalNoticias((prev) => Math.max((Number(prev) || excluidos) - excluidos, 0));
    }
    bumpCacheVersion();
  }, [setArticulos, setTotalNoticias, filtroIA]);

  // Hook de Clasificación IA
  const { iaProgreso, handleCategorizarIA, procesarColaClasificacion } =
    useIACategorizer({ session, recargarDatos, fetchConteos, onLoteClasificado: aplicarLoteIA, notify, t });

  // Bandeja central de notificaciones (campanita del header + panel lateral).
  const {
    items: notificaciones,
    abierta: notifsAbiertas,
    fijarAbierta: fijarNotifs,
    noLeidas: noLeidasNotifs,
    iaEnCurso: iaEnCursoNotifs,
    eliminarUna: eliminarNotif,
    marcarLeida: marcarNotifLeida,
    marcarTodasLeidas: marcarNotifsLeidas,
    eliminarSeleccionadas: eliminarNotifsSel,
  } = useNotificaciones({ toast, onCerrarToast: () => setToast(null), iaProgreso });

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

  const esInvitado = Boolean(session?.user?.invitado);

  // Vista filtrada "Hoy": subconjunto en memoria de la página cargada.
  const articulosVisibles = soloHoy ? articulos.filter((a) => esDeHoy(a?.fecha_publicacion)) : articulos;
  const horaCache = (() => {
    try {
      if (!modoCache?.fecha) return "";
      return new Date(modoCache.fecha).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  })();

  // Vuelve todo a base (purga local + DOM + estados React): la vista de
  // autenticación pinta el tema del sistema, no el personalizado anterior.
  const restablecerSesionBase = useCallback(() => {
    purgarSesionLocal();
    const base = aplicarAparienciaBase();
    setTema(base.tema);
    setFuenteApp(base.fuente);
    setFuentePx(base.fuentePx);
    setDensidad("comoda");
    setMovimientoReducido(false);
    setAutoMarcarLeida(false);
  }, [setTema, setFuenteApp, setFuentePx, setDensidad, setMovimientoReducido, setAutoMarcarLeida]);

  const salirInvitado = useCallback(async () => {
    try {
      await fetch("/api/auth/invitado", { method: "DELETE" });
    } catch {
      // Limpieza local de todas formas
    }
    restablecerSesionBase();
    setSession(null);
    setArticulos([]);
    bumpCacheVersion();
    setPagina(1);
    setTotalNoticias(0);
    setConteos({ pendientes: 0, leidas: 0, guardadas: 0 });
    router.push("/login");
  }, [router, restablecerSesionBase, setArticulos, setConteos, setPagina, setTotalNoticias]);

  // Guardia persistente de salida: se registra ANTES que cualquier capa para
  // que el centinela quede debajo (un registro invertido en el mismo commit
  // disparaba el diálogo fantasma al cerrar la guía de bienvenida).
  // Feed→atrás→diálogo→atrás→feed, sin expulsiones a login.
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  // Ref de sesión para el handler: el diálogo solo se abre con sesión; antes
  // de que resuelva la carga (backend lento) el atrás se absorbe sin expulsar
  // en vez de dejar la ventana sin guardia.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  });
  const hayCapaSobreGuardia = useCallback(() => Boolean(
    isAddModalOpen ||
      isManageModalOpen ||
      isPerfilOpen ||
      confirmarEliminar ||
      showOnboardingSurvey ||
      panelAjustes ||
      ayudaAtajosAbierta ||
      articuloParaAbrir ||
      notifsAbiertas ||
      panelMovilAbierto
  ), [
    isAddModalOpen,
    isManageModalOpen,
    isPerfilOpen,
    confirmarEliminar,
    showOnboardingSurvey,
    panelAjustes,
    ayudaAtajosAbierta,
    articuloParaAbrir,
    notifsAbiertas,
    panelMovilAbierto,
  ]);
  // La guardia vive desde la carga (cubre la ventana lenta del backend) y
  // se desarma sin sesión tras cargar: el visitante navega atrás normal.
  useCapaGuardia(!loading, () => {
    if (sessionRef.current?.user) setConfirmarSalida(true);
  }, hayCapaSobreGuardia);
  const cerrarDialogoSalida = useCapaHistorial(confirmarSalida, () => setConfirmarSalida(false));

  useEffect(() => {
    if (!confirmarSalida) return undefined;
    const alTecla = (event) => {
      if (event.key === "Escape") cerrarDialogoSalida();
    };
    document.addEventListener("keydown", alTecla);
    return () => document.removeEventListener("keydown", alTecla);
  }, [confirmarSalida, cerrarDialogoSalida]);

  const confirmarSalidaSesion = async () => {
    setConfirmarSalida(false);
    if (esInvitado) {
      await salirInvitado();
      return;
    }
    try {
      restablecerSesionBase();
    } catch {
      // La purga nunca bloquea la salida.
    }
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      router.push("/login");
    }
  };

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

  const cambiarFuente = useCallback((id) => {
    setFuenteApp(aplicarFuente(id).id);
  }, []);

  const cambiarFuentePx = useCallback((valor) => {
    setFuentePx(aplicarFuentePx(valor));
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

  // Capas navegables: cada modal/panel abierto empuja una entrada al historial
  // del navegador; el gesto/botón atrás del móvil cierra la capa superior en
  // vez de expulsar la sesión (p. ej. al login de Google). Los `cerrar*` van a
  // TODAS las vías de cierre (botón X, overlay, Escape, toggles).
  const cerrarAdd = useCapaHistorial(isAddModalOpen, () => {
    setIsAddModalOpen(false);
    setUrlCompartida("");
  });
  const cerrarManage = useCapaHistorial(isManageModalOpen, () => setIsManageModalOpen(false));
  const cerrarPerfil = useCapaHistorial(isPerfilOpen, () => setIsPerfilOpen(false));
  const cerrarAjustes = useCapaHistorial(panelAjustes, () => setPanelAjustes(false));
  const cerrarNotifs = useCapaHistorial(notifsAbiertas, () => fijarNotifs(false));
  const cerrarConfirmar = useCapaHistorial(confirmarEliminar, () => setConfirmarEliminar(false));
  const cerrarGuia = useCapaHistorial(showOnboardingSurvey, closeOnboardingSurvey);
  const cerrarAyuda = useCapaHistorial(ayudaAtajosAbierta, () => setAyudaAtajosAbierta(false));
  const cerrarPanelMovil = useCapaHistorial(panelMovilAbierto, () => setPanelMovilAbierto(false));

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
    onToggleAyuda: () => (ayudaAtajosAbierta ? cerrarAyuda() : setAyudaAtajosAbierta(true)),
    modalAbierto: algunModalAbierto,
  });

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
      const fallidas = Array.isArray(data.fuentesFallidas) ? data.fuentesFallidas.length : 0;
      const reparadas = Array.isArray(data.reparadas) ? data.reparadas.length : 0;
      let mensaje =
        restaurados > 0
          ? t("avisos.refresh_restauradas", { n: restaurados })
          : t("avisos.refresh_ok");
      if (nuevos > 0) mensaje += t("avisos.refresh_nuevas", { n: nuevos });
      if (sinCambios > 0) mensaje += t("avisos.sin_cambios", { n: sinCambios });
      if (reparadas > 0) mensaje += t("avisos.refresh_reparadas", { n: reparadas });
      if (fallidas > 0) mensaje += t("avisos.refresh_fallidas", { n: fallidas });
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
    cerrarConfirmar();
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
        panelNotifs={notifsAbiertas}
        onAbrirNotifs={() => (notifsAbiertas ? cerrarNotifs() : fijarNotifs(true))}
        noLeidasNotifs={noLeidasNotifs}
        iaNotifsEnCurso={iaEnCursoNotifs}
        mostrarBuscar={!busquedaVisible}
        onIrBuscar={irABusqueda}
        t={t}
      />

      {!estaOnline && (
        <div className="mx-auto mt-3 w-full max-w-[1440px] px-3 sm:px-6 anim-fade-in">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 flex items-center justify-center gap-2 text-center text-xs text-amber-200 shadow-sm">
            <WifiOff size={14} className="shrink-0 text-amber-400" />
            <span>
              <strong>{t("comun.sin_conexion_titulo")}</strong> {t("comun.sin_conexion_d")}
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

              <div ref={busquedaZonaRef} className="order-3 lg:order-none flex flex-col sm:flex-row gap-3 items-stretch sm:items-center scroll-mt-24">
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
                  <button
                    type="button"
                    onClick={() => setSoloHoy((v) => !v)}
                    aria-pressed={soloHoy}
                    title={t("filtros.hoy_titulo")}
                    className={`btn-press min-h-[44px] rounded-xl border px-3.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                      soloHoy
                        ? "border-[var(--accent)]/70 bg-[var(--accent)]/15 text-[var(--accent-ink)]"
                        : "border-app-line bg-app-surface text-app-muted hover:text-app-fg hover:border-[var(--accent)]/60"
                    }`}
                  >
                    {t("filtros.hoy")}
                    {soloHoy && (
                      <span className="ml-1 tabular-nums opacity-80">· {articulosVisibles.length}</span>
                    )}
                  </button>
                  {modoCache && (
                    <span
                      role="status"
                      title={t("cache.modo_d")}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-semibold text-amber-300"
                    >
                      <WifiOff size={13} className="shrink-0" />
                      {t("cache.modo")}
                      {horaCache && <span className="tabular-nums opacity-80">· {horaCache}</span>}
                    </span>
                  )}
                  <div className="flex items-center rounded-xl border border-app-line bg-app-surface p-1 text-app-muted">
                    <button
                      type="button"
                      onClick={() => cambiarModoVista("cards")}
                      title={t("controles.vista_cards_t")}
                      aria-label={t("controles.vista_cards_t")}
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
                      title={t("controles.vista_magazine_t")}
                      aria-label={t("controles.vista_magazine_t")}
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
                      title={t("controles.vista_compact_t")}
                      aria-label={t("controles.vista_compact_t")}
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
                    title={t("controles.atajos_titulo")}
                    aria-label={t("controles.atajos_titulo")}
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
                      {errorFeed ? (
                        <>
                          <span className="mx-auto grid h-12 w-12 place-content-center rounded-full border border-rose-500/40 bg-rose-500/10 text-rose-400">
                            <TriangleAlert size={22} />
                          </span>
                          <p className="text-base font-semibold text-app-fg max-w-md mx-auto">
                            {t("vacio.error_titulo")}
                          </p>
                          <p className="text-sm text-app-muted max-w-md mx-auto">
                            {t("vacio.error_d")}
                          </p>
                          <button
                            onClick={() => recargarDatos()}
                            className="btn-press group inline-flex items-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90"
                          >
                            <RotateCw size={16} /> {t("vacio.reintentar")}
                          </button>
                        </>
                      ) : hayFiltrosActivos ? (
                        <>
                          <span className="mx-auto grid h-12 w-12 place-content-center rounded-full border border-app-line bg-app-raised text-app-muted">
                            <SearchX size={22} />
                          </span>
                          <p className="text-base font-semibold text-app-fg max-w-md mx-auto">
                            {t("vacio.sin_resultados")}
                          </p>
                          <p className="text-sm text-app-muted max-w-md mx-auto">
                            {t("vacio.sin_resultados_d")}
                          </p>
                          <button
                            onClick={() => limpiarFiltros()}
                            className="btn-press group inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
                          >
                            {t("vacio.limpiar")} ({numFiltrosActivos})
                          </button>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  </div>
                ) : soloHoy && articulos.length > 0 && articulosVisibles.length === 0 ? (
                  <div className="bezel-outer my-8">
                    <div className="bezel-inner p-12 text-center space-y-4">
                      <p className="text-base font-semibold text-app-fg max-w-md mx-auto">
                        {t("vacio.hoy")}
                      </p>
                      <button
                        onClick={() => setSoloHoy(false)}
                        className="btn-press group inline-flex items-center gap-2 rounded-full border border-app-line bg-app-raised px-5 py-2.5 text-sm font-medium text-app-fg hover:border-[var(--accent)]/60"
                      >
                        {t("filtros.todas")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <NewsFeed
                      articles={articulosVisibles}
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
                onClick={() => cerrarPanelMovil()}
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] lg:hidden"
              />
            )}
            <button
              type="button"
              onClick={() => (panelMovilAbierto ? cerrarPanelMovil() : setPanelMovilAbierto(true))}
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
          <div className="text-center py-12 sm:py-20 max-w-2xl mx-auto px-1 space-y-6 min-w-0">
            <div className="inline-flex items-center justify-center p-3 bg-sky-500/10 text-sky-400 rounded-2xl border border-sky-500/20 mb-2">
              <Plus size={32} />
            </div>
            <h2 className="text-balance text-2xl sm:text-3xl font-extrabold text-app-fg tracking-tight break-words">{t("landing.titulo")}</h2>
            <p className="text-pretty text-app-muted leading-relaxed break-words">{t("landing.texto")}</p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 pt-4">
              <Link
                href="/login"
                className="touch-target btn-press inline-flex items-center justify-center bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium px-6 py-2.5 rounded-xl transition-[opacity,box-shadow] min-w-0"
              >
                <span className="truncate">{t("landing.comenzar")}</span>
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
        onCerrar={() => cerrarGuia()}
        t={t}
        onCompletado={handleRefresh}
        onAgregarFuente={handleAgregarFuenteOnboarding}
      />

      <AjustesPanel
        abierto={panelAjustes}
        onCerrar={() => cerrarAjustes()}
        tema={tema}
        onTema={cambiarTema}
        fuente={fuenteApp}
        onFuente={cambiarFuente}
        fuentePx={fuentePx}
        onFuentePx={cambiarFuentePx}
        modoVista={modoVista}
        onModoVista={cambiarModoVista}
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
          // El destino abre tras el popstate del cierre (ver useCapaHistorial):
          // abrirlo aquí mataría su entrada en la reconciliación.
          cerrarAjustes(() => setIsPerfilOpen(true));
        }}
        onCerrarSesion={salirInvitado}
        onPurgarSesion={restablecerSesionBase}
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
          cerrarAdd();
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
        onClose={() => cerrarManage()}
        onAgregarFuente={() => {
          // Igual que Editar perfil: el destino abre tras el popstate.
          cerrarManage(() => setIsAddModalOpen(true));
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
          onClose={() => cerrarPerfil()}
          onSuccess={() => recargarSesion()}
          onNotify={notify}
        />
      )}

      <ConfirmDeleteModal
        abierto={confirmarEliminar}
        onCancelar={() => cerrarConfirmar()}
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

      <NotificationPanel
        abierto={notifsAbiertas}
        onCerrar={() => cerrarNotifs()}
        notificaciones={notificaciones}
        noLeidas={noLeidasNotifs}
        pushActivado={pushActivado}
        onEliminarUna={eliminarNotif}
        onMarcarLeida={marcarNotifLeida}
        onMarcarTodasLeidas={marcarNotifsLeidas}
        onEliminarSeleccionadas={eliminarNotifsSel}
      />
      <KeyboardShortcutsModal
        abierto={ayudaAtajosAbierta}
        onCerrar={() => cerrarAyuda()}
        t={t}
      />

      {/* Guardia de salida: el atrás con el feed al descubierto pregunta
          antes de cerrar la sesión (solo con sesión activa). */}
      {confirmarSalida && session?.user && (
        <div
          className="anim-overlay fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => cerrarDialogoSalida()}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-salida"
            aria-describedby="texto-salida"
            onClick={(event) => event.stopPropagation()}
            className="anim-modal w-full max-w-sm space-y-4 rounded-2xl border border-app-line bg-app-surface p-6 shadow-2xl"
          >
            <h3 id="titulo-salida" className="text-balance text-lg font-bold text-app-fg">
              {t("ajustes.salida_titulo")}
            </h3>
            <p id="texto-salida" className="text-pretty text-sm leading-relaxed text-app-muted">
              {t("ajustes.salida_texto")}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => cerrarDialogoSalida()}
                autoFocus
                className="touch-target btn-press rounded-xl bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90"
              >
                {t("ajustes.salida_no")}
              </button>
              <button
                type="button"
                onClick={confirmarSalidaSesion}
                className="touch-target btn-press rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-500/15"
              >
                {t("ajustes.salida_si")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}