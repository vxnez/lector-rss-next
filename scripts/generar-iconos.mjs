// scripts/generar-iconos.mjs — Genera los iconos PWA (RSS glyph sobre fondo
// oscuro) sin dependencias: rasteriza el glyph con matemáticas y codifica
// el PNG a mano (zlib de Node + CRC32 propio).
// Uso: node scripts/generar-iconos.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(raiz, { recursive: true });

// --- CRC32 ---
const tablaCrc = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  tablaCrc[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = tablaCrc[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tipo, datos) {
  const t = Buffer.from(tipo, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, datos])));
  return Buffer.concat([len, t, datos, crc]);
}
function encodePNG(w, h, pixeles) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const crudo = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    crudo[y * (w * 4 + 1)] = 0; // filtro None
    pixeles.copy(crudo, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(crudo, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Dibujo ---
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// Cobertura antialiaseada: 1 dentro, 0 fuera, rampa de 1px en el borde.
const cobertura = (distancia, grosor) =>
  clamp01(1 - (Math.abs(distancia) - grosor / 2));

function dibujarIcono(S, { redondeado, escalaGlyph = 1, desplazar = 0 }) {
  const px = Buffer.alloc(S * S * 4);
  // Glyph RSS: punto + dos arcos centrados en el punto (cuarto superior-derecho).
  const cx = S * (0.32 + desplazar);
  const cy = S * (0.7 + desplazar * 0.2);
  const u = S / 100; // unidad
  const rPunto = 6.5 * u * escalaGlyph;
  const r1 = 17 * u * escalaGlyph;
  const r2 = 31 * u * escalaGlyph;
  const grosor = 8 * u * escalaGlyph;
  const radioEsquina = redondeado ? 22 * u : 0;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Fondo con degradado vertical sutil.
      const t = y / S;
      const fr = lerp(0x12, 0x07, t);
      const fg = lerp(0x1e, 0x0b, t);
      const fb = lerp(0x32, 0x12, t);

      let alfaFondo = 1;
      if (redondeado) {
        const ex = Math.min(x, S - 1 - x);
        const ey = Math.min(y, S - 1 - y);
        const dx = Math.max(radioEsquina - ex, 0);
        const dy = Math.max(radioEsquina - ey, 0);
        alfaFondo = clamp01(1 - (Math.hypot(dx, dy) - radioEsquina));
      }

      // Glyph (punto relleno + arcos en el cuarto x>=cx, y<=cy).
      let alfaGlyph = 0;
      const dPunto = Math.hypot(x - cx, y - cy);
      alfaGlyph = Math.max(alfaGlyph, clamp01(1 - (dPunto - rPunto + 0.5)));
      if (x >= cx - 0.5 && y <= cy + 0.5) {
        const d = Math.hypot(x - cx, y - cy);
        alfaGlyph = Math.max(alfaGlyph, cobertura(d - r1, grosor));
        alfaGlyph = Math.max(alfaGlyph, cobertura(d - r2, grosor));
      }

      // Sky #2EA8E8 sobre fondo.
      const gr = 0x2e, gg = 0xa8, gb = 0xe8;
      const a = alfaGlyph * alfaFondo;
      const o = (y * S + x) * 4;
      px[o] = Math.round(lerp(fr, gr, a));
      px[o + 1] = Math.round(lerp(fg, gg, a));
      px[o + 2] = Math.round(lerp(fb, gb, a));
      px[o + 3] = Math.round(alfaFondo * 255);
    }
  }
  return px;
}

const trabajos = [
  ["icon-192.png", 192, { redondeado: true }],
  ["icon-512.png", 512, { redondeado: true }],
  ["icon-512-maskable.png", 512, { redondeado: false, escalaGlyph: 0.78, desplazar: 0.02 }],
  ["apple-touch-icon.png", 180, { redondeado: false }],
];
for (const [nombre, S, opts] of trabajos) {
  writeFileSync(join(raiz, nombre), encodePNG(S, S, dibujarIcono(S, opts)));
  console.log(`OK public/${nombre} (${S}x${S})`);
}
