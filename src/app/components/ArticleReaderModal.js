// src/app/components/ArticleReaderModal.js
"use client";

import { X, ExternalLink, Bookmark, Check, Tag, Globe, Calendar, Pencil, Save, ChevronLeft, ChevronRight, Eye, EyeOff, MoveHorizontal } from "lucide-react";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { useEffect, useRef, useState } from "react";

// Dirección de la última navegación entre noticias (1 = siguiente, -1 = anterior, 0 = apertura).
// Vive a nivel de módulo porque el modal se remontan con `key` por noticia y el estado se pierde.
let direccionNavegacion = 0;
// Marca temporal del último cambio por rueda para evitar saltos múltiples con un solo gesto.
let ultimoCambioRueda = 0;

// Función para asignar colores distintivos a las categorías
const getCategoryColor = (categoria) => {
  return getCategoryStyle(categoria);

  switch (categoria) {
    case "Inteligencia Artificial":
      return "bg-violet-950/60 text-violet-300 border-violet-800/50";
    case "Ciberseguridad":
      return "bg-red-950/60 text-red-300 border-red-800/50";
    case "Videojuegos":
      return "bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/50";
    case "Ciencia y Espacio":
      return "bg-purple-950/60 text-purple-300 border-purple-800/50";
    case "Economía y Finanzas":
      return "bg-green-950/60 text-green-300 border-green-800/50";
    case "Fitness y Nutrición":
      return "bg-amber-950/60 text-amber-300 border-amber-800/50";
    case "Medio Ambiente":
      return "bg-emerald-950/60 text-emerald-300 border-emerald-800/50";
    case "Clima y Meteorología":
      return "bg-sky-950/60 text-sky-300 border-sky-800/50";
    case "Seguridad y Justicia":
      return "bg-red-950/60 text-red-300 border-red-800/50";
    case "Cultura y Arte":
      return "bg-pink-950/60 text-pink-300 border-pink-800/50";
    case "Cine y Series":
      return "bg-rose-950/60 text-rose-300 border-rose-800/50";
    case "Música":
      return "bg-cyan-950/60 text-cyan-300 border-cyan-800/50";
    case "Sociedad y Sucesos":
      return "bg-orange-950/60 text-orange-300 border-orange-800/50";
    case "Gastronomía":
      return "bg-yellow-950/60 text-yellow-300 border-yellow-800/50";
    case "Viajes y Turismo":
      return "bg-teal-950/60 text-teal-300 border-teal-800/50";
    case "Motor":
      return "bg-slate-800 text-slate-300 border-slate-700";
    case "Educación":
      return "bg-blue-950/60 text-blue-300 border-blue-800/50";
    case "Moda y Belleza":
      return "bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-800/50";
    case "Hogar y Vida Diaria":
      return "bg-lime-950/60 text-lime-300 border-lime-800/50";
    case "Ciencia Ficción y Fantasía":
      return "bg-indigo-950/60 text-indigo-300 border-indigo-800/50";
    case "Ciencia":
      return "bg-purple-950/60 text-purple-300 border-purple-800/50";
    case "Celulares":
      return "bg-blue-950/60 text-blue-300 border-blue-800/50";
    case "Computadoras":
      return "bg-indigo-950/60 text-indigo-300 border-indigo-800/50";
    case "Política":
      return "bg-red-950/60 text-red-300 border-red-800/50";
    case "Cuidado ambiental":
      return "bg-emerald-950/60 text-emerald-300 border-emerald-800/50";
    case "Cuidado físico":
      return "bg-amber-950/60 text-amber-300 border-amber-800/50";
    case "Deportes":
      return "bg-orange-950/60 text-orange-300 border-orange-800/50";
    case "Salud":
      return "bg-rose-950/60 text-rose-300 border-rose-800/50";
    case "Economía":
      return "bg-green-950/60 text-green-300 border-green-800/50";
    case "Uso personal":
      return "bg-cyan-950/60 text-cyan-300 border-cyan-800/50";
    case "Vida diaria":
      return "bg-teal-950/60 text-teal-300 border-teal-800/50";
    case "Tecnología":
      return "bg-sky-950/60 text-sky-300 border-sky-800/50";
    default:
      return "bg-gray-800 text-gray-300 border-gray-700/80";
  }
};

// Función auxiliar para formatear la fecha de publicación de forma legible
const formatFecha = (fechaStr) => {
  // Si no hay fecha, usamos la fecha actual o un texto por defecto para pruebas
  const fechaObj = fechaStr ? new Date(fechaStr) : new Date();
  try {
    if (isNaN(fechaObj.getTime())) return "Reciente";
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(fechaObj);
  } catch {
    return "Reciente";
  }
};

export default function ArticleReaderModal({ article, onClose, onToggleRead, onToggleSave, onUpdateCategory, onIrAId, anteriorId, siguienteId, posicion, total }) {
  const [savingAction, setSavingAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [editandoCategoria, setEditandoCategoria] = useState(false);
  const [categoriaElegida, setCategoriaElegida] = useState("");
  const [categorias, setCategorias] = useState([]);
  const [vistaLocal, setVistaLocal] = useState(null);
  const [imagenRota, setImagenRota] = useState(false);
  const [imagenOculta, setImagenOculta] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem("lector_imagen_oculta") === "1";
    } catch {
      return false;
    }
  });

  const alternarImagen = () => {
    const siguiente = !imagenOculta;
    try {
      window.localStorage.setItem("lector_imagen_oculta", siguiente ? "1" : "0");
    } catch {
      // Sin almacenamiento disponible: solo cambia en esta vista.
    }
    setImagenOculta(siguiente);
  };
  const [imagenRemota, setImagenRemota] = useState(null);
  const [cargandoImagen, setCargandoImagen] = useState(
    () => Boolean(article?.url_original) && !article?.imagen_url
  );
  const clicIniciadoEnFondo = useRef(false);
  const toqueInicial = useRef(null);
  const contenedorRef = useRef(null);
  const [mostrarAyudaDeslizar, setMostrarAyudaDeslizar] = useState(false);
  const ultimoAvisoContadoId = useRef(null);
  // Dirección con la que se entró a esta noticia: define la animación de entrada.
  const [direccionEntrada] = useState(() => direccionNavegacion);

  // Navegación centralizada: registra la dirección para animar la entrada y el
  // instante del cambio para el enfriamiento del scroll con rueda.
  const navegar = (direccion, id) => {
    if (id == null) return false;
    direccionNavegacion = direccion;
    ultimoCambioRueda = Date.now();
    return onIrAId(id);
  };

  const manejarInicioToque = (event) => {
    const toque = event.touches?.[0];
    if (toque) toqueInicial.current = { x: toque.clientX, y: toque.clientY };
  };

  const manejarFinToque = (event) => {
    const inicio = toqueInicial.current;
    toqueInicial.current = null;
    if (!inicio || editandoCategoria) return;
    const toque = event.changedTouches?.[0];
    if (!toque) return;
    const dx = toque.clientX - inicio.x;
    const dy = toque.clientY - inicio.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && siguienteId != null) navegar(1, siguienteId);
      else if (dx > 0 && anteriorId != null) navegar(-1, anteriorId);
    }
  };

  const manejarClickFondo = (event) => {
    if (clicIniciadoEnFondo.current && event.target === event.currentTarget) {
      onClose();
    }
    clicIniciadoEnFondo.current = false;
  };

  useEffect(() => {
    if (!article) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      const objetivo = event.target;
      const escribiendo = Boolean(
        objetivo && (objetivo.tagName === "INPUT" || objetivo.tagName === "TEXTAREA" || objetivo.isContentEditable)
      );
      if (editandoCategoria || escribiendo || objetivo?.tagName === "SELECT") return;
      if (event.key === "ArrowLeft" && anteriorId != null) {
        event.preventDefault();
        navegar(-1, anteriorId);
      }
      if (event.key === "ArrowRight" && siguienteId != null) {
        event.preventDefault();
        navegar(1, siguienteId);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [article, onClose, onIrAId, anteriorId, siguienteId, editandoCategoria]);

  // Scroll con rueda del mouse en PC: al llegar al borde del contenido, el gesto
  // cambia de noticia (abajo = siguiente, arriba = anterior). Solo con puntero
  // fino para no interferir con el gesto táctil en móvil.
  useEffect(() => {
    if (!article) return undefined;
    const contenedor = contenedorRef.current;
    if (!contenedor || typeof window === "undefined") return undefined;
    let punteroFino = false;
    try {
      punteroFino = window.matchMedia("(pointer: fine)").matches;
    } catch {
      punteroFino = false;
    }
    if (!punteroFino) return undefined;

    const UMBRAL_PX = 60;
    const ENFRIAMIENTO_MS = 900;
    let acumulado = 0;
    let temporizadorReposo = null;

    const manejarRueda = (event) => {
      // Enfriamiento global (sobrevive al remontaje por cambio de noticia).
      if (Date.now() - ultimoCambioRueda < ENFRIAMIENTO_MS) return;
      let delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (event.deltaMode === 1) delta *= 16; // líneas -> píxeles aproximados
      if (!delta) return;
      acumulado += delta;
      if (temporizadorReposo) clearTimeout(temporizadorReposo);
      temporizadorReposo = setTimeout(() => {
        acumulado = 0;
      }, 160);
      if (Math.abs(acumulado) < UMBRAL_PX) return;
      const haciaSiguiente = acumulado > 0;
      const puedeBajar = contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight > 2;
      const estaArriba = contenedor.scrollTop <= 0;
      acumulado = 0;
      if (haciaSiguiente) {
        // Si queda contenido por leer, el scroll sigue su curso normal.
        if (puedeBajar || siguienteId == null) return;
        event.preventDefault();
        navegar(1, siguienteId);
      } else {
        // Si no está al inicio, el scroll sigue su curso normal.
        if (!estaArriba || anteriorId == null) return;
        event.preventDefault();
        navegar(-1, anteriorId);
      }
    };

    contenedor.addEventListener("wheel", manejarRueda, { passive: false });
    return () => {
      contenedor.removeEventListener("wheel", manejarRueda);
      if (temporizadorReposo) clearTimeout(temporizadorReposo);
    };
  }, [article, onIrAId, anteriorId, siguienteId]);

  useEffect(() => {
    if (!article) return undefined;
    const idNoticia = String(article.id ?? article.url_original ?? posicion ?? "");
    // Evita contar dos veces la misma noticia (StrictMode / remontajes).
    if (ultimoAvisoContadoId.current === idNoticia) return undefined;
    try {
      if (window.sessionStorage.getItem("lector_aviso_deslizar_ultimo_id") === idNoticia) {
        ultimoAvisoContadoId.current = idNoticia;
        return undefined;
      }
    } catch {
      // Sin almacenamiento disponible: se continúa con el conteo en memoria.
    }
    // Solo se muestra en móvil (donde las flechas están ocultas y el gesto es la vía de navegación).
    let esMovil = false;
    try {
      esMovil = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
    } catch {
      esMovil = false;
    }
    if (!esMovil) return undefined;
    // Solo en las 3 primeras noticias vistas por sesión (se reinicia al cerrar sesión / pestaña).
    let vistas = 0;
    try {
      vistas = Number(window.sessionStorage.getItem("lector_aviso_deslizar_vistas") || "0") || 0;
    } catch {
      vistas = 0;
    }
    if (vistas >= 3) {
      setMostrarAyudaDeslizar(false);
      return undefined;
    }
    ultimoAvisoContadoId.current = idNoticia;
    try {
      window.sessionStorage.setItem("lector_aviso_deslizar_vistas", String(vistas + 1));
      window.sessionStorage.setItem("lector_aviso_deslizar_ultimo_id", idNoticia);
    } catch {
      // Sin almacenamiento disponible: se muestra igual esta vez.
    }
    setMostrarAyudaDeslizar(true);
    const temporizador = setTimeout(() => setMostrarAyudaDeslizar(false), 2500);
    return () => clearTimeout(temporizador);
  }, [article?.id]);

  useEffect(() => {
    if (!article || article.imagen_url || !article.url_original) return undefined;
    let vivo = true;
    fetch(`/api/rss?tipo=imagen&url=${encodeURIComponent(article.url_original)}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (data.imagen) setImagenRemota(data.imagen);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setCargandoImagen(false);
      });
    return () => {
      vivo = false;
    };
  }, [article]);

  if (!article) return null;

  const imagenVisible = article.imagen_url || imagenRemota;

  const categoriaMostrada = vistaLocal?.categoria ?? article.categoria;
  const metodoMostrado = vistaLocal?.metodo ?? article.clasificacion_metodo;
  const confianzaMostrada = vistaLocal?.confianza ?? article.clasificacion_confianza;

  const handleMarcarLeido = async () => {
    setSavingAction("leido");
    setActionError("");
    const actualizado = await onToggleRead(article.id, Boolean(article.leido));
    setSavingAction("");
    if (actualizado) {
      if (siguienteId == null || !onIrAId(siguienteId)) onClose();
    } else setActionError("No se pudo actualizar el estado de lectura.");
  };

  const handleGuardar = async () => {
    setSavingAction("guardado");
    setActionError("");
    const actualizado = await onToggleSave(article.id, Boolean(article.guardado));
    setSavingAction("");
    if (actualizado) {
      if (siguienteId == null || !onIrAId(siguienteId)) onClose();
    } else setActionError("No se pudo actualizar el estado guardado.");
  };

  const iniciarEdicionCategoria = async () => {
    setActionError("");
    setCategoriaElegida(categoriaMostrada || "General");
    setEditandoCategoria(true);
    if (categorias.length > 0) return;
    try {
      const res = await fetch("/api/rss?tipo=categorias", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (Array.isArray(data)) setCategorias(data);
    } catch {
      setActionError("No se pudo cargar el catálogo de categorías.");
      setEditandoCategoria(false);
    }
  };

  const guardarCategoria = async () => {
    if (!categoriaElegida || !onUpdateCategory) return;
    setSavingAction("categoria");
    setActionError("");
    const actualizado = await onUpdateCategory(article.id, categoriaElegida);
    setSavingAction("");
    if (actualizado) {
      setVistaLocal({ categoria: categoriaElegida, metodo: "manual", confianza: 1 });
      setEditandoCategoria(false);
    } else {
      setActionError("No se pudo actualizar la categoría.");
    }
  };

  const fechaFormateada = formatFecha(article.fecha_publicacion);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
      role="presentation"
      onMouseDown={(event) => {
        clicIniciadoEnFondo.current = event.target === event.currentTarget;
      }}
      onClick={manejarClickFondo}
    >
      <button
        onClick={(event) => {
          event.stopPropagation();
          if (anteriorId != null) navegar(-1, anteriorId);
        }}
        disabled={anteriorId == null}
        title="Noticia anterior"
        aria-label="Noticia anterior"
        className="hidden sm:block fixed top-1/2 -translate-y-1/2 left-2 sm:left-[max(0.75rem,calc(50%-24rem-3.5rem))] z-10 rounded-full bg-gray-800/80 border border-gray-700 p-3 text-gray-300 hover:text-white hover:border-sky-600/60 hover:bg-gray-800 transition disabled:opacity-25 disabled:pointer-events-none shadow-xl backdrop-blur-sm"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={(event) => {
          event.stopPropagation();
          if (siguienteId != null) navegar(1, siguienteId);
        }}
        disabled={siguienteId == null}
        title="Noticia siguiente"
        aria-label="Noticia siguiente"
        className="hidden sm:block fixed top-1/2 -translate-y-1/2 right-2 sm:right-[max(0.75rem,calc(50%-24rem-3.5rem))] z-10 rounded-full bg-gray-800/80 border border-gray-700 p-3 text-gray-300 hover:text-white hover:border-sky-600/60 hover:bg-gray-800 transition disabled:opacity-25 disabled:pointer-events-none shadow-xl backdrop-blur-sm"
      >
        <ChevronRight size={22} />
      </button>
      <div
        ref={contenedorRef}
        className={`bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden overscroll-contain flex flex-col [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          direccionEntrada > 0
            ? "anim-articulo-siguiente"
            : direccionEntrada < 0
              ? "anim-articulo-anterior"
              : "anim-articulo-apertura"
        }`}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={manejarInicioToque}
        onTouchEnd={manejarFinToque}
      >
      <div className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 flex flex-col justify-between relative z-10">
        {/* Cabecera del modal */}
        <div>
          <div className="flex justify-between items-start gap-2 sm:gap-4 mb-2 sm:mb-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 flex-wrap text-[11px] sm:text-xs text-gray-400">
              {article.fuente_nombre && (
                <span className="flex min-w-0 max-w-[52vw] sm:max-w-none items-center gap-1 bg-gray-800 border border-gray-700 text-sky-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-medium">
                  <Globe size={12} className="shrink-0" />
                  <span className="truncate">{article.fuente_nombre}</span>
                </span>
              )}
              {editandoCategoria ? (
                <span className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 px-2 py-1 rounded-md">
                  <Tag size={12} className="opacity-75 shrink-0" />
                  <select
                    value={categoriaElegida}
                    onChange={(event) => setCategoriaElegida(event.target.value)}
                    disabled={Boolean(savingAction)}
                    aria-label="Elegir categoría"
                    className="bg-transparent text-xs text-white outline-none cursor-pointer max-w-40 disabled:opacity-50"
                  >
                    {categorias.map((nombre) => (
                      <option key={nombre} value={nombre} className="bg-gray-900">
                        {nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={guardarCategoria}
                    disabled={Boolean(savingAction)}
                    title="Guardar categoría"
                    aria-label="Guardar categoría"
                    className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 shrink-0"
                  >
                    <Save size={13} />
                  </button>
                  <button
                    onClick={() => setEditandoCategoria(false)}
                    disabled={Boolean(savingAction)}
                    title="Cancelar"
                    aria-label="Cancelar edición de categoría"
                    className="text-gray-400 hover:text-white disabled:opacity-50 shrink-0"
                  >
                    <X size={13} />
                  </button>
                </span>
              ) : (
                <>
                  {categoriaMostrada && (
                    <span style={getCategoryColor(categoriaMostrada)} className="flex items-center gap-1 border px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-medium whitespace-nowrap">
                      <Tag size={12} className="opacity-75 shrink-0" />
                      {categoriaMostrada}
                    </span>
                  )}
                  <button
                    onClick={iniciarEdicionCategoria}
                    title="Corregir categoría"
                    aria-label="Corregir categoría"
                    className="flex items-center border border-gray-700/60 bg-gray-800/60 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-gray-400 hover:text-sky-400 hover:border-sky-600/50 transition shrink-0"
                  >
                    <Pencil size={12} />
                  </button>
                </>
              )}
              {metodoMostrado && (
                <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md whitespace-nowrap">
                  {metodoMostrado === "gemini" ? "IA" : metodoMostrado === "manual" ? "Manual" : "Sin IA"} · {Math.round(Number(confianzaMostrada || 0) * 100)}%
                </span>
              )}
              {fechaFormateada && (
                <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md whitespace-nowrap">
                  <Calendar size={12} className="opacity-75 shrink-0" />
                  {fechaFormateada}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {posicion && total ? (
                <span className="text-xs text-gray-500 tabular-nums" aria-label={`Noticia ${posicion} de ${total}`}>
                  {posicion} / {total}
                </span>
              ) : null}
              {imagenVisible && !imagenRota && (
                <button
                  onClick={alternarImagen}
                  title={imagenOculta ? "Mostrar imagen de fondo" : "Ocultar imagen de fondo"}
                  aria-label={imagenOculta ? "Mostrar imagen de fondo" : "Ocultar imagen de fondo"}
                  aria-pressed={imagenOculta}
                  className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition shrink-0"
                >
                  {imagenOculta ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Cerrar lector de noticia"
                className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition shrink-0"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Título completo */}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-snug mb-4 break-words">
            {article.titulo}
          </h2>

          {/* Cuerpo / Resumen de la noticia (sin scroll interno: usa el scroll del modal) */}
          <div className="text-gray-300 text-sm md:text-base leading-relaxed space-y-3 break-words">
            <p>{article.resumen || "Sin resumen disponible para esta noticia."}</p>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {actionError}
          </p>
        )}

        {/* Acciones del pie */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={handleMarcarLeido}
            disabled={Boolean(savingAction)}
            className={`px-1.5 sm:px-3 py-2 sm:py-2 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center transition min-w-0 ${
              article.leido
                ? "bg-emerald-950/60 border border-emerald-800/60 text-emerald-400"
                : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Check size={14} className="shrink-0" />
            <span className="leading-tight">{savingAction === "leido" ? "Guardando..." : article.leido ? "Leído" : "Marcar como leído"}</span>
          </button>

          <button
            onClick={handleGuardar}
            disabled={Boolean(savingAction)}
            className={`px-1.5 sm:px-3 py-2 rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center transition min-w-0 ${
              article.guardado
                ? "bg-amber-950/60 border border-amber-800/60 text-amber-400"
                : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Bookmark size={14} className="shrink-0" />
            <span className="leading-tight">{savingAction === "guardado" ? "Guardando..." : article.guardado ? "Guardado" : "Guardar"}</span>
          </button>

          <a
            href={article.url_original}
            target="_blank"
            rel="noopener noreferrer"
            className="px-1.5 sm:px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center transition shadow-lg shadow-sky-600/20 min-w-0"
          >
            <span className="leading-tight">Ir al sitio oficial</span>
            <ExternalLink size={14} className="shrink-0" />
          </a>
        </div>
      </div>
      {(imagenVisible || cargandoImagen) && !imagenRota && !imagenOculta && (
        <div className="order-first sm:order-none sm:absolute sm:inset-y-0 sm:right-0 sm:w-1/2 shrink-0 sm:rounded-r-2xl sm:overflow-hidden" aria-hidden="true">
          {imagenVisible ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagenVisible}
                alt=""
                aria-hidden="true"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImagenRota(true)}
                className="h-44 sm:h-full w-full object-cover opacity-60 rounded-t-2xl sm:rounded-none sm:[mask-image:linear-gradient(to_right,transparent_0%,black_40%,black_100%)] sm:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_40%,black_100%)]"
              />
              <div aria-hidden="true" className="hidden sm:block absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900/70 to-transparent" />
            </>
          ) : (
            <div aria-hidden="true" className="h-44 sm:h-full w-full animate-pulse bg-gray-800 rounded-t-2xl sm:rounded-none" />
          )}
        </div>
      )}
      </div>
      {mostrarAyudaDeslizar && (
        <div className="sm:hidden fixed top-8 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            aria-live="polite"
            className="animate-swipe-hint flex max-w-full items-center gap-2 bg-gray-800/95 border border-gray-700 text-gray-200 text-xs font-medium px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-sm whitespace-nowrap"
          >
            <MoveHorizontal size={16} className="animate-swipe-hint-icon text-sky-400 shrink-0" />
            <span>Desliza para cambiar de noticia</span>
          </div>
        </div>
      )}
    </div>
  );
}