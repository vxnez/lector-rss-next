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

export function getCategoryStyle(category = "General") {
  const [hue, saturation, lightness] = PALETTE[Math.abs(hash(category)) % PALETTE.length];
  return {
    backgroundColor: `hsla(${hue}, ${saturation}%, ${Math.max(lightness - 25, 18)}%, 0.28)`,
    color: `hsl(${hue}, ${Math.min(saturation + 8, 90)}%, ${Math.min(lightness + 28, 86)}%)`,
    borderColor: `hsla(${hue}, ${saturation}%, ${Math.min(lightness + 8, 70)}%, 0.5)`,
  };
}

export function getCategoryInitial(category = "General") {
  return category.trim().charAt(0).toUpperCase() || "G";
}
