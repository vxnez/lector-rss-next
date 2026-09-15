import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-ambient flex min-h-screen items-center justify-center bg-app-bg p-4 text-app-fg">
      <div className="bezel-outer w-full max-w-md">
        <div className="bezel-inner space-y-4 p-10 text-center shadow-2xl">
          <p className="eyebrow mx-auto w-fit">Error 404</p>
          <h1 className="text-balance text-2xl font-bold tracking-tighter">
            Esta página no existe
          </h1>
          <p className="text-pretty text-sm leading-relaxed text-app-muted">
            La ruta que buscas fue movida o eliminada. Vuelve al dashboard para
            seguir leyendo tus fuentes.
          </p>
          <Link
            href="/"
            className="btn-press inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent-strong)] px-5 py-2.5 text-sm font-medium text-[var(--on-accent-strong)] hover:opacity-90"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
