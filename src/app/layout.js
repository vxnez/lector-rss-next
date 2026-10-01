import { Geist, Geist_Mono, LINE_Seed_JP, Readex_Pro, Cal_Sans, Plus_Jakarta_Sans, Outfit, Sora, Space_Grotesk, Inter, Be_Vietnam_Pro, Epilogue } from "next/font/google";
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

// Tipografías seleccionables (Ajustes > Lectura). Readex Pro es la
// predeterminada absoluta; las 10 viven como variables para --fuente-app.
const fuenteLine = LINE_Seed_JP({ variable: "--font-line", subsets: ["latin"], weight: ["400", "700"] });
const fuenteReadex = Readex_Pro({ variable: "--font-readex", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fuenteCalSans = Cal_Sans({ variable: "--font-calsans", subsets: ["latin"], weight: ["400"] });
const fuenteJakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fuenteOutfit = Outfit({ variable: "--font-outfit", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fuenteSora = Sora({ variable: "--font-sora", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fuenteGrotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fuenteInter = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fuenteVietnam = Be_Vietnam_Pro({ variable: "--font-vietnam", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const fuenteEpilogue = Epilogue({ variable: "--font-epilogue", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

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
    { media: "(prefers-color-scheme: light)", color: "#f7f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#060b14" },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} ${fuenteLine.variable} ${fuenteReadex.variable} ${fuenteCalSans.variable} ${fuenteJakarta.variable} ${fuenteOutfit.variable} ${fuenteSora.variable} ${fuenteGrotesk.variable} ${fuenteInter.variable} ${fuenteVietnam.variable} ${fuenteEpilogue.variable} h-full antialiased`}
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
