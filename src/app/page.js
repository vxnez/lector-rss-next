// src/app/page.js
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import AddFeedModal from "./components/AddFeedModal";
import ManageSourcesModal from "./components/ManageSourcesModal";
import NewsFeed from "./components/NewsFeed";
import {
  Rss,
  Star,
  Settings,
  Plus,
  LogOut,
  LogIn,
  UserPlus,
  RotateCw,
  Sparkles,
  Filter,
  ChevronDown,
  Check,
  Trash2,
  HelpCircle,
  X,
  ExternalLink,
  ArrowRight,
  Search,
  XCircle,
} from "lucide-react";

export default function HomePage() {
  const [session, setSession] = useState(null);
  const [articulos, setArticulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  
  // Estado para el modal de bienvenida/tutorial de nuevos usuarios
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  const [activeTab, setActiveTab] = useState("todas"); // "todas" | "guardadas" | "leidas"
  const [orden, setOrden] = useState("recientes");
  const [categoriasSeleccionadas, setCategoriasSeleccionadas] = useState([]);
  const [fuentesDisponibles, setSourcesList] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState("todas");
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [toast, setToast] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);

  const notify = useCallback((message, type = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 4200);
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

        if (formattedSources.length > 0) {
          setSourcesList(formattedSources);
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error al obtener fuentes:", err);
      }
    }
  }, []);

  const fetchArticles = useCallback(async (signal) => {
    try {
      const resArticles = await fetch(`/api/rss?t=${Date.now()}`, {
        cache: "no-store",
        signal,
      });
      if (resArticles.ok) {
        const articlesData = await resArticles.json();
        const articles = Array.isArray(articlesData) ? articlesData : [];
        setArticulos(articles);
        setLastUpdated(new Date());

        setSourcesList((previousSources) => {
          const sourcesById = new Map(previousSources.map((source) => [String(source.id), source]));
          articles.forEach((article) => {
            if (!article.fuente_id || sourcesById.has(String(article.fuente_id))) return;
            sourcesById.set(String(article.fuente_id), {
              id: article.fuente_id,
              nombre: article.fuente_nombre || "Fuente RSS",
              url_feed: article.fuente_url || "",
              categoria: article.categoria || "General",
            });
          });
          return Array.from(sourcesById.values());
        });
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error al obtener artículos:", err);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadData() {
      try {
        const resAuth = await fetch("/api/auth/session", { signal: controller.signal });
        const sessionData = await resAuth.json();

        if (controller.signal.aborted) return;

        if (sessionData?.user) {
          setSession(sessionData);
          await Promise.all([
            fetchArticles(controller.signal),
            fetchSources(controller.signal),
          ]);

          if (controller.signal.aborted) return;

          // Comprobar si es la primera vez que inicia sesión en este navegador
          const hasSeenWelcome = localStorage.getItem(`welcome_seen_${sessionData.user.email || sessionData.user.id}`);
          if (!hasSeenWelcome) {
            setShowWelcomeModal(true);
          }
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error al cargar sesión:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadData();

    // Función de limpieza para cancelar peticiones pendientes si el componente se desamonta
    return () => {
      controller.abort();
    };
  }, [fetchArticles, fetchSources]);

  const closeWelcomeModal = () => {
    if (session?.user) {
      localStorage.setItem(`welcome_seen_${session.user.email || session.user.id}`, "true");
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
      if (!response.ok) throw new Error("No se pudieron actualizar las fuentes.");

      await Promise.all([fetchArticles(), fetchSources()]);
      notify("Fuentes y noticias actualizadas.", "success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Error al refrescar las noticias:", err);
      notify(err.message || "No se pudo actualizar el feed.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const handleEliminarTodas = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar todas las publicaciones del feed? Al hacer clic en 'Refrescar' se recuperarán las de hoy.")) {
      return;
    }

    const backupArticulos = [...articulos];
    setArticulos([]);

    try {
      const res = await fetch("/api/rss?delete_all=true", { method: "DELETE" });
      if (!res.ok) {
        await Promise.all(
          backupArticulos.map((art) => fetch(`/api/rss?id=${art.id}`, { method: "DELETE" }))
        );
      }
    } catch (err) {
      console.error("Error al eliminar todas las noticias:", err);
      setArticulos(backupArticulos);
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
      return true;
    } catch {
      setArticulos((prev) =>
        prev.map((art) => (art.id === id ? { ...art, guardado: guardadoActual } : art))
      );
      return false;
    }
  };

  const descartarArticulo = async (id) => {
    const articuloCopia = articulos.find((art) => art.id === id);
    setArticulos((prev) => prev.filter((art) => art.id !== id));

    try {
      await fetch(`/api/rss?id=${id}`, { method: "DELETE" });
    } catch {
      if (articuloCopia) {
        setArticulos((prev) => [...prev, articuloCopia]);
      }
    }
  };

  const categoriasDisponibles = useMemo(() => {
    let baseList = articulos;
    if (activeTab === "guardadas") {
      baseList = articulos.filter((art) => art.guardado);
    } else if (activeTab === "leidas") {
      baseList = articulos.filter((art) => art.leido);
    } else {
      baseList = articulos.filter((art) => !art.leido && !art.guardado);
    }

    const categorias = Array.from(new Set(baseList.map((art) => art.categoria).filter(Boolean)));
    return categorias.sort((a, b) => a.localeCompare(b, "es"));
  }, [articulos, activeTab]);

  const alternarCategoria = (categoria) => {
    setCategoriasSeleccionadas((actuales) => (
      actuales.includes(categoria)
        ? actuales.filter((actual) => actual !== categoria)
        : [...actuales, categoria]
    ));
  };

  const articulosFiltrados = useMemo(() => {
    let base = articulos;
    if (activeTab === "guardadas") {
      base = articulos.filter((art) => art.guardado);
    } else if (activeTab === "leidas") {
      base = articulos.filter((art) => art.leido);
    } else {
      base = articulos.filter((art) => !art.leido && !art.guardado);
    }

    if (categoriasSeleccionadas.length > 0) {
      base = base.filter((art) => categoriasSeleccionadas.includes(art.categoria));
    }

    if (selectedSourceId !== "todas") {
      base = base.filter((art) => {
        return String(art.fuente_id) === String(selectedSourceId);
      });
    }

    const query = searchQuery.trim().toLocaleLowerCase("es");
    if (query) {
      base = base.filter((art) => `${art.titulo || ""} ${art.resumen || ""}`.toLocaleLowerCase("es").includes(query));
    }

    return base;
  }, [articulos, activeTab, categoriasSeleccionadas, selectedSourceId, searchQuery]);

  const articulosOrdenados = useMemo(() => {
    return [...articulosFiltrados].sort((a, b) => {
      if (orden === "az") return (a.titulo || "").localeCompare(b.titulo || "");
      if (orden === "za") return (b.titulo || "").localeCompare(a.titulo || "");

      const fechaA = new Date(a.fecha_publicacion || a.created_at || 0).getTime();
      const fechaB = new Date(b.fecha_publicacion || b.created_at || 0).getTime();

      if (orden === "recientes") return fechaB - fechaA;
      return 0;
    });
  }, [articulosFiltrados, orden]);

  const totalGuardados = articulos.filter((art) => art.guardado).length;
  const totalLeidos = articulos.filter((art) => art.leido).length;
  const totalPendientes = articulos.filter((art) => !art.leido && !art.guardado).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-md px-3 py-3 sm:px-6 sm:py-4 flex justify-between items-center gap-3 sticky top-0 z-20">
        <h1 className="text-base sm:text-xl font-bold tracking-tight text-white flex items-center gap-2 min-w-0">
          <span className="bg-sky-500 text-gray-950 p-1.5 rounded-lg font-black text-sm flex items-center justify-center">
            <Rss size={18} className="stroke-[3]" />
          </span>
          <span className="truncate">RSS Dashboard</span>
        </h1>

        <div className="flex items-center gap-4">
          {session?.user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setShowWelcomeModal(true)}
                title="Ayuda sobre cómo buscar fuentes RSS"
                className="text-xs bg-gray-800 hover:bg-gray-700 text-sky-400 px-3 py-1.5 rounded-lg transition border border-gray-700 flex items-center gap-1.5"
              >
                <HelpCircle size={14} />
                <span className="hidden sm:inline">Guía RSS</span>
              </button>

              <span className="text-sm text-gray-300 hidden sm:inline">
                Hola, <strong className="text-white">{session.user.name || session.user.email}</strong>
              </span>

              {/* CAMBIAMOS ESTE LINK POR UN BOTÓN DIRECTO DE CIERRE DE SESIÓN */}
              <button
                onClick={async () => {
                  const { signOut } = await import("next-auth/react");
                  await signOut({ callbackUrl: "/login" });
                }}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition border border-gray-700 flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Cerrar Sesión</span>
              </button>
            </div>
          ) : (

            <div className="flex gap-2 shrink-0">
              <Link
                href="/login"
                className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 transition border border-gray-700"
              >
                <LogIn size={16} />
                <span className="hidden sm:inline">Iniciar Sesión</span>
              </Link>
              <Link
                href="/register"
                className="text-sm bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
              >
                <UserPlus size={16} />
                <span className="hidden sm:inline">Registrarse</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-3 py-4 sm:px-6 sm:py-6 flex-1">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-48 rounded-xl border border-gray-800 bg-gray-900/70" />
            ))}
          </div>
        ) : session?.user ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Columna Izquierda / Central: Noticias */}
            <div className="contents lg:col-span-3 lg:block lg:space-y-6">
              <div className="order-1 lg:order-none grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
                {[
                  ["Pendientes", totalPendientes, "text-sky-300"],
                  ["Leídas", totalLeidos, "text-emerald-300"],
                  ["Guardadas", totalGuardados, "text-amber-300"],
                  ["Fuentes activas", fuentesDisponibles.length, "text-cyan-300"],
                ].map(([label, value, color]) => (
                  <div key={label} className="border border-gray-800 bg-gray-900/70 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
                    <p className="text-[10px] sm:text-[11px] uppercase tracking-wide text-gray-500 truncate">{label}</p>
                    <p className={`text-xl sm:text-2xl font-semibold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="order-3 lg:order-none flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <label className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar por título o resumen..."
                    aria-label="Buscar noticias"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-sky-600"
                  />
                </label>
                {(searchQuery || categoriasSeleccionadas.length > 0 || selectedSourceId !== "todas") && (
                  <button
                    onClick={() => { setSearchQuery(""); setCategoriasSeleccionadas([]); setSelectedSourceId("todas"); }}
                    className="text-xs text-gray-300 hover:text-white border border-gray-800 rounded-xl px-3 py-2.5 flex items-center justify-center gap-2"
                  >
                    <XCircle size={15} /> Limpiar filtros
                  </button>
                )}
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "Sin actualizar"}
                </span>
              </div>

              <div className="order-4 lg:order-none">
                {articulosOrdenados.length === 0 ? (
                  <div className="border border-dashed border-gray-800 bg-gray-900/30 rounded-2xl p-12 text-center text-gray-500 my-8 space-y-3">
                  <p className="text-base text-gray-400">
                    {activeTab === "guardadas"
                      ? "No tienes noticias guardadas con esta categoría."
                      : activeTab === "leidas"
                      ? "No hay noticias leídas en este apartado."
                      : "¡Estás al día! No hay noticias pendientes por leer."}
                  </p>
                  {activeTab === "todas" && (
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="inline-flex items-center gap-2 text-sm text-sky-400 hover:text-sky-300 font-medium"
                    >
                      <Plus size={16} /> Agregar tu primera fuente RSS
                    </button>
                  )}
                  </div>
                ) : (
                  <NewsFeed
                    articles={articulosOrdenados}
                    onToggleRead={toggleLeido}
                    onToggleSave={toggleGuardado}
                    onDelete={descartarArticulo}
                  />
                )}
              </div>
            </div>

            {/* Columna Derecha: Filtros y Orden */}
            <aside className="dashboard-control-sidebar order-2 lg:order-last bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 sm:p-5 space-y-5 sm:space-y-6 lg:sticky lg:top-24">
              <section className="border-b border-gray-800 pb-4 space-y-4">
                <button
                  type="button"
                  onClick={() => setControlsOpen((open) => !open)}
                  aria-expanded={controlsOpen}
                  className="flex w-full min-w-0 items-center justify-between gap-3 text-left text-white font-semibold text-[clamp(0.75rem,1vw,0.875rem)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Settings size={16} className="text-sky-400" />
                    <span className="truncate">Controles del dashboard</span>
                  </span>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${controlsOpen ? "rotate-180" : ""}`} />
                </button>

                {controlsOpen && (
                  <div className="space-y-4 border-t border-gray-800 pt-4">
                    <section className="space-y-3">
                      <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-wide text-gray-400">Estado de lectura</h2>
                      <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => { setActiveTab("todas"); setCategoriasSeleccionadas([]); }}
                    className={`min-w-0 rounded-lg border px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium transition flex items-center justify-center gap-1 ${
                      activeTab === "todas" ? "bg-sky-600 text-white border-sky-500" : "bg-gray-900 text-gray-400 border-gray-800 hover:text-white"
                    }`}
                  >
                    <Rss size={14} />
                    <span className="truncate">Pendientes</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab("leidas"); setCategoriasSeleccionadas([]); }}
                    className={`min-w-0 rounded-lg border px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium transition flex items-center justify-center gap-1 ${
                      activeTab === "leidas" ? "bg-emerald-600 text-white border-emerald-500" : "bg-gray-900 text-gray-400 border-gray-800 hover:text-white"
                    }`}
                  >
                    <Check size={14} />
                    <span className="truncate">Leídas</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab("guardadas"); setCategoriasSeleccionadas([]); }}
                    className={`min-w-0 rounded-lg border px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium transition flex items-center justify-center gap-1 ${
                      activeTab === "guardadas" ? "bg-amber-600 text-white border-amber-500" : "bg-gray-900 text-gray-400 border-gray-800 hover:text-white"
                    }`}
                  >
                    <Star size={14} className={activeTab === "guardadas" ? "fill-white" : ""} />
                    <span className="truncate">Guardadas</span>
                      </button>
                      </div>
                    </section>

                    <section className="space-y-3 border-t border-gray-800 pt-4">
                      <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-wide text-gray-400">Acciones del feed</h2>
                      <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title="Actualizar y restaurar noticias de hoy"
                    className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-gray-200 transition hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <RotateCw size={14} className={refreshing ? "animate-spin text-sky-400" : ""} />
                    <span className="truncate">{refreshing ? "Actualizando..." : "Refrescar"}</span>
                  </button>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="min-w-0 rounded-lg bg-sky-600 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-white transition hover:bg-sky-500 flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} />
                    <span className="truncate">Agregar feed</span>
                      </button>
                      </div>
                    </section>

                    <section className="space-y-3 border-t border-gray-800 pt-4">
                      <h2 className="text-[clamp(0.62rem,0.7vw,0.75rem)] font-semibold uppercase tracking-wide text-gray-400">Administración</h2>
                      <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleEliminarTodas}
                    title="Eliminar todas las publicaciones"
                    className="min-w-0 rounded-lg border border-red-900/50 bg-red-950/40 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-red-300 transition hover:bg-red-900/50 flex items-center justify-center gap-1.5"
                  >
                    <Trash2 size={14} />
                    <span className="truncate">Eliminar todo</span>
                  </button>
                  <button
                    onClick={() => setIsManageModalOpen(true)}
                    className="min-w-0 rounded-lg border border-gray-800 bg-gray-900 px-2 py-2 text-[clamp(0.62rem,0.7vw,0.75rem)] font-medium text-gray-200 transition hover:bg-gray-800 flex items-center justify-center gap-1.5"
                  >
                    <Settings size={14} />
                    <span className="truncate">Fuentes</span>
                      </button>
                      </div>
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
                    <span className="truncate">Filtros y Orden</span>
                  </span>
                  <ChevronDown size={18} className={`text-gray-400 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
                </button>
              </section>

              {filtersOpen && (
                <div className="space-y-5 sm:space-y-6">

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Ordenar por</label>
                <select
                  value={orden}
                  onChange={(e) => setOrden(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-gray-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-sky-600 transition cursor-pointer"
                >
                  <option value="recientes">Más recientes primero</option>
                  <option value="az">Alfabético (A - Z)</option>
                  <option value="za">Alfabético (Z - A)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400">Fuente RSS</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-gray-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-sky-600 transition cursor-pointer"
                >
                  <option value="todas">Todas las fuentes</option>
                  {fuentesDisponibles.map((fuente) => (
                    <option key={fuente.id} value={fuente.id}>{fuente.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-medium text-gray-400">Categorías</label>
                  {categoriasSeleccionadas.length > 0 && (
                    <span className="text-[11px] text-sky-400">
                      {categoriasSeleccionadas.length} seleccionada{categoriasSeleccionadas.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <div className="category-filter-list max-h-64 overflow-y-auto rounded-xl border border-gray-800 bg-gray-950 p-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-800 px-2.5 py-2 text-sm text-gray-200 hover:bg-gray-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={categoriasSeleccionadas.length === 0}
                        onChange={() => setCategoriasSeleccionadas([])}
                        className="h-4 w-4 accent-sky-500 shrink-0"
                      />
                      <span className="truncate">Todas</span>
                    </label>

                    {categoriasDisponibles.map((categoria) => (
                      <label
                        key={categoria}
                        className="flex min-w-0 items-center gap-2 rounded-lg border border-gray-800 px-2.5 py-2 text-sm text-gray-300 hover:bg-gray-900 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={categoriasSeleccionadas.includes(categoria)}
                          onChange={() => alternarCategoria(categoria)}
                          className="h-4 w-4 accent-sky-500 shrink-0"
                        />
                        <span className="truncate">{categoria}</span>
                      </label>
                    ))}
                  </div>

                  {categoriasDisponibles.length === 0 && (
                    <p className="px-2.5 py-2 text-xs text-gray-500">No hay categorías disponibles.</p>
                  )}
                </div>
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
              Tus fuentes de información en un solo lugar
            </h2>
            <p className="text-gray-400 leading-relaxed">
              Agrega y gestiona tus blogs, periódicos y portales de noticias preferidos mediante RSS. Inicia sesión para sincronizar tus artículos guardados.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <Link
                href="/login"
                className="bg-sky-600 hover:bg-sky-500 text-white font-medium px-6 py-2.5 rounded-xl transition shadow-lg shadow-sky-600/20"
              >
                Comenzar ahora
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* =======================================================
          MODAL DE BIENVENIDA / TUTORIAL PARA NUEVOS USUARIOS
         ======================================================= */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-2xl relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            
            <button
              onClick={closeWelcomeModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition"
            >
              <X size={20} />
            </button>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 text-sky-400 rounded-full text-xs font-semibold border border-sky-500/20">
                <Sparkles size={14} /> Guía para nuevos usuarios
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight">
                ¡Bienvenido a tu Feed de Noticias!
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                Este programa te permite centralizar artículos de tus sitios web favoritos mediante enlaces <strong className="text-gray-200">RSS</strong>. Como no todas las páginas web cuentan con RSS o es difícil encontrar su ruta exacta, te enseñamos un método rápido para hallarlas.
              </p>
            </div>

            <div className="space-y-4 bg-gray-950/60 p-4 rounded-xl border border-gray-800 text-xs sm:text-sm text-gray-300">
              <div className="flex items-start gap-3">
                <span className="bg-sky-600 text-white font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs mt-0.5">1</span>
                <div>
                  <strong className="text-white block mb-0.5">Usa una herramienta buscadora de RSS</strong>
                  <p className="text-gray-400 mb-2">
                    Te recomendamos visitar la herramienta web gratuita <a href="https://lighthouseapp.io/tools/feed-finder" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline inline-flex items-center gap-1 font-medium">Lighthouse RSS Feed Finder <ExternalLink size={12} /></a>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="bg-sky-600 text-white font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs mt-0.5">2</span>
                <div>
                  <strong className="text-white block mb-0.5">Pega el enlace principal de tu web favorita</strong>
                  <p className="text-gray-400">
                    Copia la URL principal de tu página de noticias o blog preferido (ejemplo: <code className="bg-gray-900 px-1.5 py-0.5 rounded text-sky-300">https://elpais.com</code>) y pégala en esa página buscadora.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="bg-sky-600 text-white font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs mt-0.5">3</span>
                <div>
                  <strong className="text-white block mb-0.5">Obtén la URL final y añádela al programa</strong>
                  <p className="text-gray-400">
                    Espera a que el buscador te arroje el enlace RSS válido (suele terminar en <code className="bg-gray-900 px-1.5 py-0.5 rounded text-sky-300">/feed</code> o <code className="bg-gray-900 px-1.5 py-0.5 rounded text-sky-300">.xml</code>). ¡Cópialo, pégalo en el botón <strong>&quot;Agregar Feed&quot;</strong> de este programa web y listo para obtener tus noticias fácilmente!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeWelcomeModal}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-sky-600/20"
              >
                <span>¡Entendido, comenzar a usar!</span>
                <ArrowRight size={16} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modales de la aplicación */}
      <AddFeedModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => Promise.all([fetchArticles(), fetchSources()])}
      />
      <ManageSourcesModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        sources={fuentesDisponibles}
        onChange={() => {
          fetchArticles();
          fetchSources();
        }}
        onNotify={notify}
      />
      {toast && (
        <div role="status" className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-2xl ${toast.type === "error" ? "border-rose-800 bg-rose-950 text-rose-100" : "border-sky-800 bg-sky-950 text-sky-100"}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}