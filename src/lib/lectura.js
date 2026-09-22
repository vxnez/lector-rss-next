// src/lib/lectura.js — Utilidades del lector de noticias (cliente y servidor).

// Minutos estimados de lectura a ~200 palabras por minuto (mínimo 1).
export function tiempoLecturaMinutos(...textos) {
  const palabras = textos
    .filter(Boolean)
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(palabras / 200));
}

const STOP_EN = new Set(
  "the and of to in is you that it was for on are as with they be at one have this from or had by not but what all were we when your can there use an each which she do how their will would there their than then them these her him".split(
    " "
  )
);
const STOP_ES = new Set(
  "el la de que en y los del las una por con para como mas pero sus este esta son entre cuando todo ser tiene donde muy sin sobre tambien hay".split(
    " "
  )
);

// Detecta el idioma del texto ("en"|"es") por stopwords para que el TTS
// locute en el idioma de la noticia (p. ej. traducida EN→ES) y no en el de
// la app. Empate o texto corto = español (idioma de la interfaz).
export function detectarIdiomaTexto(...textos) {
  const palabras = textos
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-záéíóúñü\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (palabras.length === 0) return "es";
  let en = 0;
  let es = 0;
  for (const p of palabras) {
    if (STOP_EN.has(p)) en += 1;
    if (STOP_ES.has(p)) es += 1;
  }
  return en > es ? "en" : "es";
}
