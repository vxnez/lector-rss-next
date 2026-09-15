---
name: morphicons
description: Morphing universal entre iconos stroke (Lucide y otros) con spring physics para toggles binarios de la UI. Usar al animar pares de iconos que cambian por estado (ojo/ojo-off, bookmark/guardado, settings/X, chevron arriba/abajo) en vez de swaps instantáneos.
---

# morphicons en este proyecto

Librería de morphing universal para iconos stroke con física de springs.
Cero dependencias de runtime, ~7 KB gzip, SSR limpio (el servidor emite el
SVG estático exacto, sin flash).

## Instalación (ya hecha)

```bash
npm install morphicons lucide
```

- `morphicons/react` → componente `MorphIcon` (React >= 18, peer opcional).
- `lucide` (vanilla, **misma versión que `lucide-react`**) → iconos como
  **datos** (`IconNode`), NO como componentes. `lucide-react` sigue usándose
  para iconos estáticos; ambos paquetes coexisten y hacen tree-shake.
- No actualizar `lucide` sin alinear `lucide-react` (y viceversa): los paths
  a morphez deben ser idénticos a los renderizados en estático.

## Regla de oro del proyecto

**Nunca importar `MorphIcon` de `morphicons/react` directamente en vistas.**
Usar siempre el wrapper `src/app/components/MorphIcon.js`, que fija la
política del sistema de diseño:

- `spring="snappy"` (toggles frecuentes, < 300 ms, curva Emil).
- `reducedMotion`: honra `prefers-reduced-motion` del SO **y** el ajuste
  `lector_movimiento=reducido` de la app (salta al destino sin animar).
- `size` / `strokeWidth` con los mismos defaults que lucide-react.

```jsx
import MorphIcon from "./components/MorphIcon";
import { Eye, EyeOff } from "lucide"; // datos, no componentes

<button onClick={() => setVer((v) => !v)} aria-pressed={ver}>
  <MorphIcon icon={ver ? EyeOff : Eye} size={18} />
</button>
```

## Cuándo morph vs. icono estático

| Caso | Decisión |
| --- | --- |
| Toggle binario visible (ojo, bookmark, settings/X, chevron colapsable) | Morph (`icon={a ? B : A}`) |
| Icono decorativo o de un solo estado | `lucide-react` estático |
| Spinner / loading | `animate-spin` existente, sin morph |
| Iconos dentro de `lucide-react` ya importados como componentes | No pasar componentes a `MorphIcon`; importar el dato desde `lucide` |

## Pares oficializados en la app

- `Eye` ↔ `EyeOff` (ver contraseña, mostrar/ocultar imagen del lector)
- `Bookmark` ↔ `BookmarkCheck` (guardar noticia, tarjeta y lector)
- `Settings` ↔ `X` (botón flotante del panel móvil)
- `ChevronDown` ↔ `ChevronUp` (colapsables Controles y Filtros)

## API esencial (modo no controlado, 90% de usos)

```jsx
<MorphIcon icon={abierto ? X : Menu} spring="snappy" />
```

- Cambiar la prop `icon` y el morph ocurre (springs interrumpibles).
- Modo controlado (`from`/`to`/`progress`) solo para gestos/scroll: no usar
  para toggles simples.
- `label` → `role="img"` + `<title>`; sin `label` → `aria-hidden`
  (el botón padre ya lleva `aria-label`/`aria-pressed`).
- Accesibilidad de movimiento: nunca `reducedMotion="never"` en UI.

## Referencia canónica

- https://www.morphicons.com/llms.txt (quickstart + API)
- https://www.morphicons.com/llms-full.txt (README completo)
