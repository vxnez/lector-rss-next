// src/app/components/ArticleReaderModal.js
"use client";

import { X, ExternalLink, Check, Tag, Globe, Calendar, Pencil, Save, ChevronLeft, ChevronRight, MoveHorizontal, Clock, Type } from "lucide-react";
import { Eye as EyeData, EyeOff as EyeOffData, Bookmark as BookmarkData, BookmarkCheck as BookmarkCheckData } from "lucide";
import MorphIcon from "./MorphIcon";
import { getCategoryStyle } from "@/lib/categoryStyles";
import { tiempoLecturaMinutos } from "@/lib/lectura";
import { formatFecha } from "@/lib/formato";
import { useBloquearScroll } from "@/lib/useBloquearScroll";
import { useIdioma } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";

const TAMANOS_LECTURA = {
  normal: "text-sm md:text-base",
  grande: "text-base md:text-lg",
  extra: "text-lg md:text-xl leading-relaxed",
};
const ORDEN_TAMANOS = ["normal", "grande", "extra"];

// Dirección de la última navegación entre noticias (1 = siguiente, -1 = anterior, 0 = apertura).
// Vive a nivel de módulo porque el modal se remontan con `key` por noticia y el estado se pierde.
let direccionNavegacion = 0;
// Marca temporal del último cambio por rueda para evitar saltos múltiples con un solo gesto.
let ultimoCambioRueda = 0;

// Fuente única de verdad: lib/categoryStyles. (Se eliminó el switch duplicado muerto.)
const getCategoryColor = (categoria) => getCategoryStyle(categoria);



// Fecha legible con cache compartido en lib/formato.
const formatFechaArticulo = (fechaStr, t, locale) => formatFecha(fechaStr, t("tarjeta.reciente"), locale);

export default function ArticleReaderModal({ article, onClose, onToggleRead, onToggleSave, onUpdateCategory, onIrAId, anteriorId, siguienteId, posicion, total }) {
  const { t, locale } = useIdioma();
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
  // Tamaño de letra del cuerpo (persistido por navegador).
  const [tamanoLectura, setTamanoLectura] = useState(() => {
    try {
      const guardado = window.localStorage.getItem("lector_tamano_fuente");
      return ORDEN_TAMANOS.includes(guardado) ? guardado : "normal";
    } catch {
      return "normal";
    }
  });
  const ciclarTamanoLectura = () => {
    const siguiente = ORDEN_TAMANOS[(ORDEN_TAMANOS.indexOf(tamanoLectura) + 1) % ORDEN_TAMANOS.length];
    try {
      window.localStorage.setItem("lector_tamano_fuente", siguiente);
    } catch {
      // Sin almacenamiento disponible: solo cambia en esta vista.
    }
    setTamanoLectura(siguiente);
  };
  const [cargandoImagen, setCargandoImagen] = useState(
    () => Boolean(article?.url_original) && !article?.imagen_url
  );
  const clicIniciadoEnFondo = useRef(false);
  const toqueInicial = useRef(null);
  const contenedorRef = useRef(null);
  // Se calcula en el init (el modal se remonta por noticia vía `key`): móvil,
  // cupo de 3 vistas por sesión y noticia no vista. Sin setState en efectos.
  const [mostrarAyudaDeslizar, setMostrarAyudaDeslizar] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      if (!window.matchMedia("(max-width: 639px)").matches) return false;
      const id = String(article?.id ?? article?.url_original ?? "");
      if (window.sessionStorage.getItem("lector_aviso_deslizar_ultimo_id") === id) return false;
      const vistas = Number(window.sessionStorage.getItem("lector_aviso_deslizar_vistas") || "0") || 0;
      return vistas < 3;
    } catch {
      return false;
    }
  });
  const ultimoAvisoContadoId = useRef(null);
  // Dirección con la que se entró a esta noticia: define la animación de entrada.
  const [direccionEntrada] = useState(() => direccionNavegacion);
  // La página de fondo no se desplaza mientras el lector está abierto.
  useBloquearScroll(Boolean(article));

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

  // Aviso "desliza" (móvil, 3 primeras noticias por sesión): el estado inicial
  // ya decide si se muestra; el efecto solo cuenta la vista y lo oculta.
  // El setState en el callback del timeout es asíncrono y está permitido.
  useEffect(() => {
    if (!article || !mostrarAyudaDeslizar) return undefined;
    const idNoticia = String(article.id ?? article.url_original ?? posicion ?? "");
    if (ultimoAvisoContadoId.current === idNoticia) return undefined;
    ultimoAvisoContadoId.current = idNoticia;
    try {
      const vistas = Number(window.sessionStorage.getItem("lector_aviso_deslizar_vistas") || "0") || 0;
      window.sessionStorage.setItem("lector_aviso_deslizar_vistas", String(vistas + 1));
      window.sessionStorage.setItem("lector_aviso_deslizar_ultimo_id", idNoticia);
    } catch {
      // Sin almacenamiento disponible: el aviso igual se oculta por timeout.
    }
    const temporizador = setTimeout(() => setMostrarAyudaDeslizar(false), 2500);
    return () => clearTimeout(temporizador);
  }, [article, mostrarAyudaDeslizar, posicion]);

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
    } else setActionError(t("lector.err_lectura"));
  };

  const handleGuardar = async () => {
    setSavingAction("guardado");
    setActionError("");
    const actualizado = await onToggleSave(article.id, Boolean(article.guardado));
    setSavingAction("");
    if (actualizado) {
      if (siguienteId == null || !onIrAId(siguienteId)) onClose();
    } else setActionError(t("lector.err_guardado"));
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
      setActionError(t("lector.err_catalogo"));
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
      setActionError(t("lector.err_categoria"));
    }
  };

  const fechaFormateada = formatFechaArticulo(article.fecha_publicacion, t, locale);
  const minutosLectura = tiempoLecturaMinutos(article.titulo, article.resumen);

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
        title={t("lector.anterior")}
        aria-label={t("lector.anterior")}
        className="btn-press hidden sm:block fixed top-1/2 -translate-y-1/2 left-2 sm:left-[max(0.75rem,calc(50%-24rem-3.5rem))] z-10 rounded-full bg-gray-800/80 border border-gray-700 p-3 text-gray-300 hover:text-white hover:border-sky-600/60 hover:bg-gray-800 disabled:opacity-25 disabled:pointer-events-none shadow-xl backdrop-blur-sm"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={(event) => {
          event.stopPropagation();
          if (siguienteId != null) navegar(1, siguienteId);
        }}
        disabled={siguienteId == null}
        title={t("lector.siguiente")}
        aria-label={t("lector.siguiente")}
        className="btn-press hidden sm:block fixed top-1/2 -translate-y-1/2 right-2 sm:right-[max(0.75rem,calc(50%-24rem-3.5rem))] z-10 rounded-full bg-gray-800/80 border border-gray-700 p-3 text-gray-300 hover:text-white hover:border-sky-600/60 hover:bg-gray-800 disabled:opacity-25 disabled:pointer-events-none shadow-xl backdrop-blur-sm"
      >
        <ChevronRight size={22} />
      </button>
      <div
        ref={contenedorRef}
        className={`bg-app-surface border border-app-line rounded-2xl w-full max-w-3xl shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-y-auto overflow-x-hidden overscroll-contain flex flex-col [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
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
          {/* Píldoras y acciones del chrome: no traducibles (la app ya tiene
              ES/EN propio) para que el traductor no reestructure nodos que
              React desmonta al navegar. El título y el resumen sí se traducen. */}
          <div className="flex justify-between items-start gap-2 sm:gap-4 mb-2 sm:mb-3 notranslate" translate="no">
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
                    aria-label={t("lector.elegir_cat")}
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
                    title={t("lector.guardar_cat")}
                    aria-label={t("lector.guardar_cat")}
                    className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50 shrink-0"
                  >
                    <Save size={13} />
                  </button>
                  <button
                    onClick={() => setEditandoCategoria(false)}
                    disabled={Boolean(savingAction)}
                    title={t("comun.cancelar")}
                    aria-label={t("lector.cancelar_cat")}
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
                    title={t("lector.corregir_cat")}
                    aria-label={t("lector.corregir_cat")}
                    className="flex items-center border border-gray-700/60 bg-gray-800/60 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-gray-400 hover:text-sky-400 hover:border-sky-600/50 transition shrink-0"
                  >
                    <Pencil size={12} />
                  </button>
                </>
              )}
              {metodoMostrado && (
                <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md whitespace-nowrap">
                  {metodoMostrado === "gemini" ? t("lector.ia") : metodoMostrado === "manual" ? t("lector.manual") : t("lector.sin_ia")} · {Math.round(Number(confianzaMostrada || 0) * 100)}%
                </span>
              )}
              {fechaFormateada && (
                <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md whitespace-nowrap">
                  <Calendar size={12} className="opacity-75 shrink-0" />
                  {fechaFormateada}
                </span>
              )}
              <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md whitespace-nowrap" title={t("tarjeta.min_titulo", { n: minutosLectura })}>
                <Clock size={12} className="opacity-75 shrink-0" />
                {t("tarjeta.min", { n: minutosLectura })}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {posicion && total ? (
                <span className="text-xs text-gray-500 tabular-nums" aria-label={t("lector.posicion", { a: posicion, b: total })}>
                  {posicion} / {total}
                </span>
              ) : null}
              <button
                onClick={ciclarTamanoLectura}
                title={t("lector.letra_t", { t: tamanoLectura })}
                aria-label={t("lector.letra_aria", { t: tamanoLectura })}
                className="btn-press text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 shrink-0"
              >
                <Type size={16} />
              </button>
              {imagenVisible && !imagenRota && (
                <button
                  onClick={alternarImagen}
                  title={imagenOculta ? t("lector.img_mostrar") : t("lector.img_ocultar")}
                  aria-label={imagenOculta ? t("lector.img_mostrar") : t("lector.img_ocultar")}
                  aria-pressed={imagenOculta}
                  className="btn-press text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 shrink-0"
                >
                  <MorphIcon icon={imagenOculta ? EyeOffData : EyeData} size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                aria-label={t("lector.cerrar")}
                className="btn-press text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 shrink-0"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Título completo */}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-app-fg leading-snug mb-4 break-words">
            {article.titulo}
          </h2>

          {/* Cuerpo / Resumen de la noticia (sin scroll interno: usa el scroll del modal) */}
          <div className={`text-app-fg/90 leading-relaxed space-y-3 break-words ${TAMANOS_LECTURA[tamanoLectura] || TAMANOS_LECTURA.normal}`}>
            <p>{article.resumen || t("lector.sin_resumen")}</p>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {actionError}
          </p>
        )}

        {/* Acciones del pie */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mt-6 pt-4 border-t border-app-line notranslate" translate="no">
          <button
            onClick={handleMarcarLeido}
            disabled={Boolean(savingAction)}
            className={`btn-press px-1.5 sm:px-3 py-2 sm:py-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center min-w-0 ${
              article.leido
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <Check size={14} className="shrink-0" />
            <span className="leading-tight">{savingAction === "leido" ? t("lector.guardando") : article.leido ? t("lector.leido") : t("lector.marcar")}</span>
          </button>

          <button
            onClick={handleGuardar}
            disabled={Boolean(savingAction)}
            className={`btn-press px-1.5 sm:px-3 py-2 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center min-w-0 ${
              article.guardado
                ? "bg-amber-500/15 border border-amber-500/40 text-amber-400"
                : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <MorphIcon icon={article.guardado ? BookmarkCheckData : BookmarkData} size={14} className="shrink-0" />
            <span className="leading-tight">{savingAction === "guardado" ? t("lector.guardando") : article.guardado ? t("lector.guardado") : t("lector.guardar")}</span>
          </button>

          <a
            href={article.url_original}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-press group px-1.5 sm:px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center hover:shadow-lg hover:shadow-sky-600/20 min-w-0"
          >
            <span className="leading-tight">{t("lector.sitio")}</span>
            <ExternalLink size={14} className="shrink-0 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
      </div>
      {(imagenVisible || cargandoImagen) && !imagenRota && !imagenOculta && (
        <div className="absolute inset-x-0 top-0 h-[55%] overflow-hidden rounded-t-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-auto sm:w-1/2 sm:rounded-none sm:rounded-r-2xl" aria-hidden="true">
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
                className="h-full w-full object-cover opacity-50 sm:opacity-60 rounded-t-2xl sm:rounded-none [mask-image:linear-gradient(to_bottom,black_50%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_98%)] sm:[mask-image:linear-gradient(to_right,transparent_0%,black_40%,black_100%)] sm:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_40%,black_100%)]"
              />
              <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-gray-900/0 via-gray-900/55 to-gray-900 sm:bg-linear-to-r sm:from-gray-900 sm:via-gray-900/70 sm:to-transparent" />
            </>
          ) : (
            <div aria-hidden="true" className="h-full w-full animate-pulse bg-gray-800 rounded-t-2xl sm:rounded-none" />
          )}
        </div>
      )}
      </div>
      {mostrarAyudaDeslizar && (
        <div className="sm:hidden fixed top-8 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
          <div
            role="status"
            aria-live="polite"
            translate="no"
            className="animate-swipe-hint flex max-w-full items-center gap-2 bg-gray-800/95 border border-gray-700 text-gray-200 text-xs font-medium px-4 py-2.5 rounded-full shadow-2xl backdrop-blur-sm whitespace-nowrap notranslate"
          >
            <MoveHorizontal size={16} className="animate-swipe-hint-icon text-sky-400 shrink-0" />
            <span>{t("lector.desliza")}</span>
          </div>
        </div>
      )}
    </div>
  );
}