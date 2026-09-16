import { Geist, Geist_Mono } from "next/font/google";
import { IdiomaProvider } from "@/lib/i18n";
import "./globals.css";
import "./themes.css";

// Aplica tema, densidad y movimiento guardados antes del primer
// pintado (evita parpadeo). Debe coincidir con lib/temas.js. El idioma es
// fijo español (lang="es"); el lector_idioma antiguo se ignora.
const SCRIPT_TEMA_INICIAL = `(function(){try{var t=localStorage.getItem("lector_tema")||"medianoche";var claros={"celeste":1,"menta":1,"celadon":1};document.documentElement.dataset.theme=t;if(claros[t]){document.documentElement.dataset.temaClaro="1";}if(localStorage.getItem("lector_movimiento")==="reducido"){document.documentElement.dataset.motion="reduced";}var d=localStorage.getItem("lector_densidad");if(d==="compacta"){document.documentElement.dataset.densidad="compacta";}document.documentElement.lang="es";}catch(e){}})();`;



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
        {/* Script plano y bloqueante (primera etiqueta del body): aplica tema y
            movimiento antes del primer pintado, sin depender del framework. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <IdiomaProvider>{children}</IdiomaProvider>
      </body>
    </html>
  );
}
