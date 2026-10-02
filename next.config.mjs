/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Los feeds apuntan a cualquier host: se permite remoto global y se
    // sirve AVIF/WebP con caché. Si un CDN bloquea al optimizador, el
    // reader reintenta con <img> directo al origen (sinOptimizar).
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    // CSP conservadora pero completa: OAuth (redirects top-level) y el
    // Service Worker son mismo-origen; las imágenes de feeds pueden venir
    // de cualquier host (el lector las pinta directo al origen).
    // Sin 'unsafe-eval' (producción no lo necesita).
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' http: https: data: blob:",
      "media-src 'self' http: https: blob: data:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          // Anti-clickjacking: solo este origen puede enmarcar la app.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // HSTS: los navegadores la ignoran en http://localhost (dev local
          // intacto) y la aplican en el despliegue HTTPS de Vercel.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
