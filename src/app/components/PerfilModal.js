// src/app/components/PerfilModal.js
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Save, Camera, User } from "lucide-react";
import { useIdioma } from "@/lib/i18n";

function dividirNombre(nombreCompleto = "") {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  return { nombre: partes[0] || "", apellido: partes.slice(1).join(" ") };
}

function FilaDatoPerfil({ etiqueta, valor, mono }) {
  return (
    <div className="border-b border-app-line/60 px-1 py-2 last:border-b-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-app-muted/70">{etiqueta}</p>
      <p className={`mt-0.5 truncate text-sm font-medium text-app-fg ${mono ? "font-mono" : ""}`}>{valor}</p>
    </div>
  );
}

function formatearFecha(fechaStr, t, locale, sinDato) {
  if (!fechaStr) return sinDato;
  try {
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return sinDato;
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(fecha);
  } catch {
    return sinDato;
  }
}

function redimensionarImagen(file, t) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error(t("perfil.err_imagen_tipo")));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error(t("perfil.err_imagen_peso")));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const lado = 256;
        const escala = Math.max(lado / img.width, lado / img.height);
        const canvas = document.createElement("canvas");
        canvas.width = lado;
        canvas.height = lado;
        const ctx = canvas.getContext("2d");
        const ancho = img.width * escala;
        const alto = img.height * escala;
        ctx.drawImage(img, (lado - ancho) / 2, (lado - alto) / 2, ancho, alto);
        URL.revokeObjectURL(objectUrl);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        if (dataUrl.length > 60000) {
          reject(new Error(t("perfil.err_imagen_pesada")));
          return;
        }
        resolve(dataUrl);
      } catch {
        reject(new Error(t("perfil.err_imagen_proceso")));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(t("perfil.err_imagen_leer")));
    };
    img.src = objectUrl;
  });
}

export default function PerfilModal({ isOpen, onClose, onSuccess, onNotify }) {
  const { t, locale } = useIdioma();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [genero, setGenero] = useState("no_mencionarlo");
  const [imagen, setImagen] = useState(null);
  const [urlImagen, setUrlImagen] = useState("");
  const [perfil, setPerfil] = useState(null);
  const inputArchivo = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    fetch("/api/perfil", { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || t("perfil.err_cargar"));
        if (controller.signal.aborted) return;
        const partes = dividirNombre(data.nombre || "");
        setNombre(partes.nombre);
        setApellido(partes.apellido);
        setGenero(data.genero || "no_mencionarlo");
        setImagen(data.imagen_url || null);
        setUrlImagen("");
        setPerfil(data);
        setCargando(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError" && !controller.signal.aborted) {
          setError(err.message || t("perfil.err_cargar"));
          setCargando(false);
        }
      });
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      controller.abort();
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, t]);

  if (!isOpen) return null;

  const seleccionarArchivo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const dataUrl = await redimensionarImagen(file, t);
      setImagen(dataUrl);
      setUrlImagen("");
    } catch (err) {
      setError(err.message);
    }
  };

  const usarUrlImagen = () => {
    const valor = urlImagen.trim();
    if (!/^https?:\/\/.+/i.test(valor)) {
      setError(t("perfil.err_url"));
      return;
    }
    setError("");
    setImagen(valor);
  };

  const quitarImagen = () => {
    setImagen(null);
    setUrlImagen("");
  };

  const handleGuardar = async (event) => {
    event.preventDefault();
    const nombreLimpio = nombre.trim();
    const apellidoLimpio = apellido.trim();
    if (!nombreLimpio) {
      setError(t("perfil.err_nombre"));
      return;
    }
    const nombreCompleto = apellidoLimpio ? `${nombreLimpio} ${apellidoLimpio}` : nombreLimpio;
    if (nombreCompleto.length > 100) {
      setError(t("perfil.err_nombre_largo"));
      return;
    }
    setGuardando(true);
    setError("");
    try {
      const res = await fetch("/api/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreCompleto, imagen_url: imagen, genero }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("perfil.err_guardar"));
      onNotify?.(t("perfil.ok"), "success");
      if (onSuccess) await onSuccess(data.perfil);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const inicial = (nombre.trim() || perfil?.nombre || perfil?.email || "?").charAt(0).toUpperCase();
  const NOMBRES_PROVEEDOR = {
    google: t("perfil.prov_google"),
    github: t("perfil.prov_github"),
    credentials: t("perfil.prov_correo"),
  };
  const OPCIONES_GENERO = [
    { valor: "hombre", etiqueta: t("perfil.genero_h") },
    { valor: "mujer", etiqueta: t("perfil.genero_m") },
    { valor: "no_mencionarlo", etiqueta: t("perfil.genero_x") },
  ];
  const nombreProveedor = NOMBRES_PROVEEDOR[perfil?.proveedor] || perfil?.proveedor || "—";
  const fechaMiembro = formatearFecha(perfil?.creado_en, t, locale, t("perfil.no_disponible"));

  return (
    <div
      className="anim-overlay fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="anim-modal bg-app-surface border border-app-line p-4 sm:p-6 rounded-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-hidden shadow-2xl relative flex flex-col">
        <button
          onClick={onClose}
          aria-label={t("perfil.cerrar_aria")}
          className="btn-press absolute top-4 right-4 z-10 text-app-muted hover:text-app-fg p-1.5 rounded-lg hover:bg-app-raised/40"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-4 pr-8 shrink-0">
          <div className="p-2 bg-[var(--accent)]/15 text-[var(--accent-ink)] rounded-full border border-[var(--accent)]/20">
            <User size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-bold text-app-fg">{t("perfil.titulo")}</h3>
            <p className="text-xs text-app-muted leading-relaxed">{t("perfil.subtitulo")}</p>
          </div>
        </div>

        {error && (
          <div className="anim-toast bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-sm mb-3 shrink-0">
            {error}
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-app-muted py-8 text-center">{t("perfil.cargando")}</p>
        ) : (
          <form onSubmit={handleGuardar} className="flex min-h-0 flex-1 flex-col">
            <div className="scroll-sutil min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-app-muted/70">
              {t("ajustes.datos_personales")}
            </p>
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagen}
                    alt={t("perfil.foto_alt")}
                    className="h-16 w-16 rounded-full object-cover border border-app-line"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/25 text-[var(--accent-ink)] text-2xl font-bold">
                    {inicial}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => inputArchivo.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 py-2 text-app-fg text-xs btn-press hover:bg-app-raised/40 transition w-fit"
                >
                  <Camera size={14} />
                  <span>{t("perfil.subir")}</span>
                </button>
                <input
                  ref={inputArchivo}
                  type="file"
                  accept="image/*"
                  onChange={seleccionarArchivo}
                  className="hidden"
                  aria-label={t("perfil.subir_aria")}
                />
                {imagen && (
                  <button
                    type="button"
                    onClick={quitarImagen}
                    className="text-xs text-app-muted hover:text-rose-400 transition w-fit"
                  >
                    {t("perfil.quitar")}
                  </button>
                )}
                <p className="text-[11px] leading-relaxed text-app-muted">
                  {t("perfil.peso_nota")}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1 text-app-muted">
                {t("perfil.url_label")}
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder={t("perfil.url_ph")}
                  value={urlImagen}
                  onChange={(event) => setUrlImagen(event.target.value)}
                  className="flex-1 min-w-0 bg-app-raised/50 border border-app-line rounded-lg px-3 py-2 text-app-fg placeholder:text-app-muted focus:outline-none text-sm field-focus"
                />
                <button
                  type="button"
                  onClick={usarUrlImagen}
                  className="shrink-0 rounded-xl border border-transparent bg-transparent px-3 py-2 text-app-fg text-xs btn-press hover:bg-app-raised/40 transition"
                >
                  {t("perfil.usar")}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1 text-app-muted">
                  {t("perfil.nombre")}
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  className="w-full bg-app-raised/50 border border-app-line rounded-lg px-3 py-2 text-app-fg placeholder:text-app-muted focus:outline-none text-sm field-focus"
                />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-medium mb-1 text-app-muted">
                  {t("perfil.apellido")}
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={apellido}
                  onChange={(event) => setApellido(event.target.value)}
                  className="w-full bg-app-raised/50 border border-app-line rounded-lg px-3 py-2 text-app-fg placeholder:text-app-muted focus:outline-none text-sm field-focus"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium mb-1 text-app-muted" id="etiqueta-genero">
                {t("perfil.genero")}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-labelledby="etiqueta-genero">
                {OPCIONES_GENERO.map((opcion) => {
                  const activa = genero === opcion.valor;
                  return (
                    <button
                      key={opcion.valor}
                      type="button"
                      role="radio"
                      aria-checked={activa}
                      onClick={() => setGenero(opcion.valor)}
                      className={`min-w-0 truncate px-3 py-2 rounded-lg text-xs font-medium border transition ${
                        activa
                          ? "border-[var(--accent)]/60 bg-transparent text-app-fg"
                          : "border-transparent bg-transparent text-app-muted hover:bg-app-raised/40 hover:text-app-fg"
                      }`}
                    >
                      {opcion.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-app-muted/70">
              {t("ajustes.cuenta_grupo")}
            </p>
            <div>
              <FilaDatoPerfil etiqueta={t("perfil.id_usuario")} valor={perfil?.id ? `#${perfil.id}` : "—"} mono />
              <FilaDatoPerfil etiqueta={t("perfil.correo")} valor={perfil?.email ?? "—"} />
              <FilaDatoPerfil etiqueta={t("perfil.acceso")} valor={nombreProveedor} />
              <FilaDatoPerfil etiqueta={t("perfil.miembro")} valor={fechaMiembro} />
            </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-app-line pt-3 sm:flex sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-press px-3 sm:px-4 py-2 rounded-xl border border-transparent bg-transparent text-sm font-medium text-app-fg hover:bg-app-raised/40"
              >
                {t("perfil.cancelar")}
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="btn-press px-3 sm:px-4 py-2 bg-[var(--accent-strong)] hover:opacity-90 rounded-xl text-sm font-medium text-[var(--on-accent-strong)] disabled:opacity-50 flex items-center justify-center gap-2 min-w-0"
              >
                <Save size={16} />
                <span className="truncate">{guardando ? t("perfil.guardando") : t("perfil.guardar")}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
