// src/app/components/PerfilModal.js
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Save, Camera, User } from "lucide-react";

const NOMBRE_PROVEEDOR = {
  google: "Google",
  github: "GitHub",
  credentials: "Correo y contraseña",
};

const OPCIONES_GENERO = [
  { valor: "hombre", etiqueta: "Hombre" },
  { valor: "mujer", etiqueta: "Mujer" },
  { valor: "no_mencionarlo", etiqueta: "Prefiero no mencionarlo" },
];

function dividirNombre(nombreCompleto = "") {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean);
  return { nombre: partes[0] || "", apellido: partes.slice(1).join(" ") };
}

function formatearFecha(fechaStr) {
  if (!fechaStr) return "No disponible";
  try {
    const fecha = new Date(fechaStr);
    if (isNaN(fecha.getTime())) return "No disponible";
    return new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(fecha);
  } catch {
    return "No disponible";
  }
}

function redimensionarImagen(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("El archivo debe ser una imagen."));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error("La imagen no debe superar 5 MB."));
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
          reject(new Error("La imagen es demasiado pesada, prueba con otra."));
          return;
        }
        resolve(dataUrl);
      } catch {
        reject(new Error("No se pudo procesar la imagen."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen."));
    };
    img.src = objectUrl;
  });
}

export default function PerfilModal({ isOpen, onClose, onSuccess, onNotify }) {
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
        if (!res.ok) throw new Error(data.error || "No se pudo cargar el perfil.");
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
          setError(err.message || "No se pudo cargar el perfil.");
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const seleccionarArchivo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const dataUrl = await redimensionarImagen(file);
      setImagen(dataUrl);
      setUrlImagen("");
    } catch (err) {
      setError(err.message);
    }
  };

  const usarUrlImagen = () => {
    const valor = urlImagen.trim();
    if (!/^https?:\/\/.+/i.test(valor)) {
      setError("Pega una URL de imagen válida que empiece con http.");
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
      setError("El nombre es obligatorio.");
      return;
    }
    const nombreCompleto = apellidoLimpio ? `${nombreLimpio} ${apellidoLimpio}` : nombreLimpio;
    if (nombreCompleto.length > 100) {
      setError("El nombre completo no debe superar 100 caracteres.");
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
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el perfil.");
      onNotify?.("Perfil actualizado correctamente.", "success");
      if (onSuccess) await onSuccess(data.perfil);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const inicial = (nombre.trim() || perfil?.nombre || perfil?.email || "?").charAt(0).toUpperCase();
  const nombreProveedor = NOMBRE_PROVEEDOR[perfil?.proveedor] || perfil?.proveedor || "—";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-800 p-4 sm:p-6 rounded-xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl relative">
        <button
          onClick={onClose}
          aria-label="Cerrar perfil"
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-5 pr-8">
          <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
            <User size={20} />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white">Editar perfil</h3>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {cargando ? (
          <p className="text-sm text-gray-400 py-8 text-center">Cargando perfil...</p>
        ) : (
          <form onSubmit={handleGuardar} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagen}
                    alt="Foto de perfil"
                    className="h-16 w-16 rounded-full object-cover border border-gray-700"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-600/20 border border-sky-500/30 text-sky-400 text-2xl font-bold">
                    {inicial}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => inputArchivo.current?.click()}
                  className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded-lg transition w-fit"
                >
                  <Camera size={14} />
                  <span>Subir imagen</span>
                </button>
                <input
                  ref={inputArchivo}
                  type="file"
                  accept="image/*"
                  onChange={seleccionarArchivo}
                  className="hidden"
                  aria-label="Subir imagen de perfil"
                />
                {imagen && (
                  <button
                    type="button"
                    onClick={quitarImagen}
                    className="text-xs text-gray-400 hover:text-rose-400 transition w-fit"
                  >
                    Quitar imagen
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">
                URL de imagen (opcional)
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://ejemplo.com/foto.jpg"
                  value={urlImagen}
                  onChange={(event) => setUrlImagen(event.target.value)}
                  className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 text-sm transition"
                />
                <button
                  type="button"
                  onClick={usarUrlImagen}
                  className="shrink-0 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded-lg transition"
                >
                  Usar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={nombre}
                  onChange={(event) => setNombre(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 text-sm transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-300">
                  Apellido
                </label>
                <input
                  type="text"
                  maxLength={100}
                  value={apellido}
                  onChange={(event) => setApellido(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 text-sm transition"
                />
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium mb-1 text-gray-300" id="etiqueta-genero">
                Género
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
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${
                        activa
                          ? "border-sky-500 bg-sky-500/10 text-sky-300"
                          : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {opcion.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3 text-xs text-gray-400 space-y-1.5">
              <p>
                <span className="text-gray-500">ID de usuario: </span>
                <span className="text-gray-200 font-mono">#{perfil?.id ?? "—"}</span>
              </p>
              <p>
                <span className="text-gray-500">Correo: </span>
                <span className="text-gray-200 break-all">{perfil?.email ?? "—"}</span>
              </p>
              <p>
                <span className="text-gray-500">Acceso con: </span>
                <span className="text-gray-200">{nombreProveedor}</span>
              </p>
              <p>
                <span className="text-gray-500">Miembro desde: </span>
                <span className="text-gray-200">{formatearFecha(perfil?.creado_en)}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-3 pt-4 border-t border-gray-800/60">
              <button
                type="button"
                onClick={onClose}
                className="px-3 sm:px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="px-3 sm:px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm font-medium text-white transition disabled:opacity-50 flex items-center justify-center gap-2 min-w-0"
              >
                <Save size={16} />
                <span>{guardando ? "Guardando..." : "Guardar"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
