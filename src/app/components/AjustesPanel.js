// src/app/components/AjustesPanel.js — Ajustes estilo Cuenta de Google.
// Menú de tarjetas (icono + título + descripción) con subvistas internas:
// Apariencia, Lectura, Información personal, Seguridad, Apps vinculadas,
// Notificaciones, Datos y privacidad, Apoyo al creador y Sobre el proyecto.
"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Palette,
  BookOpen,
  IdCard,
  ShieldCheck,
  Link2,
  BellRing,
  Database,
  Heart,
  Info,
  User,
  Download,
  Trash2,
  Share2,
  LogOut,
  HelpCircle,
  Rss,
} from "lucide-react";
import { TEMAS } from "@/lib/temas";

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

function etiquetaProveedor(proveedor) {
  if (proveedor === "google") return "Google";
  if (proveedor === "github") return "GitHub";
  return "Correo y contraseña";
}

function formatearFecha(valor) {
  if (!valor) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(valor));
  } catch {
    return "—";
  }
}

function TarjetaAjuste({ icono, fondoIcono, tintaIcono, titulo, descripcion, onAbrir }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950 px-3.5 py-3 text-left transition hover:border-gray-600"
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: fondoIcono, color: tintaIcono }}
        className="grid h-11 w-11 shrink-0 place-content-center rounded-full"
      >
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-100">{titulo}</span>
        <span className="block truncate text-xs text-gray-500">{descripcion}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-gray-500" />
    </button>
  );
}

function FilaDato({ etiqueta, valor }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{etiqueta}</p>
      <p className="truncate text-sm font-medium text-gray-100">{valor}</p>
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
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-left transition hover:border-gray-600"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-200">{etiqueta}</span>
        {descripcion && <span className="block text-xs text-gray-500">{descripcion}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          activado ? "bg-sky-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            activado ? "left-[1.375rem]" : "left-0.5"
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
  tamanoPagina,
  onTamanoPagina,
  autoMarcarLeida,
  onAutoMarcar,
  movimientoReducido,
  onMovimiento,
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
  const [dispositivos, setDispositivos] = useState([]);
  const [exportando, setExportando] = useState(false);
  const [pasoEliminar, setPasoEliminar] = useState("idle");
  const cerrarRef = useRef(null);

  // Foco inicial + Escape (retrocede de subvista o cierra). Sin setState
  // en el cuerpo del efecto: los cambios van en el listener del teclado.
  useEffect(() => {
    if (!abierto) return undefined;
    cerrarRef.current?.focus();
    const alTeclado = (event) => {
      if (event.key !== "Escape") return;
      setPasoEliminar("idle");
      if (vista) setVista(null);
      else onCerrar();
    };
    document.addEventListener("keydown", alTeclado);
    return () => document.removeEventListener("keydown", alTeclado);
  }, [abierto, vista, onCerrar]);

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

  const cargarDispositivos = async () => {
    try {
      const res = await fetch("/api/push?dispositivos=1", { cache: "no-store" });
      if (res.ok) setDispositivos(await res.json());
    } catch {
      // Sin lista: se muestra el conteo local.
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
    if (id === "personal" || id === "seguridad" || id === "apps") cargarPerfil();
    if (id === "seguridad") cargarActividad();
    if (id === "apps") cargarDispositivos();
  };

  const exportarDatos = async () => {
    setExportando(true);
    try {
      const res = await fetch("/api/datos", { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron exportar los datos.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = "mis-datos-rss.json";
      enlace.click();
      URL.revokeObjectURL(url);
      onNotify("Datos exportados en JSON.", "success");
    } catch (err) {
      onNotify(err.message || "No se pudo exportar.", "error");
    } finally {
      setExportando(false);
    }
  };

  const eliminarCuenta = async () => {
    setPasoEliminar("eliminando");
    try {
      const res = await fetch("/api/datos", { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar la cuenta.");
      onNotify("Cuenta y datos eliminados.", "success");
      await signOut({ callbackUrl: "/login" });
    } catch (err) {
      onNotify(err.message || "No se pudo eliminar.", "error");
      setPasoEliminar("idle");
    }
  };

  const desvincularDispositivos = async () => {
    try {
      const res = await fetch("/api/push?all=true", { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudieron desvincular.");
      setDispositivos([]);
      onNotify("Dispositivos desvinculados.", "success");
    } catch (err) {
      onNotify(err.message || "No se pudo completar.", "error");
    }
  };

  const compartirApp = async () => {
    const datos = {
      title: "RSS Dashboard",
      text: "Leo mis noticias RSS aquí, échale un ojo:",
      url: URL_APP,
    };
    try {
      if (navigator.share) {
        await navigator.share(datos);
      } else {
        await navigator.clipboard.writeText(datos.url);
        onNotify("Enlace copiado al portapapeles.", "success");
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
    await signOut({ callbackUrl: "/login" });
  };

  const inicial = (nombreUsuario || "?").trim().charAt(0).toUpperCase() || "?";
  const proveedor = perfil?.proveedor || null;
  const totalNoticias =
    (estadisticas?.pendientes || 0) + (estadisticas?.leidas || 0) + (estadisticas?.guardadas || 0);

  const titulos = {
    apariencia: "Apariencia",
    lectura: "Lectura",
    personal: "Información personal",
    seguridad: "Seguridad y acceso",
    apps: "Apps vinculadas",
    notificaciones: "Notificaciones",
    datos: "Datos y privacidad",
    apoyo: "Apoyo al creador",
    proyecto: "Sobre el proyecto",
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
        aria-label={vista ? titulos[vista] : "Ajustes"}
        className="anim-panel-izquierda fixed inset-y-0 left-0 z-50 flex w-[min(22rem,88vw)] flex-col border-r border-gray-800 bg-gray-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-3">
          {vista ? (
            <button
              type="button"
              onClick={atras}
              aria-label="Volver a ajustes"
              className="rounded-lg p-1.5 text-gray-300 transition hover:bg-gray-800 hover:text-white"
            >
              <ChevronLeft size={20} />
            </button>
          ) : null}
          <h2 className="min-w-0 flex-1 truncate text-base font-bold text-white">
            {vista ? titulos[vista] : "Ajustes"}
          </h2>
          <button
            ref={cerrarRef}
            type="button"
            onClick={cerrar}
            aria-label="Cerrar ajustes"
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="panel-scroll flex-1 space-y-3 overflow-y-auto px-3.5 py-4">
          {!vista && (
            <>
              {/* Cabecera de cuenta (abre Información personal) */}
              <button
                type="button"
                onClick={() => abrirVista("personal")}
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950 px-3.5 py-3 text-left transition hover:border-gray-600"
              >
                {imagenUsuario && !esInvitado ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagenUsuario}
                    alt=""
                    aria-hidden="true"
                    className="h-11 w-11 shrink-0 rounded-full border border-gray-700 object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-content-center rounded-full bg-sky-600 text-lg font-bold text-white"
                  >
                    {inicial}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-gray-100">
                    {nombreUsuario || "Sin sesión"}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {esInvitado ? "Modo invitado (temporal)" : emailUsuario || ""}
                  </span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-gray-500" />
              </button>

              <TarjetaAjuste
                icono={<Palette size={20} />}
                fondoIcono="#e0e7ff"
                tintaIcono="#3730a3"
                titulo="Apariencia"
                descripcion="Temas de color"
                onAbrir={() => abrirVista("apariencia")}
              />
              <TarjetaAjuste
                icono={<BookOpen size={20} />}
                fondoIcono="#fef3c7"
                tintaIcono="#92400e"
                titulo="Lectura"
                descripcion="Página, automarcado, animaciones"
                onAbrir={() => abrirVista("lectura")}
              />
              <TarjetaAjuste
                icono={<IdCard size={20} />}
                fondoIcono="#dcfce7"
                tintaIcono="#166534"
                titulo="Información personal"
                descripcion="Nombre, correo y proveedor"
                onAbrir={() => abrirVista("personal")}
              />
              <TarjetaAjuste
                icono={<ShieldCheck size={20} />}
                fondoIcono="#dbeafe"
                tintaIcono="#1e40af"
                titulo="Seguridad y acceso"
                descripcion="Acceso, contraseña y sesión"
                onAbrir={() => abrirVista("seguridad")}
              />
              <TarjetaAjuste
                icono={<Link2 size={20} />}
                fondoIcono="#f3e8ff"
                tintaIcono="#7e22ce"
                titulo="Apps vinculadas"
                descripcion="Proveedor y dispositivos"
                onAbrir={() => abrirVista("apps")}
              />
              <TarjetaAjuste
                icono={<BellRing size={20} />}
                fondoIcono="#ffedd5"
                tintaIcono="#9a3412"
                titulo="Notificaciones"
                descripcion={pushActivado ? "Avisos push activados" : "Avisos push de noticias"}
                onAbrir={() => abrirVista("notificaciones")}
              />
              <TarjetaAjuste
                icono={<Database size={20} />}
                fondoIcono="#ccfbf1"
                tintaIcono="#115e59"
                titulo="Datos y privacidad"
                descripcion="Exportar o eliminar tus datos"
                onAbrir={() => abrirVista("datos")}
              />
              <TarjetaAjuste
                icono={<Heart size={20} />}
                fondoIcono="#fce7f3"
                tintaIcono="#9d174d"
                titulo="Apoyo al creador"
                descripcion="GitHub y compartir"
                onAbrir={() => abrirVista("apoyo")}
              />
              <TarjetaAjuste
                icono={<Info size={20} />}
                fondoIcono="#f3f4f6"
                tintaIcono="#374151"
                titulo="Sobre el proyecto"
                descripcion="Versión, stack y estado"
                onAbrir={() => abrirVista("proyecto")}
              />

              {/* Sesión: ayuda y salida (antes en la barra superior) */}
              <div className="space-y-2 border-t border-gray-800 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    cerrar();
                    onAbrirGuia();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-left transition hover:border-gray-600"
                >
                  <HelpCircle size={17} className="shrink-0 text-sky-400" />
                  <span className="flex-1 text-sm font-medium text-gray-200">Guía RSS</span>
                </button>
                <button
                  type="button"
                  onClick={cerrarSesion}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-left transition hover:border-gray-600"
                >
                  <LogOut size={17} className="shrink-0 text-gray-400" />
                  <span className="flex-1 text-sm font-medium text-gray-200">
                    {esInvitado ? "Salir y borrar datos" : "Cerrar sesión"}
                  </span>
                </button>
                <p className="flex items-center justify-center gap-1.5 px-1 pt-1 text-[11px] text-gray-500">
                  <Rss size={11} aria-hidden="true" /> RSS Dashboard v1.0
                </p>
              </div>
            </>
          )}

          {vista === "apariencia" && (
            <section className="space-y-2.5">
              <p className="text-xs leading-relaxed text-gray-500">
                El tema se aplica en toda la app y se guarda en este navegador.
              </p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Tema de color">
                {TEMAS.map((t) => {
                  const activo = tema === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={activo}
                      onClick={() => onTema(t.id)}
                      title={t.claro ? `${t.nombre} (claro)` : `${t.nombre} (oscuro)`}
                      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                        activo
                          ? "border-sky-500 bg-sky-500/15"
                          : "border-gray-800 bg-gray-950 hover:border-gray-600"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        style={{ background: `linear-gradient(135deg, ${t.bg} 50%, ${t.accent} 50%)` }}
                        className="h-7 w-7 shrink-0 rounded-full border border-gray-700"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-200">
                        {t.nombre}
                      </span>
                      {activo && <Check size={14} strokeWidth={3} className="shrink-0 text-sky-400" />}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {vista === "lectura" && (
            <section className="space-y-2.5">
              <div>
                <span id="ajustes-tamano-pagina" className="mb-1.5 block text-xs font-medium text-gray-400">
                  Noticias por página
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
              <Interruptor
                activado={autoMarcarLeida}
                onCambiar={onAutoMarcar}
                etiqueta="Marcar como leída al abrir"
                descripcion="Al abrir una noticia se marca leída sola."
              />
              <Interruptor
                activado={movimientoReducido}
                onCambiar={onMovimiento}
                etiqueta="Reducir animaciones"
                descripcion="Calma transiciones y efectos de movimiento."
              />
              <p className="text-xs leading-relaxed text-gray-500">
                El tamaño de letra se ajusta dentro del lector de noticias (icono A).
              </p>
            </section>
          )}

          {vista === "personal" && (
            <section className="space-y-2.5">
              {esInvitado ? (
                <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
                  Estás en modo invitado: no hay perfil permanente. Crea una cuenta para conservar
                  tu información.
                </p>
              ) : (
                <>
                  <FilaDato etiqueta="Nombre" valor={perfil?.nombre || nombreUsuario || "—"} />
                  <FilaDato etiqueta="Correo" valor={perfil?.email || emailUsuario || "—"} />
                  <FilaDato etiqueta="Proveedor" valor={etiquetaProveedor(proveedor)} />
                  <FilaDato etiqueta="Miembro desde" valor={formatearFecha(perfil?.creado_en)} />
                  <button
                    type="button"
                    onClick={onEditarPerfil}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
                  >
                    <User size={15} /> Editar perfil
                  </button>
                  <button
                    type="button"
                    onClick={cerrarSesion}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
                  >
                    <LogOut size={15} /> Cerrar sesión
                  </button>
                </>
              )}
            </section>
          )}

          {vista === "seguridad" && (
            <section className="space-y-2.5">
              <FilaDato
                etiqueta="Método de acceso"
                valor={esInvitado ? "Invitado (temporal)" : etiquetaProveedor(proveedor)}
              />
              {!esInvitado && !proveedor && (
                <Link
                  href="/recuperar"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
                >
                  Cambiar contraseña
                </Link>
              )}
              {!esInvitado && proveedor && proveedor !== "credenciales" && (
                <p className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-xs leading-relaxed text-gray-400">
                  Tu acceso lo protege {etiquetaProveedor(proveedor)}: la contraseña se gestiona
                  ahí, no en esta app.
                </p>
              )}
              <div className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Actividad reciente
                </p>
                {esInvitado ? (
                  <p className="text-xs leading-relaxed text-gray-400">
                    Sesión temporal de invitado: sin historial permanente.
                  </p>
                ) : (
                  <>
                    <p className="truncate text-sm font-medium text-gray-100">
                      {actividad?.ultimaFuente
                        ? `Última fuente: ${actividad.ultimaFuente.titulo}`
                        : "Aún no agregas fuentes"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {actividad?.ultimaFuente
                        ? formatearFecha(actividad.ultimaFuente.creado_en)
                        : "Agrega tu primer feed desde el dashboard"}
                      {" · "}
                      {(estadisticas?.pendientes || 0) +
                        (estadisticas?.leidas || 0) +
                        (estadisticas?.guardadas || 0)}{" "}
                      noticias en tu cuenta
                    </p>
                  </>
                )}
              </div>
            </section>
          )}

          {vista === "apps" && (
            <section className="space-y-2.5">
              <FilaDato
                etiqueta="Proveedor de acceso"
                valor={esInvitado ? "Ninguno (invitado)" : etiquetaProveedor(proveedor)}
              />
              <div className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">
                  Dispositivos con avisos push
                </p>
                <p className="text-sm font-medium text-gray-100">
                  {dispositivos.length === 0
                    ? "Ninguno vinculado"
                    : `${dispositivos.length} vinculado${dispositivos.length === 1 ? "" : "s"}`}
                </p>
                {dispositivos.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {dispositivos.map((d) => (
                      <li key={d.id} className="text-xs text-gray-500">
                        Dispositivo del {formatearFecha(d.creado_en)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {dispositivos.length > 0 && (
                <button
                  type="button"
                  onClick={desvincularDispositivos}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
                >
                  Desvincular todos
                </button>
              )}
              <p className="text-xs leading-relaxed text-gray-500">
                Solo esta app y tu proveedor de acceso manejan tus datos de sesión.
              </p>
            </section>
          )}

          {vista === "notificaciones" && (
            <section className="space-y-2.5">
              {!pushSoportado ? (
                <p className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-xs leading-relaxed text-gray-400">
                  Tu navegador no soporta notificaciones push. Prueba con Chrome o Edge en
                  escritorio o Android.
                </p>
              ) : (
                <>
                  <div className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Estado</p>
                    <p className="text-sm font-medium text-gray-100">
                      {pushActivado ? "Avisos activados en este dispositivo" : "Avisos desactivados"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onGestionarPush}
                    disabled={pushCargando}
                    aria-pressed={pushActivado}
                    className="w-full rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white disabled:opacity-50"
                  >
                    {pushCargando
                      ? "Configurando..."
                      : pushActivado
                        ? "Desactivar avisos"
                        : "Activar avisos push"}
                  </button>
                  <p className="text-xs leading-relaxed text-gray-500">
                    Te avisamos cuando el refresco (manual o automático) encuentre noticias nuevas.
                  </p>
                </>
              )}
            </section>
          )}

          {vista === "datos" && (
            <section className="space-y-2.5">
              <div className="rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-gray-500">Qué se guarda</p>
                <p className="text-xs leading-relaxed text-gray-400">
                  {estadisticas?.fuentes || 0} fuentes ·{" "}
                  {(estadisticas?.pendientes || 0) +
                    (estadisticas?.leidas || 0) +
                    (estadisticas?.guardadas || 0)}{" "}
                  noticias · tus vistas guardadas y tus dispositivos push. Nada más.
                </p>
              </div>
              {esInvitado ? (
                <>
                  <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-200">
                    En modo invitado tus datos viven solo en esta sesión y se borran al salir.
                  </p>
                  <button
                    type="button"
                    onClick={onCerrarSesion}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
                  >
                    <Trash2 size={15} /> Borrar datos y salir
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={exportarDatos}
                    disabled={exportando}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white disabled:opacity-50"
                  >
                    <Download size={15} /> {exportando ? "Exportando..." : "Exportar mis datos (JSON)"}
                  </button>
                  <div className="rounded-xl border border-red-900/50 bg-red-950/40 px-3 py-2.5">
                    {pasoEliminar === "confirmar" ? (
                      <>
                        <p className="text-xs leading-relaxed text-red-200">
                          Se borrarán tu cuenta, fuentes, noticias, vistas y dispositivos. No se
                          puede deshacer. ¿Continuar?
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPasoEliminar("idle")}
                            className="rounded-lg bg-gray-800 px-3 py-2 text-xs font-medium text-gray-200 transition hover:bg-gray-700"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={eliminarCuenta}
                            disabled={pasoEliminar === "eliminando"}
                            className="rounded-lg bg-red-700 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                          >
                            {pasoEliminar === "eliminando" ? "Eliminando..." : "Sí, eliminar todo"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPasoEliminar("confirmar")}
                        className="flex w-full items-center justify-center gap-1.5 text-sm font-medium text-red-300 transition hover:text-red-200"
                      >
                        <Trash2 size={15} /> Eliminar mi cuenta y datos
                      </button>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {vista === "apoyo" && (
            <section className="space-y-2.5">
              <a
                href={URL_REPOSITORIO}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-3 rounded-2xl border border-gray-800 bg-gray-950 px-3.5 py-3 text-left transition hover:border-gray-600"
              >
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 shrink-0 place-content-center rounded-full bg-gray-800 text-gray-100"
                >
                  <GitHubIcon size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-100">Código en GitHub</span>
                  <span className="block truncate text-xs text-gray-500">
                    vxnez/lector-rss-next · regálale una estrella
                  </span>
                </span>
              </a>
              <button
                type="button"
                onClick={compartirApp}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
              >
                <Share2 size={15} /> Compartir la app
              </button>
              <p className="text-xs leading-relaxed text-gray-500">
                Proyecto universitario de código abierto. Compartirlo es la mejor forma de apoyarlo.
              </p>
            </section>
          )}

          {vista === "proyecto" && (
            <section className="space-y-2.5">
              <FilaDato etiqueta="App" valor={`RSS Dashboard v${VERSION_APP}`} />
              <FilaDato etiqueta="Stack" valor="Next.js 16 · React 19 · MySQL · Gemini · Tailwind" />
              <FilaDato
                etiqueta="Tu actividad"
                valor={`${estadisticas?.fuentes || 0} fuentes · ${
                  (estadisticas?.pendientes || 0) +
                  (estadisticas?.leidas || 0) +
                  (estadisticas?.guardadas || 0)
                } noticias`}
              />
              <a
                href={URL_APP}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
              >
                Abrir app desplegada
              </a>
              <a
                href={URL_REPOSITORIO}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:border-gray-600 hover:text-white"
              >
                <GitHubIcon size={15} /> Repositorio
              </a>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
