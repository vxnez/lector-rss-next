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
  Check,
  Trash2,
  HelpCircle,
  X,
  ExternalLink,
  ArrowRight,
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
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("todas");
  const [fuentesDisponibles, setSourcesList] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState("todas");

  const fetchSources = useCallback(async (signal) => {
    try {
      const res = await fetch("/api/rss/sources", { cache: "no-store", signal });
      if (res.ok) {
        const data = await res.json();
        const sourcesArr = Array.isArray(data) ? data : (data.sources || data.data || []);
        
        const formattedSources = sourcesArr.map((s) => ({
          id: s.id || s._id || s.fuente_id || s.url || s.nombre,
          nombre: s.nombre || s.name || s.titulo || s.domain || s.url || "Fuente sin nombre",
        }));

        setSourcesList(formattedSources);
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
        setArticulos(Array.isArray(articlesData) ? articlesData : []);
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
      await fetch("/api/rss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", restore_today: true }),
        cache: "no-store",
      });

      await Promise.all([fetchArticles(), fetchSources()]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Error al refrescar las noticias:", err);
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
      await fetch("/api/rss", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, leido: leidoNuevo }),
      });
    } catch {
      setArticulos((prev) =>
        prev.map((art) => (art.id === id ? { ...art, leido: leidoActual } : art))
      );
    }
  };

  const toggleGuardado = async (id, guardadoActual) => {
    const guardadoNuevo = !guardadoActual;
    setArticulos((prev) =>
      prev.map((art) => (art.id === id ? { ...art, guardado: guardadoNuevo } : art))
    );

    try {
      await fetch("/api/rss", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, guardado: guardadoNuevo }),
      });
    } catch {
      setArticulos((prev) =>
        prev.map((art) => (art.id === id ? { ...art, guardado: guardadoActual } : art))
      );
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
      baseList = articulos.filter((art) => !art.leido);
    }

    const cats = baseList.map((art) => art.categoria).filter(Boolean);
    return Array.from(new Set(cats)).sort();
  }, [articulos, activeTab]);

  const articulosFiltrados = useMemo(() => {
    let base = articulos;
    if (activeTab === "guardadas") {
      base = articulos.filter((art) => art.guardado);
    } else if (activeTab === "leidas") {
      base = articulos.filter((art) => art.leido);
    } else {
      base = articulos.filter((art) => !art.leido && !art.guardado);
    }

    if (categoriaSeleccionada !== "todas") {
      base = base.filter((art) => art.categoria === categoriaSeleccionada);
    }

    if (selectedSourceId !== "todas") {
      base = base.filter((art) => {
        const fuenteArticulo = String(art.fuente || art.source || art.domain || art.feedName || art.nombre_fuente || "").toLowerCase();
        const idArticulo = String(art.fuente_id || art.source_id || art.feed_id || "").toLowerCase();
        const objetivo = String(selectedSourceId).toLowerCase();
        return fuenteArticulo === objetivo || idArticulo === objetivo;
      });
    }

    return base;
  }, [articulos, activeTab, categoriaSeleccionada, selectedSourceId]);

  const articulosOrdenados = useMemo(() => {
    return [...articulosFiltrados].sort((a, b) => {
      if (orden === "az") return (a.titulo || "").localeCompare(b.titulo || "");
      if (orden === "za") return (b.titulo || "").localeCompare(a.titulo || "");

      const fechaA = new Date(a.fecha || a.created_at || 0).getTime();
      const fechaB = new Date(b.fecha || b.created_at || 0).getTime();

      if (orden === "recientes") return fechaB - fechaA;
      return 0;
    });
  }, [articulosFiltrados, orden]);

  const totalGuardados = articulos.filter((art) => art.guardado).length;
  const totalLeidos = articulos.filter((art) => art.leido).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-md px-6 py-4 flex justify-between items-center sticky top-0 z-20">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="bg-sky-500 text-gray-950 p-1.5 rounded-lg font-black text-sm flex items-center justify-center">
            <Rss size={18} className="stroke-[3]" />
          </span>
          Feed Dashboard
        </h1>

        <div className="flex items-center gap-4">
          {session?.user ? (
            <div className="flex items-center gap-3">
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

              <Link
                href="/api/auth/signout"
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition border border-gray-700 flex items-center gap-1.5"
              >
                <LogOut size={14} />
                <span>Cerrar Sesión</span>
              </Link>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href="/login"
                className="text-sm bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 transition border border-gray-700"
              >
                <LogIn size={16} />
                <span>Iniciar Sesión</span>
              </Link>
              <Link
                href="/register"
                className="text-sm bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 transition"
              >
                <UserPlus size={16} />
                <span>Registrarse</span>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 py-6 flex-1">
        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray-400 gap-2">
            <RotateCw size={20} className="animate-spin text-sky-500" />
            <span>Cargando dashboard...</span>
          </div>
        ) : session?.user ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Columna Izquierda / Central: Noticias */}
            <div className="lg:col-span-3 space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setActiveTab("todas"); setCategoriaSeleccionada("todas"); }}
                    className={`text-sm px-3.5 py-2 rounded-lg transition flex items-center gap-2 font-medium ${
                      activeTab === "todas" ? "bg-sky-600 text-white shadow-sm" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
                    }`}
                  >
                    <Rss size={16} />
                    <span>Todas las Noticias</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab("leidas"); setCategoriaSeleccionada("todas"); }}
                    className={`text-sm px-3.5 py-2 rounded-lg transition flex items-center gap-2 font-medium ${
                      activeTab === "leidas" ? "bg-emerald-600 text-white shadow-sm" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
                    }`}
                  >
                    <Check size={16} />
                    <span>Leídas ({totalLeidos})</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab("guardadas"); setCategoriaSeleccionada("todas"); }}
                    className={`text-sm px-3.5 py-2 rounded-lg transition flex items-center gap-2 font-medium ${
                      activeTab === "guardadas" ? "bg-amber-600 text-white shadow-sm" : "bg-gray-900 text-gray-400 hover:text-white border border-gray-800"
                    }`}
                  >
                    <Star size={16} className={activeTab === "guardadas" ? "fill-white" : ""} />
                    <span>Guardadas ({totalGuardados})</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    title="Actualizar y restaurar noticias de hoy"
                    className="bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-gray-200 text-sm px-3.5 py-2 rounded-lg font-medium transition border border-gray-800 flex items-center gap-2"
                  >
                    <RotateCw size={16} className={refreshing ? "animate-spin text-sky-400" : ""} />
                    <span className="hidden sm:inline">{refreshing ? "Actualizando..." : "Refrescar"}</span>
                  </button>

                  <button
                    onClick={handleEliminarTodas}
                    title="Eliminar todas las publicaciones"
                    className="bg-red-950/40 hover:bg-red-900/50 text-red-300 text-sm px-3.5 py-2 rounded-lg font-medium transition border border-red-900/50 flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    <span className="hidden sm:inline">Eliminar todas</span>
                  </button>

                  <button
                    onClick={() => setIsManageModalOpen(true)}
                    className="bg-gray-900 hover:bg-gray-800 text-gray-200 text-sm px-3.5 py-2 rounded-lg font-medium transition border border-gray-800 flex items-center gap-2"
                  >
                    <Settings size={16} />
                    <span className="hidden sm:inline">Fuentes</span>
                  </button>

                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-sky-600 hover:bg-sky-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 shadow-sm"
                  >
                    <Plus size={16} />
                    <span>Agregar Feed</span>
                  </button>
                </div>
              </div>

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

            {/* Columna Derecha: Filtros y Orden */}
            <aside className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-5 space-y-6 sticky top-24">
              <div className="flex items-center gap-2 pb-3 border-b border-gray-800 text-white font-semibold text-sm">
                <Filter size={16} className="text-sky-400" />
                <span>Filtros y Orden</span>
              </div>

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
                <label className="text-xs font-medium text-gray-400">Categoría</label>
                <select
                  value={categoriaSeleccionada}
                  onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 text-gray-200 text-xs rounded-xl px-3 py-2.5 outline-none focus:border-sky-600 transition cursor-pointer"
                >
                  <option value="todas">Todas las categorías</option>
                  {categoriasDisponibles.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
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
        onSuccess={() => {
          fetchArticles();
          fetchSources();
        }}
      />
      <ManageSourcesModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        onChange={() => {
          fetchArticles();
          fetchSources();
        }}
      />
    </div>
  );
}