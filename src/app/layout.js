import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./themes.css";

// Aplica el tema guardado antes del primer pintado (evita parpadeo).
// Debe coincidir con src/lib/temas.js (IDs y flag de tema claro).
const SCRIPT_TEMA_INICIAL = `(function(){try{var t=localStorage.getItem("lector_tema")||"medianoche";var claros={"celeste":1,"menta":1,"celadon":1};document.documentElement.dataset.theme=t;if(claros[t]){document.documentElement.dataset.temaClaro="1";}var m=localStorage.getItem("lector_movimiento");if(m==="reducido"){document.documentElement.dataset.motion="reduced";}}catch(e){}})();`;



const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Feed Dashboard",
  description: "Organiza, clasifica y lee tus fuentes RSS en un solo dashboard.",
  manifest: "/manifest.webmanifest",
  icons: {
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
  themeColor: "#070b12",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Script plano y bloqueante (primera etiqueta del body): aplica tema y
            movimiento antes del primer pintado, sin depender del framework. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_INICIAL }} />
        {children}
      </body>
    </html>
  );
}
