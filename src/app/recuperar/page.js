// src/app/recuperar/page.js
// Recuperación de contraseña en 3 pasos: correo -> código de verificación -> nueva contraseña.
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, Lock, CheckCircle2, ShieldCheck } from "lucide-react";
import { Eye as EyeData, EyeOff as EyeOffData } from "lucide";
import MorphIcon from "../components/MorphIcon";
import { useIdioma } from "@/lib/i18n";

export default function RecuperarPage() {
  const { t } = useIdioma();
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
      if (!res.ok) throw new Error(data.error || t("recuperar.err_codigo"));
      if (data.codigo) {
        setCodigoDemo(data.codigo);
        setMensaje(t("recuperar.codigo_generado", { n: data.expiraMinutos || 15 }));
      } else {
        setCodigoDemo("");
        setMensaje(data.mensaje || t("recuperar.codigo_generico"));
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
      if (!res.ok) throw new Error(data.error || t("recuperar.err_verificar"));
      setPaso(3);
      setMensaje(t("recuperar.codigo_verificado"));
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
      setError(t("recuperar.err_coinciden"));
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
      if (!res.ok) throw new Error(data.error || t("recuperar.err_restablecer"));
      setMensaje(t("recuperar.restablecido_ok"));
      window.setTimeout(() => router.push("/login"), 1800);
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
          <div className="flex items-center justify-center gap-2 mb-2 text-[var(--accent)]">
            <ShieldCheck size={22} />
          </div>
          <h2 className="text-balance text-2xl font-bold text-center tracking-tighter text-app-fg">{t("recuperar.titulo")}</h2>
        <p className="text-center text-xs text-app-muted mt-1 mb-6">
          {t("recuperar.paso", { n: paso, etapa: paso === 1 ? t("recuperar.etapa1") : paso === 2 ? t("recuperar.etapa2") : t("recuperar.etapa3") })}
        </p>

        <div className="flex items-center gap-1.5 mb-6" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-1.5 flex-1 rounded-full overflow-hidden bg-app-raised"
            >
              <div
                className={`step-fill h-full w-full rounded-full ${n <= paso ? "bg-[var(--accent-strong)]" : "bg-transparent scale-x-0"}`}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="anim-toast bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="anim-toast bg-emerald-500/10 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl mb-4 text-sm">
            {mensaje}
          </div>
        )}

        {paso === 1 && (
          <form onSubmit={solicitarCodigo} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-app-muted mb-1.5 uppercase tracking-wider">
                {t("recuperar.correo")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted">
                  <Mail size={18} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  autoComplete="email"
                  placeholder={t("recuperar.correo_ph")}
                  className="field-focus w-full bg-app-bg border border-app-line rounded-xl pl-10 pr-4 py-2.5 text-app-fg text-sm placeholder:text-app-muted focus:outline-none"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-press group w-full bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium py-2.5 rounded-full transition hover:shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--accent)_70%,transparent)] text-sm disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? t("recuperar.generando") : t("recuperar.generar")}
            </button>
          </form>
        )}

        {paso === 2 && (
          <form onSubmit={verificarCodigo} className="space-y-4">
            {codigoDemo && (
              <div className="bg-sky-500/10 border border-dashed border-sky-500/50 rounded-xl p-3 text-center">
                <p className="text-[11px] text-gray-400 mb-1">
                  {t("recuperar.demo")}
                </p>
                <p className="text-2xl font-bold tracking-[0.35em] text-sky-300">{codigoDemo}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-app-muted mb-1.5 uppercase tracking-wider">
                {t("recuperar.codigo")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted">
                  <KeyRound size={18} />
                </span>
                <input
                  type="text"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={codigo}
                  autoComplete="one-time-code"
                  placeholder={t("recuperar.codigo_ph")}
                  className="field-focus w-full bg-app-bg border border-app-line rounded-xl pl-10 pr-4 py-2.5 text-app-fg text-sm placeholder:text-app-muted tracking-[0.3em] focus:outline-none"
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium py-2.5 rounded-full transition hover:shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--accent)_70%,transparent)] text-sm disabled:opacity-60"
            >
              {loading ? t("recuperar.verificando") : t("recuperar.verificar")}
            </button>
            <button
              type="button"
              onClick={() => setPaso(1)}
              className="w-full text-xs text-app-muted hover:text-app-fg transition"
            >
              {t("recuperar.nuevo_codigo")}
            </button>
          </form>
        )}

        {paso === 3 && (
          <form onSubmit={restablecerPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-app-muted mb-1.5 uppercase tracking-wider">
                {t("recuperar.nueva")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted">
                  <Lock size={18} />
                </span>
                <input
                  type={verPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  autoComplete="new-password"
                  placeholder={t("recuperar.nueva_ph")}
                  className="field-focus w-full bg-app-bg border border-app-line rounded-xl pl-10 pr-11 py-2.5 text-app-fg text-sm placeholder:text-app-muted focus:outline-none"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  title={verPassword ? t("login.ocultar") : t("login.mostrar")}
                  aria-label={verPassword ? t("login.ocultar") : t("login.mostrar")}
                  className="btn-press absolute inset-y-0 right-0 pr-3 flex items-center text-app-muted hover:text-app-fg"
                >
                  <MorphIcon icon={verPassword ? EyeOffData : EyeData} size={18} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-app-muted mb-1.5 uppercase tracking-wider">
                {t("recuperar.confirmar")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-app-muted">
                  <CheckCircle2 size={18} />
                </span>
                <input
                  type={verPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmar}
                  autoComplete="new-password"
                  placeholder={t("recuperar.confirmar_ph")}
                  className="field-focus w-full bg-app-bg border border-app-line rounded-xl pl-10 pr-4 py-2.5 text-app-fg text-sm placeholder:text-app-muted focus:outline-none"
                  onChange={(e) => setConfirmar(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-press w-full bg-[var(--accent-strong)] hover:opacity-90 text-[var(--on-accent-strong)] font-medium py-2.5 rounded-full transition hover:shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--accent)_70%,transparent)] text-sm disabled:opacity-60"
            >
              {loading ? t("recuperar.guardando") : t("recuperar.restablecer")}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-app-muted mt-6">
          <Link href="/login" className="text-[var(--accent)] hover:underline font-medium inline-flex items-center gap-1">
            {t("recuperar.volver")}
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}
