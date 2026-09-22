// src/app/register/page.js
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, User } from "lucide-react";
import { Eye as EyeData, EyeOff as EyeOffData } from "lucide";
import MorphIcon from "../components/MorphIcon";
import { signIn } from "next-auth/react";
import { restablecerAjustesLocales } from "@/lib/ajustesPorDefecto";
import { useIdioma } from "@/lib/i18n";

export default function RegisterPage() {
  const { t } = useIdioma();
  const [form, setForm] = useState({ nombre: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("register.err_registro"));

      // Cuenta nueva = perfil limpio: si el navegador guardaba ajustes
      // huérfanos de una cuenta eliminada antes (mismo dispositivo),
      // se restablecen a los valores por defecto del sistema.
      restablecerAjustesLocales();
      router.push("/login?registered=true");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-ambient min-h-screen flex items-center justify-center bg-app-bg text-app-fg p-4">
      <div className="bezel-outer w-full max-w-md stagger-in relative z-10">
        <div className="bezel-inner p-8 shadow-2xl">
          <p className="eyebrow mx-auto flex w-fit">RSS Dashboard</p>
          <h2 className="text-balance text-2xl font-bold text-center mt-3 mb-6 tracking-tighter text-app-fg">{t("register.titulo")}</h2>
        
          {error && (
            <div className="anim-toast bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-app-muted mb-1.5 uppercase tracking-wider">{t("register.nombre")}</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                placeholder={t("register.nombre_ph")}
                className="field-focus w-full bg-app-bg border border-app-line rounded-xl pl-10 pr-4 py-2.5 text-app-fg text-sm placeholder:text-app-muted focus:outline-none"
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-app-muted mb-1.5 uppercase tracking-wider">{t("register.correo")}</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted">
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                placeholder={t("register.correo_ph")}
                className="field-focus w-full bg-app-bg border border-app-line rounded-xl pl-10 pr-4 py-2.5 text-app-fg text-sm placeholder:text-app-muted focus:outline-none"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-app-muted mb-1.5 uppercase tracking-wider">{t("register.password")}</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted">
                <Lock size={18} />
              </span>
              <input
                type={verPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                className="field-focus w-full bg-app-bg border border-app-line rounded-xl pl-10 pr-11 py-2.5 text-app-fg text-sm placeholder:text-app-muted focus:outline-none"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setVerPassword((visible) => !visible)}
                title={verPassword ? t("login.ocultar") : t("login.mostrar")}
                aria-label={verPassword ? t("login.ocultar") : t("login.mostrar")}
                aria-pressed={verPassword}
                className="btn-press absolute inset-y-0 right-0 flex items-center pr-3 text-app-muted hover:text-app-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                <MorphIcon icon={verPassword ? EyeOffData : EyeData} size={18} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-press group w-full bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium py-2.5 rounded-full transition hover:shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--accent)_70%,transparent)] text-sm mt-2 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? t("register.registrando") : t("register.registrarse")}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-app-line"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-app-surface px-3 text-app-muted font-medium">{t("register.o_registrate")}</span></div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => signIn("google", { callbackUrl: "/" })} 
            className="btn-press card-lift bg-app-raised/60 hover:bg-app-raised border border-app-line py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 text-app-fg"
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
            className="btn-press card-lift bg-app-raised/60 hover:bg-app-raised border border-app-line py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 text-app-fg"
          >
            <svg className="w-4 h-4 fill-current text-app-fg" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            GitHub
          </button>
        </div>

        <p className="text-center text-xs text-app-muted mt-6">
          {t("register.tienes")}{" "}
          <Link href="/login" className="text-[var(--accent)] hover:underline font-medium">
            {t("register.entra")}
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}