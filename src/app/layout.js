import { Geist, Geist_Mono, Momo_Trust_Display, LINE_Seed_JP, Readex_Pro, Cal_Sans, Press_Start_2P } from "next/font/google";
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

// Tipografías seleccionables (Ajustes > Lectura). Momo Trust Display es la
// predeterminada absoluta; las 5 viven como variables para --fuente-app.
const fuenteMomo = Momo_Trust_Display({ variable: "--font-momo", subsets: ["latin"], weight: ["400"] });
const fuenteLine = LINE_Seed_JP({ variable: "--font-line", subsets: ["latin"], weight: ["400", "700"] });
const fuenteReadex = Readex_Pro({ variable: "--font-readex", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fuenteCalSans = Cal_Sans({ variable: "--font-calsans", subsets: ["latin"], weight: ["400"] });
const fuentePressStart = Press_Start_2P({ variable: "--font-pressstart", subsets: ["latin"], weight: ["400"] });

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
      className={`${geistSans.variable} ${geistMono.variable} ${fuenteMomo.variable} ${fuenteLine.variable} ${fuenteReadex.variable} ${fuenteCalSans.variable} ${fuentePressStart.variable} h-full antialiased`}
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
