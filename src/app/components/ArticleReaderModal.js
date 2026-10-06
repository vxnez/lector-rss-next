// src/app/components/ArticleReaderModal.js
"use client";

import { X, ExternalLink, Tag, Globe, Calendar, Pencil, Save, ChevronLeft, ChevronRight, MoveHorizontal, Clock, Share2, Volume2, VolumeX, Check, List, Pin, Move, ArrowUpToLine, Sparkles, RotateCw } from "lucide-react";
import Image from "next/image";
import { Check as CheckData, CheckCheck as CheckCheckData, Eye as EyeData, EyeOff as EyeOffData, Bookmark as BookmarkData, BookmarkCheck as BookmarkCheckData } from "lucide";
import MorphIcon from "./MorphIcon";
import ResumenEstructurado, { parseResumen } from "./ResumenEstructurado";
import PanelResumenIA from "./PanelResumenIA";
import { confianzaIAVisible, traducirCategoria } from "@/lib/categoryStyles";
import InsigniaCategoria from "./InsigniaCategoria";
import { tiempoLecturaMinutos, detectarIdiomaTexto } from "@/lib/lectura";
import { limpiarTextoResumen } from "@/lib/limpiezaTexto";
import { esImagenValida, primeraImagenValida } from "@/lib/imagenes";
import { useResumenIA } from "@/lib/hooks/useResumenIA";
import { resumenPlano } from "./ResumenEstructurado";
import { formatFecha } from "@/lib/formato";
import { useBloquearScroll } from "@/lib/useBloquearScroll";
import { useIdioma } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

// ¿Merece texto completo? 1) flag de truncado del backend, 2) longitud
// original mayor que lo visible, 3) extracto corto de feed (solo
// <description>, sin content:encoded): el cuerpo real se re-extrae de
// url_original al abrir vía /:id/resumen (caché 24 h en servidor).
function necesitaTextoCompleto(article) {
  if (!article?.id || !article?.url_original) return false;
  const marca = article?.resumen_completo;
  if (marca === 1 || marca === "1" || marca === true) return true;
  const original = Number(article?.longitud_resumen);
  const visible = String(article?.resumen || "").trim().length;
  if (Number.isFinite(original) && original > visible + 50) return true;
  return visible < 500;
}


export default function ArticleReaderModal({ article, onClose, onToggleRead, onToggleSave, onUpdateCategory, onIrAId, anteriorId, siguienteId, posicion, total }) {
  const { t, locale, idioma } = useIdioma();
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
  // Texto completo por defecto: el resumen de ingesta se reemplaza por el
  // extendido en cuanto llega (autocarga silenciosa al abrir).
  const [resumenExtendido, setResumenExtendido] = useState(null);
  const [falloCompleto, setFalloCompleto] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  const resumenMostrado = resumenExtendido || article?.resumen || "";
  // Rail lateral estilo Skiper: sección activa + visibilidad (por noticia;
  // el modal se remonta por `key` así que el inicial basta).
  const [seccionActiva, setSeccionActiva] = useState(null);
  const [railVisible, setRailVisible] = useState(true);
  // Sheets móviles (xl:hidden): índice e IA como bottom-sheet; en desktop
  // mandan los paneles laterales en portales.
  const [sheetMovil, setSheetMovil] = useState(null);
  const textoIAMovil = useMemo(
    () => resumenPlano(article?.resumen || "").slice(0, 2000),
    [article]
  );
  const resumenMovil = useResumenIA(article?.titulo || "", textoIAMovil, sheetMovil === "ia");
  // Panel externo en el backdrop: "fijo" (anclado arriba-derecha) o
  // "flotante" (arrastrable + redimensionable nativo con `resize`).
  const [modoIndice, setModoIndice] = useState("fijo");
  // Ref del panel: al reacoplar se limpian las dimensiones inline que deja
  // el `resize` nativo (si no, el tamaño manual sangra al modo fijo).
  const panelIndiceRef = useRef(null);
  const fijarIndice = () => {
    try {
      const el = panelIndiceRef.current;
      if (el) {
        el.style.width = "";
        el.style.height = "";
      }
    } catch {
      // Sin DOM accesible: las clases ya mandan.
    }
    setPosFlotante(null);
    setModoIndice("fijo");
  };  // Posición persistente del panel flotante (solo modo flotante).
  const [posFlotante, setPosFlotante] = useState(() => {
    try {
      const crudo = window.localStorage.getItem("lector_indice_pos");
      if (!crudo) return null;
      const p = JSON.parse(crudo);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      const x = Math.min(Math.max(p.x, 8), Math.max(window.innerWidth - 120, 8));
      const y = Math.min(Math.max(p.y, 8), Math.max(window.innerHeight - 80, 8));
      return { x, y };
    } catch {
      return null;
    }
  });
  // Portal a <body>: el panel vive fuera del árbol del modal (nada de
  // overflow/blur/transform heredados) con fixed real a viewport.
  const puedePortal = typeof document !== "undefined";
  // Arrastre del panel en modo flotante (Pointer Events, sin librerías).
  const iniciarArrastre = (event) => {
    if (modoIndice !== "flotante") return;
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target && event.target.closest && event.target.closest("button")) return;
    event.preventDefault();
    const inicioX = event.clientX;
    const inicioY = event.clientY;
    const panel = event.currentTarget.closest("nav");
    const rect = panel ? panel.getBoundingClientRect() : null;
    if (!rect) return;
    const mover = (ev) => {
      const x = Math.min(Math.max(rect.left + (ev.clientX - inicioX), 8), window.innerWidth - 120);
      const y = Math.min(Math.max(rect.top + (ev.clientY - inicioY), 8), window.innerHeight - 80);
      setPosFlotante({ x, y });
      try {
        window.localStorage.setItem("lector_indice_pos", JSON.stringify({ x, y }));
      } catch {
        // Sin almacenamiento: la posición vive solo la sesión.
      }
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  // Índice dinámico: sale de los subtítulos ya parseados (cero DOM parsing,
  // cero backend). Solo aparece con 2+ secciones.
  const indiceContenido = useMemo(
    () =>
      parseResumen(resumenMostrado)
        .map((b, i) => ({ ...b, indice: i }))
        .filter((b) => b.tipo === "subtitulo"),
    [resumenMostrado]
  );
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
    const texto = `${limpiarTextoResumen(article?.titulo) || ""}. ${resumenPlano(resumenMostrado) || ""}`;
    const utterance = new SpeechSynthesisUtterance(texto);
    // La traducción de noticias la hace el navegador del usuario: la voz
    // sigue el idioma detectado del texto original (heurística local).
    const idiomaVoz = detectarIdiomaTexto(article?.titulo, resumenMostrado);
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
  // Solo si la autocarga falló: reintenta el texto completo una vez.
  const reintentarCompleto = async () => {
    if (reintentando || resumenExtendido || !article?.id) return;
    setReintentando(true);
    setFalloCompleto(false);
    try {
      const res = await fetch(`/api/rss?tipo=resumen&id=${encodeURIComponent(article.id)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.resumen) throw new Error(data?.error || "Error");
      setResumenExtendido(data.resumen);
    } catch {
      setFalloCompleto(true);
    } finally {
      setReintentando(false);
    }
  };
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
    () => Boolean(article?.url_original) && !esImagenValida(article?.imagen_url) && !article?.video_url
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
    // Solo se descubre bajo demanda cuando el artículo no trae medios
    // nativos válidos: lo hallado (imagen del cuerpo y/o video og:video) se
    // persiste en el servidor.
    if (!article || !article.url_original || esImagenValida(article.imagen_url) || article.video_url) return undefined;
    let vivo = true;
    // Se envía el id para que el servidor persista la imagen hallada en el
    // artículo y no haya que re-extraerla en futuras aperturas.
    const idNumerico = Number(article.id);
    const parametroId = Number.isInteger(idNumerico) && idNumerico > 0 ? `&id=${idNumerico}` : "";
    fetch(`/api/rss?tipo=imagen&url=${encodeURIComponent(article.url_original)}${parametroId}`, { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!vivo) return;
        if (esImagenValida(data.imagen)) setImagenRemota(data.imagen);
        if (data.video) setVideoRemoto(data.video);
      })
      .catch(() => {
        if (vivo) setFalloCompleto(true);
      })
      .finally(() => {
        if (vivo) setCargandoImagen(false);
      });
    return () => {
      vivo = false;
    };
  }, [article]);
  // Texto completo inmediato: si la ingesta lo truncó (1200), se trae el
  // extendido al abrir. Ante fallo marca falloCompleto (aviso discreto con
  // reintento). Cadena .then: sin setState
  // síncrono en el cuerpo del efecto.
  useEffect(() => {
    if (!article || !necesitaTextoCompleto(article) || !article.id) return undefined;
    const ctrl = new AbortController();
    fetch(`/api/rss?tipo=resumen&id=${encodeURIComponent(article.id)}`, {
      cache: "no-store",
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (ctrl.signal.aborted) return;
        if (!res.ok || !data?.resumen) {
          setFalloCompleto(true);
          return;
        }
        setResumenExtendido(data.resumen);
      })
      .catch(() => {})
    return () => {
      ctrl.abort();
    };
  }, [article]);

  // Scroll tracking del índice lateral: IntersectionObserver nativo sobre
  // las secciones del cuerpo (root = scroll interno del modal). Sin
  // librerías, sin costo de servidor; se limpia al cambiar de noticia.
  useEffect(() => {
    const contenedor = contenedorRef.current;
    if (!contenedor || typeof IntersectionObserver === "undefined") return undefined;
    const secciones = contenedor.querySelectorAll('[id^="lector-sec-"]');
    if (secciones.length < 2) {
      setSeccionActiva(null);
      return undefined;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (entrada.isIntersecting) setSeccionActiva(entrada.target.id);
        }
      },
      { root: contenedor, rootMargin: "-25% 0px -65% 0px", threshold: 0 }
    );
    secciones.forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, [resumenMostrado]);

  if (!article) return null;

  // Solo imagen nativa del contenido: enclosure/media del feed o <img> del
  // cuerpo. Capturas de página completa y thumbnails genéricos se descartan
  // y el contenedor superior se oculta (nada de artefactos borrosos).
  const imagenFeed = esImagenValida(article?.imagen_url) ? article.imagen_url : "";
  const imagenVisible = primeraImagenValida(imagenFeed, imagenRemota);
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
  const minutosLectura = tiempoLecturaMinutos(article.titulo, resumenMostrado);
  const irASeccion = (indice) => {    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    const destino = contenedor.querySelector(`#lector-sec-${indice}`);
    if (!destino) return;
    let suave = true;
    try {
      suave = typeof window !== "undefined"
        && window.matchMedia
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      suave = true;
    }
    destino.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
  };
  // Título raíz del índice: vuelve al inicio sin scroll manual. Activo
  // cuando ninguna sección está en foco (cima del artículo).
  const tituloIndice = limpiarTextoResumen(article?.titulo || "");
  const irAlInicio = () => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return;
    let suave = true;
    try {
      suave = typeof window !== "undefined"
        && window.matchMedia
        && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      suave = true;
    }
    contenedor.scrollTo({ top: 0, behavior: suave ? "smooth" : "auto" });
    setSeccionActiva(null);
  };

  return (<>
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center overflow-x-hidden overflow-y-auto p-4 z-50 animate-fadeIn"
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
        className={`bg-app-surface border border-app-line rounded-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-2xl lg:max-w-3xl mx-auto box-border shadow-2xl relative max-h-[calc(100dvh-2rem)] overflow-hidden overscroll-contain flex flex-col ${
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
                        {traducirCategoria(nombre, idioma)}
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

          {/* Cuerpo en modo extendido por defecto: el texto completo
              autocarga al abrir, sin insignias ni botones de resumen corto. */}
          <div className="text-app-fg text-sm md:text-base leading-relaxed break-words">
            {indiceContenido.length >= 2 && (
              <details className="mb-4 rounded-xl border border-app-line bg-app-raised/50 px-4 py-2.5 xl:hidden">
                <summary className="btn-press cursor-pointer list-none text-xs font-bold uppercase tracking-[0.08em] text-[var(--accent-ink)] [&::-webkit-details-marker]:hidden">
                  {t("lector.indice")} · {indiceContenido.length}
                </summary>
                <nav aria-label={t("lector.indice")} className="mt-2 space-y-0.5">
                  <button
                    type="button"
                    onClick={irAlInicio}
                    aria-current={seccionActiva === null ? "true" : undefined}
                    title={tituloIndice}
                    className="btn-press flex w-full items-center gap-2 rounded-lg border-b border-app-line/70 px-2 pb-2.5 pt-1 text-left text-sm font-bold leading-snug text-app-fg hover:bg-app-raised"
                    >
                      <ArrowUpToLine size={14} className="shrink-0 text-[var(--accent)]" />
                      <span className="min-w-0 break-words">{tituloIndice}</span>
                    </button>
                  {indiceContenido.map((s) => (
                    <button
                      key={s.indice}
                      type="button"
                      onClick={() => irASeccion(s.indice)}
                      className="btn-press block w-full break-words rounded-lg px-2 py-2 text-left text-sm leading-snug text-app-muted hover:bg-app-raised hover:text-app-fg"
                    >
                      {s.texto}
                    </button>
                  ))}
                </nav>
              </details>
            )}
            <ResumenEstructurado
              texto={resumenMostrado || t("lector.sin_resumen")}
              prefijoIndice="lector-sec"
              t={t}
            />
          </div>
          {falloCompleto && !resumenExtendido && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-app-muted">
              <span>{t("lector.err_completo")}</span>
              <button
                type="button"
                onClick={reintentarCompleto}
                disabled={reintentando}
                className="btn-press font-semibold text-[var(--accent-ink)] underline decoration-[var(--accent)]/50 underline-offset-2 hover:decoration-[var(--accent)] disabled:opacity-60"
              >
                {reintentando ? t("lector.cargando_completo") : t("lector.reintentar")}
              </button>
            </p>
          )}
        </div>

        {actionError && (
          <p role="alert" className="mt-4 text-sm text-rose-400">
            {actionError}
          </p>
        )}
      </div>
      </div>

        {/* Disparadores móviles (xl:hidden): sobre el pie de acciones, sin taparlo. */}
        {!sheetMovil && (
          <div className="absolute bottom-24 right-3 z-20 flex flex-col gap-2 xl:hidden">
            <button
              type="button"
              onClick={() => setSheetMovil("ia")}
              title={t("lector.resumen_ia")}
              aria-label={t("lector.resumen_ia")}
              className="btn-press grid size-12 place-content-center rounded-full border border-app-line bg-app-surface/85 text-[var(--accent-ink)] shadow-xl backdrop-blur-md"
            >
              <Sparkles size={19} />
            </button>
            <button
              type="button"
              onClick={() => setSheetMovil("indice")}
              title={t("lector.indice")}
              aria-label={t("lector.indice")}
              className="btn-press grid size-12 place-content-center rounded-full border border-app-line bg-app-surface/85 text-app-muted shadow-xl backdrop-blur-md"
            >
              <List size={19} />
            </button>
          </div>
        )}
        {/* Bottom-sheets móviles: índice e IA con scroll propio. */}
        {sheetMovil && (
          <>
            <div
              aria-hidden="true"
              onClick={() => setSheetMovil(null)}
              className="absolute inset-0 z-30 bg-black/50 xl:hidden"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={sheetMovil === "ia" ? t("lector.resumen_ia") : t("lector.indice")}
              className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70dvh] flex-col overflow-hidden rounded-t-3xl border-t border-app-line bg-app-surface shadow-2xl pb-safe xl:hidden"
            >
              <div className="flex items-center gap-2 border-b border-app-line/70 px-4 py-3">
                {sheetMovil === "ia" ? (
                  <Sparkles size={15} className="shrink-0 text-[var(--accent-ink)]" />
                ) : (
                  <List size={15} className="shrink-0 text-[var(--accent-ink)]" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-[0.08em] text-app-muted">
                  {sheetMovil === "ia" ? t("lector.resumen_ia") : `${t("lector.indice")} · ${indiceContenido.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => setSheetMovil(null)}
                  aria-label={t("comun.cerrar")}
                  className="btn-press rounded-lg p-2 text-app-muted hover:bg-app-raised/40 hover:text-app-fg"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="scroll-sutil min-h-0 flex-1 overflow-y-auto p-4">
                {sheetMovil === "indice" ? (
                  <nav aria-label={t("lector.indice")} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        irAlInicio();
                        setSheetMovil(null);
                      }}
                      title={tituloIndice}
                      className="btn-press flex w-full items-center gap-2.5 rounded-xl border-b border-app-line/70 px-2.5 py-3 text-left text-sm font-bold leading-snug text-app-fg"
                    >
                      <ArrowUpToLine size={15} className="shrink-0 text-[var(--accent)]" />
                      <span className="min-w-0 break-words">{tituloIndice}</span>
                    </button>
                    {indiceContenido.map((s) => (
                      <button
                        key={s.indice}
                        type="button"
                        onClick={() => {
                          irASeccion(s.indice);
                          setSheetMovil(null);
                        }}
                        title={s.texto}
                        className="btn-press block w-full break-words rounded-xl px-2.5 py-3 text-left text-sm leading-snug text-app-muted"
                      >
                        {s.texto}
                      </button>
                    ))}
                  </nav>
                ) : resumenMovil.estado === "cargando" ? (
                  <div className="space-y-2.5" aria-label={t("lector.resumiendo")}>
                    <p className="flex items-center gap-2 text-xs font-semibold text-app-muted">
                      <Sparkles size={13} className="animate-pulse text-[var(--accent-ink)]" />
                      {t("lector.resumiendo")}
                    </p>
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="skeleton-shimmer h-10 rounded-xl" />
                    ))}
                  </div>
                ) : resumenMovil.estado === "ok" ? (
                  <ul className="space-y-2.5">
                    {resumenMovil.puntos.map((p, i) => (
                      <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-app-fg/95">
                        <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        <span className="min-w-0">{p}</span>
                      </li>
                    ))}
                  </ul>
                ) : resumenMovil.diag === "sin_clave" ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold leading-relaxed text-app-fg">
                      {t("lector.resumen_configura")}
                    </p>
                    <p className="text-xs leading-relaxed text-app-muted">
                      {t("lector.resumen_donde")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p role="alert" className="text-sm leading-relaxed text-app-muted">
                      {resumenMovil.diag === "cuota"
                        ? t("lector.resumen_cuota")
                        : resumenMovil.diag === "corto"
                          ? t("lector.resumen_corto")
                          : t("lector.err_resumen")}
                    </p>
                    <button
                      type="button"
                      onClick={resumenMovil.reintentar}
                      className="btn-press inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[var(--accent-strong)] px-4 py-2 text-xs font-semibold text-[var(--on-accent-strong)]"
                    >
                      <RotateCw size={13} />
                      {t("lector.reintentar")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {/* Pie fijo fuera del scroll */}
        <div className="relative z-10 shrink-0 border-t border-app-line bg-app-surface px-4 py-3 sm:px-6 sm:py-4 md:px-8 pb-safe notranslate" translate="no">
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
        // Franja ambiental sutil: la foto nativa decora sin competir con el
        // texto (baja opacidad + scrim profundo). Sin imagen válida el bloque
        // no se renderiza: nada de capturas borrosas con texto superpuesto.
        <div className="absolute inset-x-0 top-0 h-[34%] overflow-hidden rounded-t-2xl" aria-hidden="true">
          {videoVisible ? (
            <>
              {/* Video de fondo: autoplay muteado (única forma permitida por
                  el navegador), en bucle y sin controles. */}
              <video
                src={videoVisible}
                className="h-full w-full object-cover opacity-25 rounded-t-2xl [mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)]"
                autoPlay
                muted
                loop
                playsInline
                disablePictureInPicture
                preload="metadata"
                poster={imagenVisible || undefined}
                onError={() => setVideoRoto(true)}
              />
              <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-gray-900/0 via-gray-900/70 to-gray-900" />
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
                  className="h-full w-full object-cover opacity-25 blur-[1px] scale-105 rounded-t-2xl [mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)]"
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
                  className="object-cover opacity-25 blur-[1px] scale-105 rounded-t-2xl [mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)] [-webkit-mask-image:linear-gradient(to_bottom,black_40%,transparent_98%)]"
                />
              )}
              <div aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-gray-900/0 via-gray-900/70 to-gray-900" />
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
      {puedePortal &&
        indiceContenido.length >= 2 &&
        createPortal(
          <>
      {/* Índice en el backdrop (fuera de la caja del artículo): fijo
                    arriba-derecha o flotante arrastrable/redimensionable. Solo xl+. */}
                {indiceContenido.length >= 2 && railVisible && (
                  <nav
                    ref={panelIndiceRef}
                    aria-label={t("lector.indice")}
                    style={modoIndice === "flotante" && posFlotante ? { left: posFlotante.x, top: posFlotante.y, right: "auto" } : undefined}
                    className={`fixed right-0 top-20 z-[60] hidden w-60 flex-col overflow-hidden rounded-l-2xl border border-r-0 border-app-line bg-app-surface/70 shadow-xl backdrop-blur-md xl:flex ${
                      modoIndice === "flotante"
                        ? "max-h-[70dvh] min-h-[160px] max-w-[min(320px,calc(100vw-2rem))] min-w-[180px] resize overflow-auto rounded-r-2xl border-r"
                        : "max-h-[calc(100dvh-7rem)]"
                    }`}
                  >
                    <div
                      onPointerDown={iniciarArrastre}
                      className={`flex items-center gap-1.5 border-b border-app-line/70 px-3 py-2 ${
                        modoIndice === "flotante" ? "cursor-move touch-none select-none" : ""
                      }`}
                    >
                      <List size={13} className="shrink-0 text-[var(--accent-ink)]" />
                      <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[0.08em] text-app-muted">
                        {t("lector.indice")} · {indiceContenido.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (modoIndice === "fijo") setModoIndice("flotante");
                          else fijarIndice();
                        }}
                        title={modoIndice === "fijo" ? t("lector.indice_libre") : t("lector.indice_fijo")}
                        aria-label={modoIndice === "fijo" ? t("lector.indice_libre") : t("lector.indice_fijo")}
                        aria-pressed={modoIndice === "flotante"}
                        className="btn-press shrink-0 rounded-md p-1 text-app-muted hover:bg-app-raised hover:text-app-fg"
                      >
                        {modoIndice === "fijo" ? <Move size={13} /> : <Pin size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRailVisible(false)}
                        aria-label={t("comun.cerrar")}
                        className="btn-press shrink-0 rounded-md p-1 text-app-muted hover:bg-app-raised hover:text-app-fg"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <div className="scroll-sutil min-h-0 flex-1 overflow-y-auto p-1.5">
                      <button
                        type="button"
                        onClick={irAlInicio}
                        aria-current={seccionActiva === null ? "true" : undefined}
                        title={tituloIndice}
                        className="btn-press mb-1 flex w-full items-center gap-2 rounded-lg border-b border-app-line/70 px-2 pb-2.5 pt-1 text-left text-[11px] font-bold leading-snug text-app-fg hover:bg-app-raised/70"
                        >
                          <ArrowUpToLine size={13} className="shrink-0 text-[var(--accent)]" />
                          <span className="min-w-0 break-words">{tituloIndice}</span>
                        </button>
                      {indiceContenido.map((s) => {
                        const activa = seccionActiva === `lector-sec-${s.indice}`;
                        return (
                          <button
                            key={s.indice}
                            type="button"
                            onClick={() => irASeccion(s.indice)}
                            aria-current={activa ? "true" : undefined}
                            title={s.texto}
                            className={`btn-press flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[11px] leading-snug transition-[background-color,color] duration-200 ${
                              activa
                                ? "bg-[var(--accent)]/15 font-semibold text-app-fg"
                                : "text-app-muted hover:bg-app-raised/70 hover:text-app-fg"
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className={`size-1.5 shrink-0 rounded-full transition-[background-color] duration-200 ${
                                activa ? "bg-[var(--accent)]" : "bg-app-muted/40"
                              }`}
                            />
                            <span className="min-w-0 break-words">{s.texto}</span>
                          </button>
                        );
                      })}
                    </div>
                  </nav>
                )}
                {indiceContenido.length >= 2 && !railVisible && (
                  <button
                    type="button"
                    onClick={() => setRailVisible(true)}
                    title={t("lector.indice")}
                    aria-label={t("lector.indice")}
                    className="btn-press fixed right-4 top-20 z-[60] hidden rounded-full border border-app-line bg-app-surface/70 p-2.5 text-app-muted shadow-xl backdrop-blur-md hover:text-app-fg xl:block"
                  >
                    <List size={15} />
                  </button>
                )}
                    </>,
          document.body
        )}
      {puedePortal && <PanelResumenIA article={article} t={t} />}
  </>);
}