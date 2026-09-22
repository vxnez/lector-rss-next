// src/app/components/ArticleReaderModal.js
"use client";

import { X, ExternalLink, Tag, Globe, Calendar, Pencil, Save, ChevronLeft, ChevronRight, MoveHorizontal, Clock, Share2, Volume2, VolumeX, Check } from "lucide-react";
import Image from "next/image";
import { Check as CheckData, CheckCheck as CheckCheckData, Eye as EyeData, EyeOff as EyeOffData, Bookmark as BookmarkData, BookmarkCheck as BookmarkCheckData } from "lucide";
import MorphIcon from "./MorphIcon";
import ResumenEstructurado from "./ResumenEstructurado";
import { confianzaIAVisible } from "@/lib/categoryStyles";
import InsigniaCategoria from "./InsigniaCategoria";
import { tiempoLecturaMinutos, detectarIdiomaTexto } from "@/lib/lectura";
import { formatFecha } from "@/lib/formato";
import { useBloquearScroll } from "@/lib/useBloquearScroll";
import { useIdioma } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from "react";

// El cuerpo usa tamaño fijo "normal": la escala global la da --font-size-base
// (slider de Ajustes > Lectura), así que el lector no necesita estados.

// Dirección de la última navegación entre noticias (1 = siguiente, -1 = anterior, 0 = apertura).
// Vive a nivel de módulo porque el modal se remontan con `key` por noticia y el estado se pierde.
let direccionNavegacion = 0;

// Fecha legible con cache compartido en lib/formato.
const formatFechaArticulo = (fechaStr, t, locale) => formatFecha(fechaStr, t("tarjeta.reciente"), locale);

// Fecha estimada por el servidor cuando el feed no trae fecha válida.
function esFechaEstimada(article) {
  const marca = article?.fecha_estimada;
  return marca === 1 || marca === "1" || marca === true;
}

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
  const [videoRemoto, setVideoRemoto] = useState(null);
  const [videoRoto, setVideoRoto] = useState(false);
  // Aviso cuando no hay medios que ocultar: se muestra al pulsar el ojo.
  const [avisoSinMedios, setAvisoSinMedios] = useState(false);
  // Si la optimización next/image falla (CDN que bloquea al servidor),
  // se reintenta con <img> directo al origen antes de darla por rota.
  const [sinOptimizar, setSinOptimizar] = useState(false);
  // El cuerpo usa tamaño fijo: la escala global la da --font-size-base.

  // Barra de progreso de lectura
  const [progresoLectura, setProgresoLectura] = useState(0);
  const manejarScroll = useCallback((e) => {
    const el = e.currentTarget;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 0) {
      setProgresoLectura(100);
    } else {
      setProgresoLectura(Math.min(Math.max((el.scrollTop / maxScroll) * 100, 0), 100));
    }
  }, []);

  // Text-to-Speech nativo (Web Speech API)
  const [hablando, setHablando] = useState(false);
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [article?.id]);

  const alternarVoz = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (hablando) {
      window.speechSynthesis.cancel();
      setHablando(false);
      return;
    }
    const texto = `${article?.titulo || ""}. ${article?.resumen || ""}`;
    const utterance = new SpeechSynthesisUtterance(texto);
    // La traducción de noticias la hace el navegador del usuario: la voz
    // sigue el idioma detectado del texto original (heurística local).
    const idiomaVoz = detectarIdiomaTexto(article?.titulo, article?.resumen);
    utterance.lang =
      idiomaVoz === "en" ? "en-US"
      : idiomaVoz === "fr" ? "fr-FR"
      : idiomaVoz === "pt" ? "pt-BR"
      : idiomaVoz === "de" ? "de-DE"
      : "es-ES";
    try {
      const voces = window.speechSynthesis.getVoices?.() || [];
      const voz = voces.find((v) => String(v.lang || "").toLowerCase().startsWith(idiomaVoz));
      if (voz) utterance.voice = voz;
    } catch {
      // Sin voces enumerables: el navegador elige por lang.
    }
    utterance.rate = 1.0;
    utterance.onend = () => setHablando(false);
    utterance.onerror = () => setHablando(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setHablando(true);
  };

  // Copiar enlace y Web Share API
  const [copiado, setCopiado] = useState(false);
  const compartirArticulo = async () => {
    const url = article?.url_original || article?.link;
    if (!url) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: article?.titulo || "Noticia",
          url,
        });
        return;
      } catch (err) {
        if (err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Ignorar
    }
  };

  const [cargandoImagen, setCargandoImagen] = useState(
    () => Boolean(article?.url_original) && !article?.imagen_url && !article?.video_url
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

  // Navegación centralizada: registra la dirección para animar la entrada.
  // Teclado (flechas o A/D) y botones en PC; gesto táctil lateral en móvil.
  // La rueda del mouse queda libre para leer (sin saltos por scroll).
  const navegar = useCallback((direccion, id) => {
    if (id == null) return false;
    direccionNavegacion = direccion;
    return onIrAId(id);
  }, [onIrAId]);

  // Gesto táctil solo-móvil: deslizar horizontal cambia de noticia. No
  // interfiere con el scroll vertical del texto (se exige predominancia
  // horizontal 1.5x) ni con la edición de categoría.
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
      const tecla = String(event.key || "").toLowerCase();
      if ((tecla === "arrowleft" || tecla === "a") && anteriorId != null) {
        event.preventDefault();
        navegar(-1, anteriorId);
      }
      if ((tecla === "arrowright" || tecla === "d") && siguienteId != null) {
        event.preventDefault();
        navegar(1, siguienteId);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [article, onClose, navegar, anteriorId, siguienteId, editandoCategoria]);

  // Sin gestos de rueda para cambiar de noticia: solo teclado (flechas o
  // A/D), botones laterales y gesto táctil en móvil. El scroll con rueda
  // queda libre para leer.

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
    // Solo se descubre bajo demanda cuando el artículo no trae medios:
    // lo hallado (imagen y/o video og:video) se persiste en el servidor.
    if (!article || !article.url_original || article.imagen_url || article.video_url) return undefined;
    let vivo = true;
    // Se envía el id para que el servidor persista la imagen hallada en el
    // artículo y no haya que re-extraerla en futuras aperturas.
    const idNumerico = Number(article.id);
    const parametroId = Number.isInteger(idNumerico) && idNumerico > 0 ? `&id=${idNumerico}` : "";
    fetch(`/api/rss?tipo=imagen&url=${encodeURIComponent(article.url_original)}${parametroId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (data.imagen) setImagenRemota(data.imagen);
        if (data.video) setVideoRemoto(data.video);
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
  // El video (del feed o de og:video) tiene prioridad como fondo: se
  // reproduce solo, muteado y en bucle, sin controles para el usuario.
  const videoVisible = !videoRoto && (article.video_url || videoRemoto);
  const medioVisible = (imagenVisible || videoVisible || cargandoImagen) && !imagenOculta && (!imagenRota || videoVisible);
  // El ojo siempre está visible: con medios alterna el fondo; sin medios
  // muestra la nota informativa en lugar de ocultar algo inexistente.
  const tieneMedios = Boolean((imagenVisible && !imagenRota) || videoVisible);
  const manejarOjo = () => {
    if (tieneMedios) {
      alternarImagen();
      return;
    }
    setAvisoSinMedios(true);
    setTimeout(() => setAvisoSinMedios(false), 4000);
  };

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
        className={`bg-app-surface border border-app-line rounded-2xl w-full max-w-3xl shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-hidden overscroll-contain flex flex-col ${
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
        {/* Barra de progreso de lectura: relleno sólido del acento (el
            degradado translúcido anterior se veía como un corte/bug). */}
        <div className="h-1 shrink-0 bg-app-raised/40 w-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-150 ease-out"
            style={{ width: `${progresoLectura}%` }}
          />
        </div>

      {/* Zona de texto con scroll interno sutil: título, resumen completo
          (opacidad uniforme, sin fades ni recortes) y errores. El pie queda
          fijo fuera del scroll. */}
      <div
        ref={contenedorRef}
        onScroll={manejarScroll}
        className="scroll-sutil min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
      >
      <div className="min-w-0 p-4 sm:p-6 md:p-8 relative z-10">
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
                  <InsigniaCategoria
                    categoria={categoriaMostrada}
                    confianza={confianzaIAVisible({ clasificacion_metodo: metodoMostrado, clasificacion_confianza: confianzaMostrada })}
                    t={t}
                    className="flex px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md font-medium whitespace-nowrap"
                  />
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
              {fechaFormateada && (
                <span
                  className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md whitespace-nowrap"
                  title={esFechaEstimada(article) ? t("lector.fecha_estimada") : undefined}
                >
                  <Calendar size={12} className="opacity-75 shrink-0" />
                  {esFechaEstimada(article) ? `~${fechaFormateada}` : fechaFormateada}
                </span>
              )}
              <span className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 text-gray-400 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md whitespace-nowrap" title={t("tarjeta.min_titulo", { n: minutosLectura })}>
                <Clock size={12} className="opacity-75 shrink-0" />
                {t("tarjeta.min", { n: minutosLectura })}
              </span>
            </div>

            <div className="flex items-center justify-end gap-1.5 shrink-0 flex-wrap max-w-full">
              {posicion && total ? (
                <span className="text-xs text-gray-500 tabular-nums pr-1" aria-label={t("lector.posicion", { a: posicion, b: total })}>
                  {posicion} / {total}
                </span>
              ) : null}

              {/* Text to Speech */}
              <button
                type="button"
                onClick={alternarVoz}
                title={hablando ? t("lector.voz_detener_t") : t("lector.voz_escuchar_t")}
                aria-label={hablando ? t("lector.voz_detener") : t("lector.voz_escuchar")}
                className={`btn-press p-1.5 rounded-lg transition shrink-0 ${
                  hablando
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/40 animate-pulse"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {hablando ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>

              {/* Compartir o copiar enlace */}
              <button
                type="button"
                onClick={compartirArticulo}
                title={copiado ? t("lector.enlace_copiado") : t("lector.compartir_t")}
                aria-label={t("lector.compartir_t")}
                className={`btn-press p-1.5 rounded-lg transition shrink-0 ${
                  copiado
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {copiado ? <Check size={16} /> : <Share2 size={16} />}
              </button>

              {((imagenVisible && !imagenRota) || videoVisible) && (
                <button
                  type="button"
                  onClick={alternarImagen}
                  title={imagenOculta ? t("lector.img_mostrar") : t("lector.img_ocultar")}
                  aria-label={imagenOculta ? t("lector.img_mostrar") : t("lector.img_ocultar")}
                  aria-pressed={imagenOculta}
                  className="btn-press text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 shrink-0"
                >
                  <MorphIcon icon={imagenOculta ? EyeOffData : EyeData} size={16} />
                </button>
              )}
              {!tieneMedios && !cargandoImagen && (
                <span className="relative shrink-0">
                  <button
                    type="button"
                    onClick={manejarOjo}
                    title={t("lector.img_nota")}
                    aria-label={t("lector.img_nota")}
                    className="btn-press text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 shrink-0"
                  >
                    <MorphIcon icon={EyeData} size={16} />
                  </button>
                  {avisoSinMedios && (
                    <span role="status" className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-app-line bg-app-raised p-2.5 text-xs leading-relaxed text-app-fg shadow-xl">
                      {t("lector.img_nota")}
                    </span>
                  )}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label={t("lector.cerrar")}
                className="btn-press text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 shrink-0"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Título con tope de líneas para no desfasar la cabecera */}
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-app-fg leading-snug mb-4 break-words line-clamp-3 overflow-hidden">
            {article.titulo}
          </h2>

          {/* Cuerpo / Resumen estructurado completo (subtítulos, párrafos,
              viñetas) con opacidad uniforme: sin clamp, sin fades, sin botón
              de expansión. El scroll interno lo muestra todo. */}
          <div className="text-app-fg text-sm md:text-base leading-relaxed break-words">
            <ResumenEstructurado
              texto={article.resumen || t("lector.sin_resumen")}
            />
          </div>
        </div>

        {actionError && (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {actionError}
          </p>
        )}
      </div>
      </div>

        {/* Pie fijo fuera del scroll */}
        <div className="relative z-10 shrink-0 border-t border-app-line bg-app-surface px-4 py-3 sm:px-6 sm:py-4 md:px-8 notranslate" translate="no">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <button
            onClick={handleMarcarLeido}
            disabled={Boolean(savingAction)}
            className={`btn-press px-1.5 sm:px-3 py-2 sm:py-2 min-h-[44px] rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center min-w-0 ${
              article.leido
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
            }`}
          >
            <MorphIcon icon={article.leido ? CheckCheckData : CheckData} size={14} className="shrink-0" />
            <span className="leading-tight">{savingAction === "leido" ? t("lector.guardando") : article.leido ? t("lector.leido") : t("lector.marcar")}</span>
          </button>

          <button
            onClick={handleGuardar}
            disabled={Boolean(savingAction)}
            className={`btn-press px-1.5 sm:px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center min-w-0 ${
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
            className="btn-press group px-1.5 sm:px-3 py-2 min-h-[44px] bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 text-center min-w-0"
          >
            <span className="leading-tight">{t("lector.sitio")}</span>
            <ExternalLink size={14} className="shrink-0 transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </div>
        </div>
      {medioVisible && (
        <div className="absolute inset-x-0 top-0 h-[55%] overflow-hidden rounded-t-2xl" aria-hidden="true">
          {videoVisible ? (
            <>
              {/* Video de fondo: autoplay muteado (única forma permitida por
                  el navegador), en bucle y sin controles. */}
              <video
                src={videoVisible}
                className="h-full w-full object-cover opacity-50 sm:opacity-60 rounded-t-2xl [mask-image:linear-gradient(to_bottom,black_50%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_98%)]"
                autoPlay
                muted
                loop
                playsInline
                disablePictureInPicture
                preload="metadata"
                poster={imagenVisible || undefined}
                onError={() => setVideoRoto(true)}
              />
              <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-gray-900/0 via-gray-900/55 to-gray-900" />
            </>
          ) : imagenVisible ? (
            <>
              {sinOptimizar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagenVisible}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setImagenRota(true)}
                  className="h-full w-full object-cover opacity-50 sm:opacity-60 blur-[2px] scale-105 rounded-t-2xl [mask-image:linear-gradient(to_bottom,black_50%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_98%)]"
                />
              ) : (
                <Image
                  src={imagenVisible}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 640px) 100vw, 384px"
                  quality={75}
                  loading="lazy"
                  onError={() => setSinOptimizar(true)}
                  className="object-cover opacity-50 sm:opacity-60 blur-[2px] scale-105 rounded-t-2xl [mask-image:linear-gradient(to_bottom,black_50%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_50%,transparent_98%)]"
                />
              )}
              <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-gray-900/0 via-gray-900/55 to-gray-900" />
            </>
          ) : (
            <div aria-hidden="true" className="h-full w-full animate-pulse bg-gray-800 rounded-t-2xl" />
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