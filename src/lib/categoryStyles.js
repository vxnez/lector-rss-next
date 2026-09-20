const PALETTE = [
  [195, 78, 52],
  [225, 78, 54],
  [155, 62, 55],
  [285, 62, 58],
  [35, 78, 54],
  [75, 58, 50],
  [115, 52, 48],
  [145, 55, 48],
  [175, 64, 50],
  [255, 62, 58],
  [320, 62, 56],
  [10, 68, 54],
];

function hash(texto = "") {
  return [...texto].reduce((total, caracter) => ((total << 5) - total) + caracter.charCodeAt(0), 0);
}

function esTemaClaro() {
  try {
    return document.documentElement.dataset.temaClaro === "1";
  } catch {
    return false;
  }
}

function paleta(hue, saturation, lightness, claro) {
  if (claro) {
    return {
      fondo: `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 12, 30)}%, 0.22)`,
      texto: `hsl(${hue}, ${Math.min(saturation + 10, 95)}%, ${Math.max(lightness - 36, 22)}%)`,
      borde: `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 20, 35)}%, 0.55)`,
    };
  }
  return {
    fondo: `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 25, 18)}%, 0.28)`,
    texto: `hsl(${hue}, ${Math.min(saturation + 8, 90)}%, ${Math.min(lightness + 28, 86)}%)`,
    borde: `hsla(${hue}, ${saturation}%, ${Math.min(lightness + 8, 70)}%, 0.5)`,
  };
}

export function getCategoryStyle(category = "General") {
  const [hue, saturation, lightness] = PALETTE[Math.abs(hash(category)) % PALETTE.length];
  // Compatibilidad: variante según tema actual (los badges nuevos usan
  // getCategoryVars, que no depende del momento del render).
  if (esTemaClaro()) {
    const v = paleta(hue, saturation, lightness, true);
    return { backgroundColor: v.fondo, color: v.texto, borderColor: v.borde };
  }
  const v = paleta(hue, saturation, lightness, false);
  return { backgroundColor: v.fondo, color: v.texto, borderColor: v.borde };
}

// Variantes claro/oscuro como variables CSS: la resolución al tema la hace
// CSS ([data-tema-claro]), no JS en render — así el badge es legible desde el
// primer pintado en los 8 temas.
export function getCategoryVars(category = "General") {
  const [hue, saturation, lightness] = PALETTE[Math.abs(hash(category)) % PALETTE.length];
  const o = paleta(hue, saturation, lightness, false);
  const c = paleta(hue, saturation, lightness, true);
  return {
    "--cat-bg-d": o.fondo,
    "--cat-fg-d": o.texto,
    "--cat-bd-d": o.borde,
    "--cat-bg-l": c.fondo,
    "--cat-fg-l": c.texto,
    "--cat-bd-l": c.borde,
  };
}

export function getCategoryInitial(category = "General") {
  return category.trim().charAt(0).toUpperCase() || "G";
}
