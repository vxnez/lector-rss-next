// src/app/api/repo/route.js — Versión viva con caché (evita rate-limit GitHub).
export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      "https://api.github.com/repos/vxnez/lector-rss-next/commits?per_page=1",
      { signal: controller.signal, next: { revalidate: 3600 } }
    );
    clearTimeout(timeout);
    if (!res.ok) return Response.json({ commits: 0 }, { status: 200 });
    const datos = await res.json().catch(() => []);
    const cabecera = res.headers.get("Link") || "";
    const coincidencia = cabecera.match(/[?&]page=(\d+)>;\s*rel="last"/);
    const commits = coincidencia ? Number(coincidencia[1]) : 0;
    const primero = Array.isArray(datos) ? datos[0] : null;
    return Response.json(
      {
        commits,
        mensaje: String(primero?.commit?.message || "").split("\n")[0].slice(0, 80),
        fecha: primero?.commit?.author?.date || null,
      },
      { status: 200 }
    );
  } catch {
    return Response.json({ commits: 0 }, { status: 200 });
  }
}
