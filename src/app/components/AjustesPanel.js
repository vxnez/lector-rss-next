// src/app/components/AjustesPanel.js — Ajustes estilo Cuenta de Google.
// Menú de tarjetas (icono + título + descripción) con subvistas internas:
// Apariencia, Cuenta, Lectura, Datos y privacidad y Ayuda.
// (Notificaciones migradas al panel flotante NotificationPanel.)
"use client";

import { useEffect, useRef, useState } from "react";
import { useBloquearScroll } from "@/lib/useBloquearScroll";
import { useIdioma } from "@/lib/i18n";
import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Palette,
  ShieldCheck,
  Database,
  Languages,
  Info,
  User,
  Download,
  Trash2,
  Share2,
  LogOut,
  HelpCircle,
  Star,
  TriangleAlert,
  LayoutGrid,
  Rows,
  AlignJustify,
} from "lucide-react";
import SelectorTemas from "./SelectorTemas";
import { FUENTES, FUENTE_PX_MIN, FUENTE_PX_MAX } from "@/lib/fuentes";
import { limpiarRastrosCuenta, limpiarNotificacionesLocales } from "@/lib/ajustesPorDefecto";

const URL_REPOSITORIO = "https://github.com/vxnez/lector-rss-next";
const URL_APP = "https://lector-rss-next.vercel.app";
const VERSION_APP = "1.0";
const TAMANOS_PAGINA = [15, 30, 60];

function GitHubIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function formatearFecha(valor, locale = "es-ES") {
  if (!valor) return "—";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(valor));
  } catch {
    return "—";
  }
}

function TarjetaAjuste({ icono, fondoIcono, tintaIcono, titulo, descripcion, onAbrir }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="btn-press card-lift group flex min-h-[4.75rem] w-full items-center gap-3 overflow-hidden rounded-2xl border border-transparent bg-transparent px-3.5 py-3 text-left hover:bg-app-raised/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: fondoIcono, color: tintaIcono }}
        className="grid h-11 w-11 shrink-0 place-content-center rounded-full transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
      >
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-app-fg">{titulo}</span>
        <span className="block line-clamp-2 text-xs leading-relaxed text-app-muted">{descripcion}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-app-muted transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-0.5 group-hover:text-app-fg" />
    </button>
  );
}

function FilaDato({ etiqueta, valor }) {
  return (
    <div className="rounded-xl border border-app-line bg-app-surface/70 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-app-muted">{etiqueta}</p>
      <p className="truncate text-sm font-medium text-app-fg">{valor}</p>
    </div>
  );
}

function Interruptor({ activado, onCambiar, etiqueta, descripcion }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activado}
      aria-label={etiqueta}
      onClick={() => onCambiar(!activado)}
      className="btn-press flex w-full items-center justify-between gap-3 rounded-2xl border border-transparent bg-transparent px-3 py-2.5 text-left hover:bg-app-raised/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-app-fg">{etiqueta}</span>
        {descripcion && <span className="block break-words text-xs leading-relaxed text-app-muted">{descripcion}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`switch-pill relative h-6 w-11 shrink-0 rounded-full border border-transparent ${
          activado ? "bg-sky-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`switch-knob absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${
            activado ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export default function AjustesPanel({
  abierto,
  onCerrar,
  tema,
  onTema,
  fuente,
  onFuente,
  fuentePx,
  onFuentePx,
  modoVista,
  onModoVista,
  tamanoPagina,
  onTamanoPagina,
  autoMarcarLeida,
  onAutoMarcar,
  movimientoReducido,
  onMovimiento,
  densidad,
  onDensidad,
  nombreUsuario,
  emailUsuario,
  imagenUsuario,
  esInvitado,
  onEditarPerfil,
  onCerrarSesion,
  pushSoportado,
  pushActivado,
  pushCargando,
  onGestionarPush,
  estadisticas,
  onNotify,
  onAbrirGuia,
}) {
  const [vista, setVista] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [actividad, setActividad] = useState(null);
  const [infoRepo, setInfoRepo] = useState(null);
  const [exportando, setExportando] = useState(false);
  const [pasoEliminar, setPasoEliminar] = useState("idle");
  const cerrarRef = useRef(null);
  const { t } = useIdioma();

  const versionTexto = infoRepo?.commits ? `1.${infoRepo.commits}` : VERSION_APP;

  // Versión viva vía /api/repo (caché 1h + timeout 6s, sin rate-limit directo).
  const cargarRepo = async () => {
    if (infoRepo) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("/api/repo", { cache: "no-store", signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) return;
      const datos = await res.json().catch(() => ({}));
      setInfoRepo({
        commits: Number(datos.commits) || 0,
        mensaje: String(datos.mensaje || ""),
        fecha: datos.fecha || null,
      });
    } catch {
      // Sin red hacia GitHub: se muestra la versión base.
    }
  };

  // La página de fondo no se desplaza mientras el panel está abierto.
  useBloquearScroll(abierto);

  // Foco inicial + Escape (retrocede de subvista o cierra). Sin setState
  // en el cuerpo del efecto: los cambios van en el listener del teclado.
  useEffect(() => {
    if (!abierto) return undefined;
    cerrarRef.current?.focus();
    const alTeclado = (event) => {
      if (event.key !== "Escape") return;
      // El modal de eliminar cuenta se cierra primero.
      if (pasoEliminar === "modal") {
        setPasoEliminar("idle");
        return;
      }
      setPasoEliminar("idle");
      if (vista) setVista(null);
      else onCerrar();
    };
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [abierto, vista, pasoEliminar, onCerrar]);

  if (!abierto) return null;

  const cerrar = () => {
    setVista(null);
    setPasoEliminar("idle");
    onCerrar();
  };

  const atras = () => {
    setPasoEliminar("idle");
    setVista(null);
  };

  const cargarPerfil = async () => {
    if (perfil || esInvitado) return;
    try {
      const res = await fetch("/api/perfil", { cache: "no-store" });
      if (res.ok) setPerfil(await res.json());
    } catch {
      // Sin perfil: las subvistas muestran los datos de sesión.
    }
  };

  const cargarActividad = async () => {
    if (actividad || esInvitado) return;
    try {
      const res = await fetch("/api/actividad", { cache: "no-store" });
      if (res.ok) setActividad(await res.json());
    } catch {
      // Sin actividad: la subvista muestra los conteos disponibles.
    }
  };

  const abrirVista = (id) => {
    setVista(id);
    if (id === "cuenta") {
      cargarPerfil();
      cargarActividad();
    }
    if (id === "ayuda") cargarRepo();
  };

  const exportarDatos = async () => {
    setExportando(true);
    try {
      const res = await fetch("/api/datos", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron exportar los datos.");
      const datos = await res.json();
      // El enlace debe estar en el DOM: si no, Firefox/Safari ignoran el clic.
      const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `mis-datos-rss-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify(t("avisos.exportar_ok"), "success");
    } catch (err) {
      onNotify(err.message || t("avisos.exportar_err"), "error");
    } finally {
      setExportando(false);
    }
  };

  const eliminarCuenta = async () => {
    setPasoEliminar("eliminando");
    try {
      const res = await fetch("/api/datos", { method: "DELETE" });
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => null);
        const detalle = cuerpo?.detalle || cuerpo?.error;
        throw new Error(detalle ? `No se pudo eliminar la cuenta: ${detalle}` : "No se pudo eliminar la cuenta.");
      }
      // Sin rastro en este navegador: ajustes de lectura/apariencia a
      // valores por defecto + marcas de bienvenida de la cuenta. Un
      // re-registro con el mismo correo arranca con perfil limpio.
      limpiarRastrosCuenta();
      onNotify(t("avisos.cuenta_eliminada"), "success");
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      onNotify(err.message || t("avisos.cuenta_err"), "error");
      setPasoEliminar("modal");
    }
  };

  const compartirApp = async () => {
    const datos = {
      title: "RSS Dashboard",
      text: t("ajustes.compartir_texto"),
      url: URL_APP,
    };
    try {
      if (navigator.share) {
        await navigator.share(datos);
      } else {
        await navigator.clipboard.writeText(datos.url);
        onNotify(t("avisos.enlace_copiado"), "success");
      }
    } catch {
      // El usuario canceló el diálogo: no se notifica nada.
    }
  };

  const cerrarSesion = async () => {
    if (esInvitado) {
      onCerrarSesion();
      return;
    }
    // La bandeja es local: no debe filtrarse a la siguiente cuenta.
    limpiarNotificacionesLocales();
    await signOut({ callbackUrl: "/login" });
  };

  const locale = "es-ES";

  // Métodos vinculados a la cuenta (insignias traducidas).
  const metodosVinculados = () => {
    const metodos = [];
    if (Number(perfil?.tiene_password) === 1) {
      metodos.push({ id: "correo", etiqueta: t("ajustes.prov_correo") });
    }
    const lista = String(perfil?.proveedor || "")
      .split(",")
      .map((p) => p.trim());
    if (lista.includes("google")) metodos.push({ id: "google", etiqueta: t("ajustes.prov_google") });
    if (lista.includes("github")) metodos.push({ id: "github", etiqueta: t("ajustes.prov_github") });
    return metodos;
  };

  const etiquetasProveedor = () => {
    const partes = metodosVinculados().map((m) => m.etiqueta);
    return partes.length > 0 ? partes.join(" + ") : t("ajustes.prov_correo");
  };

  const fecha = (valor) => formatearFecha(valor, locale);
  const totalNoticias =
    (estadisticas?.pendientes || 0) + (estadisticas?.leidas || 0) + (estadisticas?.guardadas || 0);

  const titulos = {
    apariencia: t("ajustes.apariencia_t"),
    cuenta: t("ajustes.cuenta_seg_t"),
    lectura: t("ajustes.lectura_t"),
    datos: t("ajustes.datos_t"),
    ayuda: t("ajustes.ayuda_t"),
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={cerrar}
        className="anim-fondo-fundido fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={vista ? titulos[vista] : t("ajustes.titulo")}
        className="anim-panel-izquierda fixed inset-y-0 left-0 z-50 flex w-[min(22rem,88vw)] flex-col border-r border-app-line bg-app-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-app-line px-3 py-3">
          {vista ? (
            <button
              type="button"
              onClick={atras}
              aria-label="Volver a ajustes"
              className="rounded-lg p-1.5 text-app-muted transition hover:bg-app-raised/40 hover:text-app-fg"
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-app-fg">
            {vista ? titulos[vista] : t("ajustes.titulo")}
          </h2>
          <button
            ref={cerrarRef}
            type="button"
            onClick={cerrar}
            aria-label={t("ajustes.cerrar")}
            className="rounded-lg p-1.5 text-app-muted transition hover:bg-app-raised/40 hover:text-app-fg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="panel-scroll flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
          {!vista && (
            <>
              {/* Seis apartados funcionales, sin duplicados: la cuenta vive en
                  un solo lugar, la guía dentro de Ayuda y el repo con un
                  único enlace. */}
              <TarjetaAjuste
                icono={
                  imagenUsuario && !esInvitado ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagenUsuario}
                      alt=""
                      aria-hidden="true"
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <ShieldCheck size={20} />
                  )
                }
                fondoIcono="#dcfce7"
                tintaIcono="#166534"
                titulo={t("ajustes.cuenta_seg_t")}
                descripcion={
                  esInvitado
                    ? t("ajustes.invitado_tag")
                    : (nombreUsuario || emailUsuario || t("ajustes.cuenta_seg_d"))
                }
                onAbrir={() => abrirVista("cuenta")}
              />
              <TarjetaAjuste
                icono={<Palette size={20} />}
                fondoIcono="#e0e7ff"
                tintaIcono="#3730a3"
                titulo={t("ajustes.apariencia_t")}
                descripcion={t("ajustes.apariencia_d")}
                onAbrir={() => abrirVista("apariencia")}
              />
              <TarjetaAjuste
                icono={<Languages size={20} />}
                fondoIcono="#fef9c3"
                tintaIcono="#854d0e"
                titulo={t("ajustes.lectura_t")}
                descripcion={t("ajustes.lectura_d")}
                onAbrir={() => abrirVista("lectura")}
              />
              <TarjetaAjuste
                icono={<Database size={20} />}
                fondoIcono="#ccfbf1"
                tintaIcono="#115e59"
                titulo={t("ajustes.datos_t")}
                descripcion={t("ajustes.datos_d")}
                onAbrir={() => abrirVista("datos")}
              />
              <TarjetaAjuste
                icono={<Info size={20} />}
                fondoIcono="#f3f4f6"
                tintaIcono="#374151"
                titulo={t("ajustes.ayuda_t")}
                descripcion={t("ajustes.ayuda_d")}
                onAbrir={() => abrirVista("ayuda")}
              />

              <div className="border-t border-app-line pt-3">
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="btn-press flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                >
                  <LogOut size={16} />
                  {t("ajustes.cerrar_sesion")}
                </button>
              </div>

            </>
          )}

          {vista === "apariencia" && (
            <section className="stagger-in">
              <SelectorTemas tema={tema} onTema={onTema} />
            </section>
          )}

          {vista === "lectura" && (
            <section className="stagger-in space-y-5">
              <div className="space-y-2.5 border-t border-app-line pt-4">
                <p className="text-xs font-medium text-app-muted">{t("ajustes.lectura_sub")}</p>

                {/* Grupo: tipografía */}
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-app-muted/70">
                  {t("ajustes.grupo_tipo")}
                </p>
                <div className="min-w-0">
                  <span id="ajustes-fuente" className="mb-1.5 block truncate text-xs font-medium text-app-muted">
                    {t("ajustes.fuente_grupo")}
                  </span>
                  <p className="mb-2 text-xs leading-relaxed text-app-muted">
                    {t("ajustes.fuente_nota")}
                  </p>
                  <div className="grid min-w-0 gap-1.5" role="radiogroup" aria-labelledby="ajustes-fuente">
                    {FUENTES.map((item) => {
                      const activo = fuente === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="radio"
                          aria-checked={activo}
                          onClick={() => onFuente(item.id)}
                          style={{ fontFamily: `var(${item.variable}), sans-serif` }}
                          className={`min-w-0 break-words rounded-lg border px-3 py-2 text-left text-sm leading-snug transition ${
                            activo
                              ? "border-[var(--accent)]/60 bg-transparent text-app-fg"
                              : "border-transparent bg-transparent text-app-fg hover:bg-app-raised/40"
                          }`}
                        >
                          {item.nombre}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-1.5 flex min-w-0 items-center justify-between gap-2">
                    <span id="ajustes-tamano-px" className="min-w-0 truncate text-xs font-medium text-app-muted">
                      {t("ajustes.tamano_lectura")}
                    </span>
                    <span
                      aria-live="polite"
                      className="shrink-0 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-bold tabular-nums text-[var(--accent-ink)]"
                    >
                      {fuentePx} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={FUENTE_PX_MIN}
                    max={FUENTE_PX_MAX}
                    step={1}
                    value={fuentePx}
                    onChange={(event) => onFuentePx(Number(event.target.value))}
                    aria-labelledby="ajustes-tamano-px"
                    style={{ "--slider-pct": `${((fuentePx - FUENTE_PX_MIN) / (FUENTE_PX_MAX - FUENTE_PX_MIN)) * 100}%` }}
                    className="ajuste-slider w-full"
                  />
                  <p className="mt-1 text-xs leading-relaxed text-app-muted">
                    {t("ajustes.tamano_px_nota")}
                  </p>
                </div>

                {/* Grupo: vista */}
                <p className="border-t border-app-line pt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-app-muted/70">
                  {t("ajustes.grupo_vista")}
                </p>
                <div className="min-w-0">
                  <span id="ajustes-vista" className="mb-1.5 block truncate text-xs font-medium text-app-muted">
                    {t("ajustes.vista_grupo")}
                  </span>
                  <div className="grid min-w-0 gap-1.5" role="radiogroup" aria-labelledby="ajustes-vista">
                    {[
                      { id: "cards", etiqueta: t("ajustes.vista_cards"), icono: <LayoutGrid size={15} /> },
                      { id: "magazine", etiqueta: t("ajustes.vista_magazine"), icono: <Rows size={15} /> },
                      { id: "compact", etiqueta: t("ajustes.vista_compact"), icono: <AlignJustify size={15} /> },
                    ].map((op) => {
                      const activo = modoVista === op.id;
                      return (
                        <button
                          key={op.id}
                          type="button"
                          role="radio"
                          aria-checked={activo}
                          onClick={() => onModoVista(op.id)}
                          className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                            activo
                              ? "border-[var(--accent)]/60 bg-transparent text-app-fg"
                              : "border-transparent bg-transparent text-app-muted hover:bg-app-raised/40 hover:text-app-fg"
                          }`}
                        >
                          <span className="shrink-0">{op.icono}</span>
                          <span className="min-w-0 flex-1 truncate">{op.etiqueta}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grupo: contenido */}
                <p className="border-t border-app-line pt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-app-muted/70">
                  {t("ajustes.grupo_contenido")}
                </p>
                <div className="min-w-0">
                  <span id="ajustes-tamano-pagina" className="mb-1.5 block truncate text-xs font-medium text-app-muted">
                    {t("ajustes.pagina")}
                  </span>
                  <div className="flex gap-1.5" role="radiogroup" aria-labelledby="ajustes-tamano-pagina">
                    {TAMANOS_PAGINA.map((n) => {
                      const activo = tamanoPagina === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={activo}
                          onClick={() => onTamanoPagina(n)}
                          className={`min-w-0 flex-1 truncate rounded-lg border px-2 py-1.5 text-xs font-medium tabular-nums transition ${
                            activo
                              ? "border-[var(--accent)]/60 bg-transparent text-app-fg"
                              : "border-transparent bg-transparent text-app-muted hover:bg-app-raised/40 hover:text-app-fg"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="min-w-0">
                  <span id="ajustes-densidad" className="mb-1.5 block truncate text-xs font-medium text-app-muted">
                    {t("ajustes.densidad")}
                  </span>
                  <div className="flex gap-1.5" role="radiogroup" aria-labelledby="ajustes-densidad">
                    {[
                      { id: "comoda", etiqueta: t("ajustes.d_comoda") },
                      { id: "compacta", etiqueta: t("ajustes.d_compacta") },
                    ].map((op) => {
                      const activo = densidad === op.id;
                      return (
                        <button
                          key={op.id}
                          type="button"
                          role="radio"
                          aria-checked={activo}
                          onClick={() => onDensidad(op.id)}
                          className={`min-w-0 flex-1 truncate rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                            activo
                              ? "border-[var(--accent)]/60 bg-transparent text-app-fg"
                              : "border-transparent bg-transparent text-app-muted hover:bg-app-raised/40 hover:text-app-fg"
                          }`}
                        >
                          {op.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grupo: comportamiento */}
                <p className="border-t border-app-line pt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-app-muted/70">
                  {t("ajustes.grupo_comportamiento")}
                </p>
                <Interruptor
                  activado={autoMarcarLeida}
                  onCambiar={onAutoMarcar}
                  etiqueta={t("ajustes.auto")}
                  descripcion={t("ajustes.auto_d")}
                />
                <Interruptor
                  activado={movimientoReducido}
                  onCambiar={onMovimiento}
                  etiqueta={t("ajustes.movimiento")}
                  descripcion={t("ajustes.movimiento_d")}
                />
                <p className="text-xs leading-relaxed text-app-muted">
                  {t("ajustes.letra_nota")}
                </p>
              </div>
            </section>
          )}

          {vista === "cuenta" && (
            <section className="stagger-in space-y-2.5">
              {esInvitado ? (
                <>
                  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
                    {t("ajustes.invitado_nota")}
                  </p>
                  <button
                    type="button"
                    onClick={onCerrarSesion}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
                  >
                    <LogOut size={15} /> {t("ajustes.salir_datos")}
                  </button>
                </>
              ) : (
                <>
                  <FilaDato etiqueta={t("ajustes.nombre")} valor={perfil?.nombre || nombreUsuario || "—"} />
                  <FilaDato etiqueta={t("ajustes.correo")} valor={perfil?.email || emailUsuario || "—"} />
                  <FilaDato etiqueta={t("ajustes.proveedor")} valor={etiquetasProveedor()} />
                  <FilaDato etiqueta={t("ajustes.miembro")} valor={fecha(perfil?.creado_en)} />
                  <button
                    type="button"
                    onClick={onEditarPerfil}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
                  >
                    <User size={15} /> {t("ajustes.editar_perfil")}
                  </button>
                  <button
                    type="button"
                    onClick={cerrarSesion}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
                  >
                    <LogOut size={15} /> {t("ajustes.cerrar_sesion")}
                  </button>
                  <div className="rounded-xl border border-transparent bg-transparent px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-app-muted">
                      {t("ajustes.metodos")}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {metodosVinculados().map((m) => (
                        <span
                          key={m.id}
                          className="rounded-full border border-emerald-700 bg-emerald-950/60 px-2.5 py-1 text-xs font-medium text-emerald-300"
                        >
                          {m.etiqueta}
                        </span>
                      ))}
                      {metodosVinculados().length === 0 && (
                        <span className="text-xs text-app-muted">{t("ajustes.cargando_metodos")}</span>
                      )}
                    </div>
                  </div>
                  {!metodosVinculados().some((m) => m.id === "google") && (
                    <button
                      type="button"
                      onClick={() => signIn("google", { callbackUrl: "/" })}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
                    >
                      {t("ajustes.conectar_google")}
                    </button>
                  )}
                  {!metodosVinculados().some((m) => m.id === "github") && (
                    <button
                      type="button"
                      onClick={() => signIn("github", { callbackUrl: "/" })}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
                    >
                      {t("ajustes.conectar_github")}
                    </button>
                  )}
                  <p className="text-xs leading-relaxed text-app-muted">
                    {t("ajustes.vincular_nota")}
                  </p>
                  {metodosVinculados().some((m) => m.id === "correo") && (
                    <Link
                      href="/recuperar"
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
                    >
                      {t("ajustes.cambiar_pass")}
                    </Link>
                  )}
                  <div className="rounded-xl border border-transparent bg-transparent px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-app-muted">
                      {t("ajustes.actividad")}
                    </p>
                    <p className="truncate text-sm font-medium text-gray-100">
                      {actividad?.ultimaFuente
                        ? `${t("ajustes.ultima_fuente")}: ${actividad.ultimaFuente.titulo}`
                        : t("ajustes.sin_fuentes_act")}
                    </p>
                    <p className="text-xs text-app-muted">
                      {actividad?.ultimaFuente
                        ? fecha(actividad.ultimaFuente.creado_en)
                        : t("ajustes.agrega_primero")}
                      {" · "}
                      {(estadisticas?.pendientes || 0) +
                        (estadisticas?.leidas || 0) +
                        (estadisticas?.guardadas || 0)}{" "}
                      {t("ajustes.noticias_en")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setPasoEliminar("modal")}
                      className="btn-press flex w-full items-center justify-center gap-1.5 text-sm font-medium text-red-300 hover:opacity-80"
                    >
                      <Trash2 size={15} /> {t("ajustes.eliminar_cuenta")}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {vista === "datos" && (
            <section className="stagger-in space-y-2.5">
              <div className="rounded-xl border border-transparent bg-transparent px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-app-muted">{t("ajustes.que_guarda")}</p>
                <p className="text-xs leading-relaxed text-app-muted">
                  {t("ajustes.que_guarda_d", {
                    f: estadisticas?.fuentes || 0,
                    n:
                      (estadisticas?.pendientes || 0) +
                      (estadisticas?.leidas || 0) +
                      (estadisticas?.guardadas || 0),
                  })}
                </p>
              </div>
              {esInvitado ? (
                <>
                  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
                    {t("ajustes.invitado_datos")}
                  </p>
                  <button
                    type="button"
                    onClick={onCerrarSesion}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
                  >
                    <Trash2 size={15} /> {t("ajustes.borrar_salir")}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={exportarDatos}
                    disabled={exportando}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40 disabled:opacity-50"
                  >
                    <Download size={15} /> {exportando ? t("ajustes.exportando") : t("ajustes.exportar")}
                  </button>
                </>
              )}
            </section>
          )}

          {vista === "ayuda" && (
            <section className="stagger-in space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  cerrar();
                  onAbrirGuia();
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-sky-800 bg-sky-950 px-3.5 py-3 text-left btn-press card-lift hover:border-sky-600"
              >
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 shrink-0 place-content-center rounded-full bg-sky-600 text-white"
                >
                  <HelpCircle size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-sky-100">{t("ajustes.guia_t")}</span>
                  <span className="block truncate text-xs text-sky-100/70">
                    {t("ajustes.guia_d")}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-sky-100/70" />
              </button>
              <FilaDato
                etiqueta={t("ajustes.app")}
                valor={`RSS Dashboard v${versionTexto}`}
              />
              <FilaDato
                etiqueta={t("ajustes.ultimo_cambio")}
                valor={
                  infoRepo
                    ? `${infoRepo.mensaje} · ${fecha(infoRepo.fecha)}`
                    : t("ajustes.consultando")
                }
              />
              <FilaDato etiqueta="Stack" valor={t("ajustes.stack")} />
              <FilaDato
                etiqueta={t("ajustes.actividad_prop")}
                valor={t("ajustes.actividad_val", {
                  f: estadisticas?.fuentes || 0,
                  n:
                    (estadisticas?.pendientes || 0) +
                    (estadisticas?.leidas || 0) +
                    (estadisticas?.guardadas || 0),
                })}
              />
              <a
                href={URL_REPOSITORIO}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
              >
                <GitHubIcon size={15} /> {t("ajustes.repositorio")}
              </a>
              <a
                href={URL_APP}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
              >
                {t("ajustes.abrir_app")}
              </a>
              <a
                href={URL_REPOSITORIO}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm font-medium text-amber-200 btn-press hover:bg-amber-500/20"
              >
                <Star size={15} /> {t("ajustes.estrella")}
              </a>
              <button
                type="button"
                onClick={compartirApp}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-sm font-medium text-app-fg btn-press hover:bg-app-raised/40"
              >
                <Share2 size={15} /> {t("ajustes.compartir")}
              </button>
              <p className="text-xs leading-relaxed text-app-muted">
                {t("ajustes.apoyo_nota")}
              </p>
            </section>
          )}
        </div>
      </aside>

      {/* Confirmación grande de eliminar cuenta: centrada, con consecuencias */}
      {(pasoEliminar === "modal" || pasoEliminar === "eliminando") && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => {
            if (pasoEliminar === "modal") setPasoEliminar("idle");
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-eliminar-cuenta"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-red-900/60 bg-gray-900 p-6 shadow-2xl sm:p-8"
          >
            <div className="mx-auto mb-4 grid h-14 w-14 place-content-center rounded-full border border-red-500/40 bg-red-500/15 text-red-400">
              <TriangleAlert size={26} />
            </div>
            <h3 id="titulo-eliminar-cuenta" className="text-center text-xl font-bold text-white">
              {t("ajustes.modal_titulo")}
            </h3>
            <p className="mt-2 text-center text-sm text-app-muted">
              {t("ajustes.modal_que")}
            </p>
            <ul className="mx-auto mt-3 max-w-xs list-disc space-y-1 pl-5 text-sm text-gray-300">
              <li>{t("ajustes.modal_l1")}</li>
              <li>{t("ajustes.modal_l2")}</li>
              <li>{t("ajustes.modal_l3")}</li>
            </ul>
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-center text-xs leading-relaxed text-amber-200">
              {t("ajustes.modal_aviso")}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPasoEliminar("idle")}
                disabled={pasoEliminar === "eliminando"}
                className="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-200 btn-press hover:bg-gray-700 disabled:opacity-50"
              >
                {t("ajustes.modal_cancelar")}
              </button>
              <button
                type="button"
                onClick={eliminarCuenta}
                disabled={pasoEliminar === "eliminando"}
                className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-medium text-white btn-press hover:bg-red-600 disabled:opacity-50 hover:shadow-lg hover:shadow-red-900/30"
              >
                {pasoEliminar === "eliminando" ? t("ajustes.modal_eliminando") : t("ajustes.modal_confirmar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
