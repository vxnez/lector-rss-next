// src/app/api/icon/route.js — Proxy de favicons con caché (un dominio, 1 día).
export async function GET(request) {
  const domain = new URL(request.url).searchParams.get("domain") || "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return new Response("Dominio inválido", { status: 400 });
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://www.google.com/s2/favicons?domain=${domain}&sz=64`, {
      signal: controller.signal,
      next: { revalidate: 86400 },
    });
    clearTimeout(timeout);
    if (!res.ok) return new Response("Sin icono", { status: 502 });
    const buf = await res.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "image/png",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Sin icono", { status: 504 });
  }
}
