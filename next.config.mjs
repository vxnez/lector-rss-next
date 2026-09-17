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
