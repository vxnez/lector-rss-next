// src/app/page.js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import GitHubCard from "./components/GitHubCard";
import NewsFeed from "./components/NewsFeed";

// Modales diferidos: no entran al bundle inicial, se cargan al abrirse.

// Modales diferidos: no entran al bundle inicial, se cargan al abrirse.
const AddFeedModal = dynamic(() => import("./components/AddFeedModal"), { ssr: false });
const ManageSourcesModal = dynamic(() => import("./components/ManageSourcesModal"), { ssr: false });
const PerfilModal = dynamic(() => import("./components/PerfilModal"), { ssr: false });
const AjustesPanel = dynamic(() => import("./components/AjustesPanel"), { ssr: false });
import {
  Settings,
  Plus,
  Sparkles,
  Filter,
  Trash2,
  Search,
  XCircle,
} from "lucide-react";
import {
  Check as CheckData,
  Circle as CircleData,
  Filter as FilterData,
  LoaderCircle as LoaderCircleData,
  RotateCw as RotateCwData,
  Settings as SettingsData,
  Sparkles as SparklesData,
  X as XData,
  ChevronDown as ChevronDownData,
  ChevronUp as ChevronUpData,
} from "lucide";
import MorphIcon from "./components/MorphIcon";
import { TEMA_POR_DEFECTO, aplicarTema, temaInicial } from "@/lib/temas";
import { useIdioma } from "@/lib/i18n";
import { dominioDeUrl } from "@/lib/formato";
import { paramsFeed, urlBase64ToUint8Array } from "@/lib/feed-utils";
import { bumpCacheVersion, fetchJson, leerCache, prefetchJson } from "@/lib/fetchCache";
import AppHeader from "./components/dashboard/AppHeader";
import StatsCards from "./components/dashboard/StatsCards";
import Paginacion from "./components/dashboard/Paginacion";
import Toast from "./components/dashboard/Toast";
import IAProgressCard from "./components/dashboard/IAProgressCard";
import OnboardingSurvey from "./components/dashboard/OnboardingSurvey";
import ConfirmDeleteModal from "./components/dashboard/ConfirmDeleteModal";
import { inicializarMicrointeracciones } from "@/lib/animaciones";

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
  const router = useRouter();
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
  
  // Estado para la encuesta de bienvenida (onboarding) de nuevos usuarios
  const [showOnboardingSurvey, setShowOnboardingSurvey] = useState(false);

  const [activeTab, setActiveTab] = useState("todas"); // "todas" | "guardadas" | "leidas"
  const [orden, setOrden] = useState("recientes");
  // Filtro por estado de categorización IA: "todas" | "con_ia" | "sin_ia".
  const [filtroIA, setFiltroIA] = useState("todas");
  // Progreso de la categorización en segundo plano para la tarjeta flotante:
  // null = inactiva; { total, procesadas, pendientes, estado }. La guarda
  // evita lanzamientos duplicados.
  const [iaProgreso, setIaProgreso] = useState(null);
  const iaEnCursoRef = useRef(false);
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [categoriasExpandidas, setCategoriasExpandidas] = useState(false);
  const [fuentesExpandidas, setFuentesExpandidas] = useState(false);
  const [panelMovilAbierto, setPanelMovilAbierto] = useState(false);
  const [fuentesDisponibles, setSourcesList] = useState([]);
  const [fuentesSeleccionadas, setFuentesSeleccionadas] = useState([]);
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
      return temaInicial();
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

  // Recarga estructural (mutación): invalida la caché client-side y pide
  // datos frescos. La navegación (página/filtros) NO la usa: ahí la caché
  // sirve instantáneo a propósito.
  const recargarDatos = useCallback(() => {
    bumpCacheVersion();
    setNonceRecarga((n) => n + 1);
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
    bumpCacheVersion();
    setPagina(1);
    setTotalNoticias(0);
    setConteos({ pendientes: 0, leidas: 0, guardadas: 0 });
    router.push("/login");
  }, [router]);



  const filtroFuenteRef = useRef(null);

  // Clave de la vista de feed en curso: evita que una respuesta tardía
  // pise una navegación más reciente (carreras entre revalidaciones).
  const claveFeedActualRef = useRef("");

  // La tarjeta "Fuentes activas" abre Gestionar Fuentes RSS para una
  // gestión más rápida (editar, refrescar o eliminar en un solo lugar).
  const irAGestionFuentes = useCallback(() => {
    setIsManageModalOpen(true);
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
      // TTL 90s + dedupe: la lista cambia poco; las mutaciones suben la
      // versión de caché (bumpCacheVersion) y fuerzan un fetch fresco.
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

  // Conteos globales para las tarjetas (no dependen de la página visible).
  // Sin TTL (siempre frescos tras mutar) pero con dedupe: el refetch
  // imperativo de los toggles colapsa con el del efecto en un solo vuelo.
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
      if (err.name !== "AbortError") console.error("Error al obtener conteos:", err);
    }
  }, []);

  const procesarColaClasificacion = useCallback(async () => {
    for (let intento = 0; intento < 12; intento++) {
      let restantes = 0;
      let esperaMs = 250;
      try {
        const res = await fetch("/api/rss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clasificar_pendientes", lote: 24 }),
        });
        if (!res.ok) break;
        const data = await res.json().catch(() => ({}));
        restantes = Number(data.restantes) || 0;
        if (Number(data.reintentarEn) > 0) esperaMs = Number(data.reintentarEn) * 1000;
      } catch {
        break;
      }
      // Refresca la página visible (vía nonce) con las categorías ya clasificadas.
      recargarDatos();
      if (restantes === 0) break;
      await new Promise((resolve) => setTimeout(resolve, esperaMs));
    }
  }, [recargarDatos]);

  // Botón aislado de IA (fire-and-forget): dispara un lote y la cola sigue
  // en segundo plano sin bloquear el botón ni re-descargar fuentes. La
  // tarjeta flotante muestra el conteo en vivo (procesadas de total +
  // pendientes) con barra proporcional; cada lote refresca la vista para que
  // lo categorizado aparezca progresivamente. Los fallos de transporte
  // (timeout del serverless, red) no se disfrazan de "sin pendientes".
  const handleCategorizarIA = useCallback(() => {
    if (iaEnCursoRef.current) {
      const pendientes = iaProgreso?.pendientes;
      notify(
        pendientes === null || pendientes === undefined
          ? t("avisos.ia_lanzada")
          : t("avisos.ia_en_curso", { n: pendientes }),
        "info"
      );
      return;
    }
    iaEnCursoRef.current = true;
    // La tarjeta aparece de inmediato en modo indeterminado: el primer lote
    // (la primera llamada a la IA) tarda segundos en responder.
    setIaProgreso({ total: null, procesadas: 0, pendientes: null, estado: "en_curso" });

    const pedirLote = async () => {
      const res = await fetch("/api/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clasificar_pendientes", lote: 24 }),
      });
      if (!res.ok) throw new Error(t("avisos.ia_err"));
      const data = await res.json().catch(() => ({}));
      return {
        clasificados: Number(data.clasificados) || 0,
        restantes: Number(data.restantes) || 0,
        esperaMs: Number(data.reintentarEn) > 0 ? Number(data.reintentarEn) * 1000 : 250,
        diag: typeof data.diag === "string" && data.diag ? data.diag : null,
      };
    };

    (async () => {
      let total = null;
      let procesadas = 0;
      let falloTransporte = false;
      let diagFinal = null;
      // Racha de lotes en cuota sin clasificar nada: cortar antes de quemar
      // intentos (con esperas de 43 s+, 24 intentos serían eternos).
      let rachaCuota = 0;
      try {
        for (let intento = 0; intento < 24; intento++) {
          let lote;
          try {
            lote = await pedirLote();
          } catch {
            falloTransporte = true;
            break;
          }
          // El total se fija con la primera respuesta (foto al lanzar).
          if (total === null) total = lote.clasificados + lote.restantes;
          procesadas += lote.clasificados;
          if (lote.diag && !diagFinal) diagFinal = lote.diag;
          // Clave rechazada, ausente o modelo retirado: reintentar es inútil,
          // se corta aquí con el diagnóstico específico en vez de quemar
          // 12 intentos.
          if ((diagFinal === "auth" || diagFinal === "sin_clave" || diagFinal === "modelo") && procesadas === 0) break;
          if (lote.clasificados > 0 || lote.diag !== "cuota") {
            rachaCuota = 0;
          } else if (++rachaCuota >= 3) {
            break;
          }
          // Refresco progresivo: lo ya categorizado se ve sin esperar al final.
          recargarDatos();
          if (lote.restantes === 0) break;
          setIaProgreso({ total, procesadas, pendientes: lote.restantes, estado: "en_curso" });
          await new Promise((resolve) => setTimeout(resolve, lote.esperaMs));
        }
        if (procesadas > 0) {
          setIaProgreso({ total: total ?? procesadas, procesadas, pendientes: 0, estado: "ok" });
        } else if (falloTransporte && !diagFinal) {
          setIaProgreso({ total: null, procesadas: 0, pendientes: null, estado: "error", diag: null });
        } else if (diagFinal) {
          setIaProgreso({ total, procesadas: 0, pendientes: null, estado: "error", diag: diagFinal });
        } else {
          setIaProgreso({ total: total ?? 0, procesadas: 0, pendientes: 0, estado: "ok" });
        }
      } finally {
        iaEnCursoRef.current = false;
      }
    })().catch(() => {
      iaEnCursoRef.current = false;
      setIaProgreso({ total: null, procesadas: 0, pendientes: null, estado: "error", diag: null });
    });
  }, [iaProgreso, notify, recargarDatos, t]);

  // Service worker de push + estado de suscripción (solo navegadores compatibles).
  // Microinteracciones Anime.js en `.btn-press` (solo transform, GPU):
  // respuesta táctil con rebote ligero; el CSS :active queda de fallback.
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

  // Sesión inicial (cuenta o invitado). El feed lo carga el efecto de
  // datos paginados cuando hay sesión.
  // Guía de bienvenida como flujo de PRIMER USO:
  // - Cuentas: el servidor expone bienvenidaVista (0 = pendiente: cuenta
  //   nueva o proveedor recién vinculado). Solo entonces se abre sola; al
  //   cerrarla se persiste en servidor y jamás vuelve a abrirse sola.
  // - Invitados: sin perfil en servidor; control por clave local
  //   guest_has_seen_onboarding (se honra la marca anterior
  //   welcome_seen_invitado para no repetirla). Se abre solo la primera
  //   vez por navegador; recargas y sesiones posteriores no la reabren.
  // - En cualquier otro caso la apertura es solo manual ("Sugerencia de
  //   fuentes" o Ajustes → Guía).
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
              // Sin almacenamiento: se muestra una vez por sesión.
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

  // Fuentes + conteos: al iniciar sesión y tras cambios estructurales.
  // Al cambiar de cuenta se invalida la caché (no filtrar datos entre usuarios).
  const idSesion = session?.user?.id;
  useEffect(() => {
    bumpCacheVersion();
  }, [idSesion]);
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
  // Renderizado progresivo: la carga inicial pide solo el primer bloque
  // (limit = preferencia 15/30/60) y pinta instantáneo si está en caché
  // (SWR); las vecinas se precargan en fondo y las siguientes (+2/+3) en
  // tiempo ocioso. El paginador y los estados no cambian, solo hay menos
  // espera al navegar.
  useEffect(() => {
    if (!session?.user) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    // Precarga ociosa programada (se cancela al navegar/desmontar).
    let idleId = null;
    const cancelarIdle = () => {
      try {
        if (idleId === null || typeof window === "undefined") return;
        if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
        else window.clearTimeout(idleId);
      } catch {
        // Sin API de idle: no hay nada que cancelar.
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
        const arts = Array.isArray(instantanea) ? instantanea : (instantanea.articles || []);
        setArticulos(arts);
        setTotalNoticias(Array.isArray(instantanea) ? arts.length : (Number(instantanea.total) || 0));
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
          const articles = Array.isArray(data) ? data : (data.articles || []);
          const total = Array.isArray(data) ? articles.length : (Number(data.total) || 0);
          setArticulos(articles);
          setTotalNoticias(total);
          // Si la página quedó vacía por borrados y no es la primera, retrocede.
          if (!Array.isArray(data) && articles.length === 0 && total > 0 && pagina > 1) {
            setPagina((p) => Math.max(p - 1, 1));
          }
          setLastUpdated(new Date());
          // Prefetch de vecinas en fondo (respeta límites): la caché las
          // sirve instantáneas al paginar.
          const totalPags = Math.max(Math.ceil(total / tamanoPagina), 1);
          const armarParams = (paginaObjetivo) => paramsFeed({
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
          // Precarga profunda en tiempo ocioso (+2/+3): no bloquea el hilo
          // principal; se aborta si el usuario navega o cambian los filtros
          // (clave de vista) y respeta el total de páginas conocido.
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
              // Sin temporizadores disponibles: se omite la precarga profunda.
            }
          }
        }
        if (facetas) {
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
    return () => {
      cancelarIdle();
      controller.abort();
    };
  }, [session, pagina, tamanoPagina, activeTab, orden, busquedaAplicada, categoriasSeleccionadas, fuentesSeleccionadas, filtroIA, nonceRecarga]);

  const closeOnboardingSurvey = () => {
    // La guía se marca como vista al cerrarla por cualquier vía (completar,
    // omitir o X): reabrirla queda disponible en "Sugerencia de fuentes" o
    // Ajustes → Guía. Invitados: clave local guest_has_seen_onboarding.
    if (session?.user) {
      const clave = esInvitado
        ? "guest_has_seen_onboarding"
        : `welcome_seen_${session.user.email || session.user.id}`;
      try {
        localStorage.setItem(clave, "true");
      } catch {
        // Sin almacenamiento disponible
      }
      // Cuentas reales: persistir en el servidor para que no vuelva a saltar
      // en otros navegadores/dispositivos. Los invitados son efímeros.
      if (!esInvitado) {
        setSession((previa) =>
          previa?.user ? { ...previa, user: { ...previa.user, bienvenidaVista: 1 } } : previa
        );
        fetch("/api/bienvenida", { method: "POST" }).catch(() => {
          // Si falla, el localStorage ya evita que se repita en este navegador.
        });
      }
    }
    setShowOnboardingSurvey(false);
  };

  // Función para agregar fuentes desde la encuesta de onboarding (un clic).
  // Usa el pipeline completo de /api/rss (descubrimiento + descarga +
  // clasificación), igual que el alta manual: antes insertaba directo en
  // /api/sources y las URLs sin feed válido quedaban en 0 noticias.
  // `opciones.forzar_conversion` (p. ej. secciones de GitHub Blog sin feed
  // nativo) activa el crawler multipágina en el alta, igual que el checkbox
  // "Convertir página completa" del modal manual.
  const handleAgregarFuenteOnboarding = useCallback(async (titulo, url_feed, categoria, opciones = {}) => {
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
      // 409 = ya registrada en la cuenta: se considera agregada.
      if (!res.ok && res.status !== 409) throw new Error(data.error || t("fuentes.err_conexion"));
      // Recargar fuentes, conteos y feed con las noticias recién descargadas.
      setPagina(1);
      recargarDatos();
      fetchSources();
      fetchConteos();
      if (Number(data?.pendientes) > 0) {
        notify(t("avisos.cola_agregada"), "success");
        procesarColaClasificacion();
      }
      return data;
    } catch (err) {
      console.error("Error agregando fuente desde onboarding:", err);
      throw err;
    }
  }, [fetchSources, fetchConteos, notify, procesarColaClasificacion, recargarDatos, t]);

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

      // Vuelve a la primera página (o recarga si ya está en ella) y actualiza fuentes/conteos.
      if (pagina === 1) recargarDatos();
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

  // Borrado masivo acotado a la pestaña activa: solo descarta las noticias
  // de la sección visible (pendientes, leídas o guardadas).
  const confirmarEliminarTodas = async () => {
    setConfirmarEliminar(false);
    bumpCacheVersion();
    const backupArticulos = [...articulos];
    setArticulos([]);
    setTotalNoticias(0);

    try {
      const res = await fetch(`/api/rss?delete_all=true&tab=${activeTab}`, { method: "DELETE" });
      if (!res.ok) throw new Error(t("avisos.eliminar_err"));
      setPagina(1);
      fetchConteos();
      notify(t("avisos.eliminadas_ok"), "success");
    } catch (err) {
      console.error("Error al eliminar todas las noticias:", err);
      setArticulos(backupArticulos);
      recargarDatos();
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
      recargarDatos();
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
      recargarDatos();
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
      recargarDatos();
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
      recargarDatos();
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

  const cambiarFiltroIA = (valor) => {
    setFiltroIA(valor === "con_ia" || valor === "sin_ia" ? valor : "todas");
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

  const seleccionarTodasFuentes = (valor) => {
    setFuentesSeleccionadas(valor ? fuentesDisponibles.map((fuente) => String(fuente.id)) : []);
    setPagina(1);
  };

  const seleccionarTodasCategorias = (valor) => {
    setCategoriasSeleccionadas(valor ? [...categoriasDisponibles] : []);
    setPagina(1);
  };

  const limpiarFiltros = () => {
    setSearchQuery("");
    setBusquedaAplicada("");
    busquedaRef.current = "";
    setCategoriasSeleccionadas([]);
    setFuentesSeleccionadas([]);
    setFiltroIA("todas");
    setPagina(1);
  };

  const hayFiltrosActivos = Boolean(
    searchQuery.trim() || categoriasSeleccionadas.length > 0 || fuentesSeleccionadas.length > 0 || filtroIA !== "todas"
  );

  const numFiltrosActivos =
    (searchQuery.trim() ? 1 : 0) + categoriasSeleccionadas.length + fuentesSeleccionadas.length + (filtroIA !== "todas" ? 1 : 0);

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
    <div className="app-ambient min-h-screen bg-app-bg text-app-fg flex flex-col">
      <div aria-hidden="true" className="grain-overlay" />
      <AppHeader
        session={session}
        esInvitado={esInvitado}
        panelAjustes={panelAjustes}
        onAbrirAjustes={() => setPanelAjustes(true)}
        t={t}
      />

      {esInvitado && (
        <div className="mx-auto mt-3 w-full max-w-[1440px] px-3 sm:px-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-center justify-center gap-2 text-center">
            <p className="text-xs text-amber-200">
              {t("invitado.aviso_1")} <strong>{t("header.invitado").toLowerCase()}</strong>: {t("invitado.aviso_2")} <Link href="/register" className="underline font-medium">{t("invitado.crear")}</Link> {t("invitado.aviso_3")}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
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
            
            {/* Columna Izquierda / Central: Noticias */}
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
              className="btn-press fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-sky-300/40 bg-sky-600/95 p-2.5 text-white shadow-[0_10px_28px_-10px_rgba(14,165,233,0.9)] backdrop-blur-sm hover:bg-sky-500 lg:hidden"
            >
              <span className="relative block">
                <MorphIcon icon={panelMovilAbierto ? XData : FilterData} size={21} strokeWidth={2.25} />
                {hayFiltrosActivos && (
                  <span aria-hidden="true" className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400" />
                )}
              </span>
            </button>
            <aside className={`dashboard-control-sidebar scroll-oculto order-5 lg:order-last space-y-3 rounded-3xl border border-app-line/80 bg-app-surface/85 p-3 shadow-[0_20px_55px_-28px_color-mix(in_srgb,var(--accent)_55%,transparent)] backdrop-blur-xl sm:p-4 lg:sticky lg:top-24 ${panelMovilAbierto ? "max-lg:fixed max-lg:inset-x-3 max-lg:bottom-20 max-lg:z-40 max-lg:max-h-[calc(70dvh-4rem)] max-lg:overflow-y-auto max-lg:overscroll-contain max-lg:shadow-2xl" : "max-lg:hidden"}`}>
              <section className="rounded-2xl border border-app-line/70 bg-app-bg/35 p-3 sm:p-3.5">
                <button
                  type="button"
                  onClick={() => setControlsOpen((open) => !open)}
                  aria-expanded={controlsOpen}
                  className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-app-fg font-semibold text-[clamp(0.75rem,1vw,0.875rem)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent-ink)]">
                      <Settings size={15} />
                    </span>
                    <span className="truncate">{t("controles.titulo")}</span>
                  </span>
                  <MorphIcon icon={controlsOpen ? ChevronUpData : ChevronDownData} size={18} className="text-app-muted" />
                </button>

                {controlsOpen && (
                  <div className="stagger-in space-y-4 border-t border-app-line/70 pt-3.5">
                    <section className="space-y-3">
                      <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-[0.12em] text-app-muted">{t("controles.acciones")}</h2>
                      <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title={t("controles.refrescar_titulo")}
                    className="btn-press flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-app-line bg-app-raised/70 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-app-fg hover:border-[var(--accent)]/50 hover:bg-app-raised disabled:opacity-50"
                  >
                    <MorphIcon
                      icon={refreshing ? LoaderCircleData : RotateCwData}
                      size={14}
                      className={refreshing ? "animate-spin text-sky-400" : ""}
                    />
                    <span className="truncate">{refreshing ? t("controles.actualizando") : t("controles.refrescar")}</span>
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="btn-press group flex min-w-0 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-strong)] px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-[var(--on-accent-strong)] hover:opacity-90 hover:shadow-[0_8px_22px_-12px_var(--accent)]"
                  >
                    <Plus size={14} />
                    <span className="truncate">{t("controles.agregar")}</span>
                      </button>
                      </div>
                      <button
                        onClick={handleCategorizarIA}
                        title={t("controles.ia_titulo")}
                        aria-label={t("controles.ia_titulo")}
                        aria-live="polite"
                        className="btn-press flex w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/10 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-violet-300 hover:border-violet-400/60 hover:bg-violet-500/15 [html[data-tema-claro='1']_&]:border-violet-600/50 [html[data-tema-claro='1']_&]:bg-violet-600/10 [html[data-tema-claro='1']_&]:text-violet-800 [html[data-tema-claro='1']_&]:hover:bg-violet-600/15"
                      >
                        <MorphIcon
                          icon={iaProgreso?.estado === "en_curso" ? LoaderCircleData : SparklesData}
                          size={14}
                          className={iaProgreso?.estado === "en_curso" ? "animate-spin text-violet-300 [html[data-tema-claro='1']_&]:text-violet-700" : ""}
                        />
                        <span className="truncate">{iaProgreso?.estado === "en_curso" ? `${t("controles.ia_categorizando")} (${iaProgreso.pendientes ?? "…"})` : t("controles.ia_categorizar")}</span>
                      </button>
                    </section>

                    <section className="space-y-3 border-t border-app-line/70 pt-4">
                      <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-[0.12em] text-app-muted">{t("controles.admin")}</h2>
                      <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleEliminarTodas}
                    title={t("controles.eliminar_seccion_titulo")}
                    className="btn-press flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/15"
                  >
                    <Trash2 size={14} />
                    <span className="truncate">{t("controles.eliminar")}</span>
                  </button>
                  <button
                    onClick={() => setIsManageModalOpen(true)}
                    className="btn-press flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-app-line bg-app-raised/70 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-app-fg hover:border-[var(--accent)]/50 hover:bg-app-raised"
                  >
                    <MorphIcon icon={isManageModalOpen ? XData : SettingsData} size={14} />
                    <span className="truncate">{t("controles.fuentes")}</span>
                      </button>
                      </div>
                      {/* Los avisos push se gestionan en Ajustes → Notificaciones */}
                    </section>

                    <section className="space-y-3 border-t border-app-line/70 pt-4">
                      <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-[0.12em] text-app-muted">{t("controles.vista")}</h2>
                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-gray-400">
                          {t("controles.pestana")}
                        </span>
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("controles.pestana")}>
                          {[
                            { valor: "todas", etiqueta: t("stats.pendientes") },
                            { valor: "leidas", etiqueta: t("stats.leidas") },
                            { valor: "guardadas", etiqueta: t("stats.guardadas") },
                          ].map((opcion) => {
                            const activa = activeTab === opcion.valor;
                            return (
                              <button
                                key={opcion.valor}
                                type="button"
                                role="radio"
                                aria-checked={activa}
                                onClick={() => seleccionarTab(opcion.valor)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                                  activa
                                    ? "border-sky-500 bg-sky-500/15 text-sky-300"
                                    : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                                }`}
                              >
                                <MorphIcon
                                  icon={activa ? CheckData : CircleData}
                                  size={13}
                                  strokeWidth={2.5}
                                  className="shrink-0"
                                />
                                {opcion.etiqueta}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <span className="mb-1.5 block text-xs font-medium text-gray-400">
                          {t("controles.pagina")}
                        </span>
                        <div className="flex gap-1.5" role="radiogroup" aria-label={t("controles.pagina")}>
                          {[15, 30, 60].map((n) => {
                            const activo = tamanoPagina === n;
                            return (
                              <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={activo}
                                onClick={() => cambiarTamanoPagina(n)}
                                className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                                  activo
                                    ? "border-sky-500 bg-sky-500/15 text-sky-300"
                                    : "border-gray-700 bg-gray-950 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                                }`}
                              >
                                {n}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOnboardingSurvey(true)}
                        className="btn-press flex w-full items-center justify-center gap-1.5 rounded-xl border border-app-line bg-app-raised/70 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-app-fg hover:border-[var(--accent)]/50 hover:bg-app-raised"
                      >
                        <Sparkles size={14} />
                        <span className="truncate">Sugerencia de fuentes</span>
                      </button>
                    </section>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-app-line/70 bg-app-bg/25 p-3 sm:p-3.5">
                <button
                  type="button"
                  onClick={() => setFiltersOpen((open) => !open)}
                  aria-expanded={filtersOpen}
                  className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-app-fg font-semibold text-[clamp(0.75rem,1vw,0.875rem)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--accent)]/12 text-[var(--accent-ink)]">
                      <Filter size={15} />
                    </span>
                    <span className="truncate">{t("filtros.titulo")}</span>
                    {numFiltrosActivos > 0 && (
                      <span aria-hidden="true" className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-gray-950">
                        {numFiltrosActivos}
                      </span>
                    )}
                  </span>
                  <MorphIcon icon={filtersOpen ? ChevronUpData : ChevronDownData} size={18} className="text-app-muted" />
                </button>
              </section>

              {filtersOpen && (
                <div className="space-y-5 sm:space-y-6">

              {/* Limpiar filtros siempre a la vista (fijo arriba): con muchas
                  fuentes ya no hay que bajar hasta el final para alcanzarlo. */}
              {hayFiltrosActivos && (
                <div className="sticky top-0 z-10 rounded-xl bg-app-surface/95 py-1 backdrop-blur-sm">
                  <button
                    onClick={limpiarFiltros}
                    className="btn-press w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20 flex items-center justify-center gap-2"
                  >
                    <XCircle size={15} /> {t("filtros.limpiar")} · {numFiltrosActivos}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-400">{t("filtros.ordenar")}</span>
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-app-line/50 bg-app-surface/40 p-2" role="radiogroup" aria-label={t("filtros.ordenar")}>
                  {[
                    { valor: "recientes", etiqueta: t("filtros.recientes") },
                    { valor: "antiguas", etiqueta: t("filtros.antiguas") },
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
                        <MorphIcon
                          icon={activo ? CheckData : CircleData}
                          size={13}
                          strokeWidth={2.5}
                          className="shrink-0"
                        />
                        {opcion.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-medium text-gray-400">{t("filtros.ia_estado")}</span>
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-app-line/50 bg-app-surface/40 p-2" role="radiogroup" aria-label={t("filtros.ia_estado")}>
                  {[
                    { valor: "todas", etiqueta: t("filtros.ia_todas") },
                    { valor: "con_ia", etiqueta: t("filtros.ia_con_ia") },
                    { valor: "sin_ia", etiqueta: t("filtros.ia_sin_ia") },
                  ].map((opcion) => {
                    const activo = filtroIA === opcion.valor;
                    return (
                      <button
                        key={opcion.valor}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        onClick={() => cambiarFiltroIA(opcion.valor)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
                          activo
                            ? "border-violet-500 bg-violet-500/15 text-violet-300 [html[data-tema-claro='1']_&]:border-violet-600 [html[data-tema-claro='1']_&]:bg-violet-600/10 [html[data-tema-claro='1']_&]:text-violet-800"
                            : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        <MorphIcon
                          icon={activo ? CheckData : CircleData}
                          size={13}
                          strokeWidth={2.5}
                          className="shrink-0"
                        />
                        {opcion.etiqueta}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-400">{t("filtros.fuente")}</span>
                  <span className="flex items-center gap-2">
                    {fuentesSeleccionadas.length > 0 && (
                      <span className="text-[11px] text-sky-400">
                        {fuentesSeleccionadas.length === 1
                          ? t("filtros.sel_una", { n: 1 })
                          : t("filtros.sel_varias", { n: fuentesSeleccionadas.length })}
                      </span>
                    )}
                    {fuentesDisponibles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => seleccionarTodasFuentes(fuentesSeleccionadas.length === 0)}
                        className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                      >
                        {fuentesSeleccionadas.length === 0 ? t("filtros.todas") : t("filtros.ninguna")}
                      </button>
                    )}
                  </span>
                </div>
                <div ref={filtroFuenteRef} tabIndex={-1} translate="no" className={`notranslate flex flex-wrap gap-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${fuentesExpandidas ? "" : "[&>*:nth-child(n+9)]:max-lg:hidden"}`}>
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
                        <MorphIcon
                          icon={activa ? CheckData : CircleData}
                          size={13}
                          strokeWidth={2.5}
                          className="shrink-0"
                        />
                        <IconoFuentePildora fuente={fuente} />
                        <span className="truncate">{fuente.nombre}</span>
                      </button>
                    );
                  })}
                </div>
                {fuentesDisponibles.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setFuentesExpandidas((expandida) => !expandida)}
                    className="lg:hidden text-xs text-sky-400 hover:text-sky-300 font-medium px-1 py-1 text-left"
                  >
                    {fuentesExpandidas ? t("filtros.ver_menos") : t("filtros.ver_todas", { n: fuentesDisponibles.length })}
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-gray-400">{t("filtros.categorias")}</label>
                  <span className="flex items-center gap-2">
                    {categoriasSeleccionadas.length > 0 && (
                      <span className="text-[11px] text-sky-400">
                        {categoriasSeleccionadas.length === 1
                          ? t("filtros.sel_una", { n: 1 })
                          : t("filtros.sel_varias", { n: categoriasSeleccionadas.length })}
                      </span>
                    )}
                    {categoriasDisponibles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => seleccionarTodasCategorias(categoriasSeleccionadas.length === 0)}
                        className="text-[11px] font-medium text-sky-400 hover:text-sky-300"
                      >
                        {categoriasSeleccionadas.length === 0 ? t("filtros.todas") : t("filtros.ninguna")}
                      </button>
                    )}
                  </span>
                </div>
                <div translate="no" className={`notranslate flex flex-wrap gap-1.5 ${categoriasExpandidas ? "" : "[&>*:nth-child(n+9)]:max-lg:hidden"}`}>
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
                        <MorphIcon
                          icon={activa ? CheckData : CircleData}
                          size={13}
                          strokeWidth={2.5}
                          className="shrink-0"
                        />
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
            <Link href="/" className=" transition hover:text-app-fg">
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
          nombre: activeTab === "guardadas" ? t("stats.guardadas") : activeTab === "leidas" ? t("stats.leidas") : t("stats.pendientes"),
          total: activeTab === "guardadas" ? totalGuardados : activeTab === "leidas" ? totalLeidos : totalPendientes,
        }}
      />
      <Toast toast={toast} />
      <IAProgressCard progreso={iaProgreso} onCerrar={() => setIaProgreso(null)} t={t} />
    </div>
  );
}