/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raíz explícita: evita que Turbopack tome C:\Users\Ivan Fuentes
  // (hay un package-lock.json extraviado ahí) y cargue otro .env.
  turbopack: {
    root: "C:/Users/Ivan Fuentes/Documents/UNIVERSIDAD/SEPTIMO SEMESTRE/MATERIAS/PROGRAMACION WEB - ROBERTO/lector_rss_db/lector-rss-next",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Anti-clickjacking: solo este origen puede enmarcar la app.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
