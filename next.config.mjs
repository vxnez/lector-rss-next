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
    const isDev = process.env.NODE_ENV === "development";

    // CSP actual (compatible con Next.js 16 inline scripts/styles)
    // En desarrollo: añade 'unsafe-eval' para React 19 (eval() en dev para callstacks)
    const scriptSrcDev = isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'";
    const csp = [
      "default-src 'self'",
      scriptSrcDev,
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

    // CSP Report-Only: versión objetivo para endurecer (sin unsafe-inline, sin unsafe-eval)
    // Se monitoriza en Vercel Logs / Reporting API antes de activar.
    const cspReportOnly = [
      "default-src 'self'",
      "script-src 'self'", // sin 'unsafe-inline' — requiere nonces/hashes
      "style-src 'self'", // sin 'unsafe-inline' — requiere nonces/hashes
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
      "report-uri /api/csp-report", // endpoint para recibir reportes
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          // Anti-clickjacking: solo este origen puede enmarcar la app.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: csp },
          // CSP Report-Only para validar política estricta sin romper la app
          { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
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
            value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
          },
          // Defensa en profundidad
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
