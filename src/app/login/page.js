// src/app/login/page.js
"use client";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, UserRound, TriangleAlert, X } from "lucide-react";

const RECORDAR_CORREO_CLAVE = "lector_recordar_correo";

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [verPassword, setVerPassword] = useState(false);
  const [recordarme, setRecordarme] = useState(false);
  const [mostrarAvisoInvitado, setMostrarAvisoInvitado] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(RECORDAR_CORREO_CLAVE);
      if (guardado) {
        setForm((actual) => ({ ...actual, email: guardado }));
        setRecordarme(true);
      }
    } catch {
      // Sin almacenamiento disponible: se continúa sin recordar el correo.
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      try {
        if (recordarme) window.localStorage.setItem(RECORDAR_CORREO_CLAVE, form.email);
        else window.localStorage.removeItem(RECORDAR_CORREO_CLAVE);
      } catch {
        // Sin almacenamiento disponible: se continúa con el inicio de sesión.
      }

      const res = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (res?.error) {
        setError("Credenciales incorrectas");
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("No se pudo iniciar sesión. Inténtalo de nuevo.");
      setLoading(false);
    }
  };

  const entrarComoInvitado = () => {
    try {
      window.sessionStorage.setItem("modo_invitado", "1");
    } catch {
      // Sin almacenamiento de sesión: se continúa de todos modos.
    }
    setMostrarAvisoInvitado(false);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-100 p-4">
      <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <h2 className="text-2xl font-bold text-center mb-6 tracking-tight text-white">Iniciar Sesión</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5 uppercase tracking-wider">Correo Electrónico</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                value={form.email}
                autoComplete="email"
                placeholder="Correo electrónico"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-sky-500 transition"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-gray-300 uppercase tracking-wider">Contraseña</label>
              <Link href="/recuperar" className="text-xs text-sky-400 hover:underline">¿Olvidaste tu contraseña?</Link>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock size={18} />
              </span>
              <input
                type={verPassword ? "text" : "password"}
                required
                value={form.password}
                autoComplete="current-password"
                placeholder="Contraseña"
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-11 py-2.5 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-sky-500 transition"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setVerPassword((v) => !v)}
                title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={verPassword}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-100 transition"
              >
                {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              role="switch"
              aria-checked={recordarme}
              onClick={() => setRecordarme((v) => !v)}
              className="group flex items-center gap-2.5 cursor-pointer"
            >
              <span
                aria-hidden="true"
                className={`relative inline-flex w-10 shrink-0 items-center rounded-full border transition-colors duration-200 ${
                  recordarme ? "bg-sky-600 border-sky-500" : "bg-gray-800 border-gray-700 group-hover:border-gray-600"
                }`}
                style={{ height: "1.375rem" }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                    recordarme ? "translate-x-[1.125rem]" : "translate-x-0.5"
                  }`}
                />
              </span>
              <span className="text-xs text-gray-400 group-hover:text-gray-200 transition">Recordarme</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-sky-600/20 text-sm mt-2 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Iniciar Sesión"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-gray-900 px-3 text-gray-400 font-medium">O continúa con</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="bg-gray-950 hover:bg-gray-800 border border-gray-800 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition text-gray-200"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Google
          </button>
          <button
            onClick={() => signIn("github", { callbackUrl: "/" })}
            className="bg-gray-950 hover:bg-gray-800 border border-gray-800 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition text-gray-200"
          >
            <svg className="w-4 h-4 fill-current text-gray-200" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        <button
          onClick={() => setMostrarAvisoInvitado(true)}
          className="w-full mt-3 bg-gray-950 hover:bg-gray-800 border border-dashed border-gray-700 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition text-gray-300"
        >
          <UserRound size={16} className="text-gray-400" />
          Continuar como invitado
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="text-sky-400 hover:underline font-medium">
            Regístrate aquí
          </Link>
        </p>
      </div>

      {mostrarAvisoInvitado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="aviso-invitado-titulo"
          onClick={() => setMostrarAvisoInvitado(false)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-2 text-amber-300">
                <TriangleAlert size={20} />
                <strong id="aviso-invitado-titulo" className="text-sm font-semibold text-white">
                  Entrar como invitado
                </strong>
              </span>
              <button
                onClick={() => setMostrarAvisoInvitado(false)}
                aria-label="Cerrar aviso"
                className="text-gray-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Al cerrar la ventana del navegador, esta sesión de invitado <strong className="text-white">se perderá por completo</strong> y
              ninguno de tus datos se guardará en la base de datos.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMostrarAvisoInvitado(false)}
                className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={entrarComoInvitado}
                className="rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-sky-500 transition"
              >
                Entendido, entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
