// src/app/recuperar/page.js
// Recuperación de contraseña en 3 pasos: correo -> código de verificación -> nueva contraseña.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, Lock, Eye, EyeOff, CheckCircle2, ArrowLeft, ShieldCheck } from "lucide-react";

export default function RecuperarPage() {
  const [paso, setPaso] = useState(1);
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoDemo, setCodigoDemo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const solicitarCodigo = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "solicitar", email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo generar el código.");
      if (data.codigo) {
        setCodigoDemo(data.codigo);
        setMensaje(`Código generado. Válido por ${data.expiraMinutos || 15} minutos.`);
      } else {
        setCodigoDemo("");
        setMensaje(data.mensaje || "Si el correo está registrado recibirás un código de recuperación.");
      }
      setPaso(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verificarCodigo = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verificar", email, codigo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo verificar el código.");
      setPaso(3);
      setMensaje("Código verificado. Define tu nueva contraseña.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const restablecerPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/recuperar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restablecer", email, codigo, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo restablecer la contraseña.");
      setMensaje("Contraseña restablecida correctamente. Redirigiendo al inicio de sesión...");
      window.setTimeout(() => router.push("/login"), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100 p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-2 text-sky-400">
          <ShieldCheck size={22} />
        </div>
        <h2 className="text-2xl font-bold text-center tracking-tight text-white">Recuperar contraseña</h2>
        <p className="text-center text-xs text-gray-400 mt-1 mb-6">
          Paso {paso} de 3: {paso === 1 ? "Correo electrónico" : paso === 2 ? "Código de verificación" : "Nueva contraseña"}
        </p>

        <div className="flex items-center gap-1.5 mb-6" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition ${n <= paso ? "bg-sky-500" : "bg-gray-800"}`}
            />
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl mb-4 text-sm">
            {mensaje}
          </div>
        )}

        {paso === 1 && (
          <form onSubmit={solicitarCodigo} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">
                Correo Electrónico
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  autoComplete="email"
                  placeholder="Correo electrónico"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 transition"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-sky-600/20 text-sm disabled:opacity-60"
            >
              {loading ? "Generando código..." : "Generar código de recuperación"}
            </button>
          </form>
        )}

        {paso === 2 && (
          <form onSubmit={verificarCodigo} className="space-y-4">
            {codigoDemo && (
              <div className="bg-sky-500/10 border border-dashed border-sky-500/50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-400 mb-1">
                  Demostración sin servidor de correo: usa este código
                </p>
                <p className="text-2xl font-bold tracking-[0.35em] text-sky-300">{codigoDemo}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">
                Código de verificación
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <KeyRound size={18} />
                </span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={codigo}
                  autoComplete="one-time-code"
                  placeholder="Código de 6 dígitos"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm tracking-[0.3em] focus:outline-none focus:border-sky-500 transition"
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-sky-600/20 text-sm disabled:opacity-60"
            >
              {loading ? "Verificando..." : "Verificar código"}
            </button>
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="w-full text-xs text-gray-400 hover:text-gray-200 transition"
            >
              Solicitar un código nuevo
            </button>
          </form>
        )}

        {paso === 3 && (
          <form onSubmit={restablecerPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">
                Nueva contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock size={18} />
                </span>
                <input
                  type={verPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  autoComplete="new-password"
                  placeholder="Nueva contraseña"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-11 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 transition"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-100 transition"
                >
                  {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">
                Confirmar contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <CheckCircle2 size={18} />
                </span>
                <input
                  type={verPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmar}
                  autoComplete="new-password"
                  placeholder="Confirmar contraseña"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-sky-500 transition"
                  onChange={(e) => setConfirmar(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-sky-600/20 text-sm disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Restablecer contraseña"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          <Link href="/login" className="text-sky-400 hover:underline font-medium inline-flex items-center gap-1">
            <ArrowLeft size={13} /> Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
