import { Geist, Geist_Mono } from "next/font/google";
import { IdiomaProvider } from "@/lib/i18n";
import "./globals.css";
import "./themes.css";

// El script de tema/densidad/movimiento se inyecta imperativamente
// desde page.js vía useLayoutEffect (evita la advertencia de
// <script> dentro de componentes React en Turbopack).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "RSS Dashboard — Lector RSS",
  description: "Organiza, clasifica y lee tus fuentes RSS en un solo dashboard.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "RSS Dashboard",
    statusBarStyle: "black-translucent",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  // Fallback oscuro; aplicarTema() lo actualiza por tema (claros incluidos).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e6e7da" },
    { media: "(prefers-color-scheme: dark)", color: "#070b12" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <IdiomaProvider>{children}</IdiomaProvider>
      </body>
    </html>
  );
}
