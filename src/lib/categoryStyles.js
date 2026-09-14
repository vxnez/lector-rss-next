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

export function getCategoryStyle(category = "General") {
  const [hue, saturation, lightness] = PALETTE[Math.abs(hash(category)) % PALETTE.length];
  // En temas claros el texto debe oscurecerse para seguir legible.
  if (esTemaClaro()) {
    return {
      backgroundColor: `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 12, 30)}%, 0.22)`,
      color: `hsl(${hue}, ${Math.min(saturation + 10, 95)}%, ${Math.max(lightness - 34, 24)}%)`,
      borderColor: `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 20, 35)}%, 0.55)`,
    };
  }
  return {
    backgroundColor: `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 25, 18)}%, 0.28)`,
    color: `hsl(${hue}, ${Math.min(saturation + 8, 90)}%, ${Math.min(lightness + 28, 86)}%)`,
    borderColor: `hsla(${hue}, ${saturation}%, ${Math.min(lightness + 8, 70)}%, 0.5)`,
  };
}

export function getCategoryInitial(category = "General") {
  return category.trim().charAt(0).toUpperCase() || "G";
}
