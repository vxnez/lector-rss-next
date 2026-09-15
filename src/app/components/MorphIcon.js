// src/app/components/MorphIcon.js — Wrapper de morphicons con la política
// del sistema de diseño: spring rápido para toggles + respeto a movimiento
// reducido del SO y del ajuste propio de la app (lector_movimiento).
// Uso: <MorphIcon icon={activo ? IconoB : IconoA} size={18} />
// Los iconos se importan como DATOS desde "lucide", no como componentes.
"use client";

import { MorphIcon as BaseMorphIcon } from "morphicons/react";

// Movimiento reducido de la app (lector_movimiento=reducido): salta al
// destino sin animar. Se lee en cada render para reaccionar en vivo al ajuste;
// "user" delega en prefers-reduced-motion del SO.
function politicaMovimiento() {
  try {
    if (
      typeof document !== "undefined" &&
      document.documentElement.dataset.motion === "reduced"
    ) {
      return "always";
    }
  } catch {
    // Sin DOM disponible (SSR): se conserva la política del SO.
  }
  return "user";
}

export default function MorphIcon({
  icon,
  spring = "snappy",
  size = 18,
  strokeWidth = 2,
  ...rest
}) {
  return (
    <BaseMorphIcon
      icon={icon}
      spring={spring}
      size={size}
      strokeWidth={strokeWidth}
      reducedMotion={politicaMovimiento()}
      aria-hidden={rest.label ? undefined : true}
      {...rest}
    />
  );
}
