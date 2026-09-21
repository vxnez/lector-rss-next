# CONTEXTO FRONTEND — lector-rss-next
> **REGLA DE PROPIEDAD (sin excepción):**
> Todo lo descrito en este archivo lo hace la **IA Frontend** (este
> dispositivo), repo `lector-rss-next` (Next.js 16 + React 19, Vercel).
> La **IA Backend** (otro dispositivo, `~/proyectos/servxn-api` + MySQL
> `lector_rss_db`) es dueña exclusiva del servidor, UFW, `x-api-key`, esquema
> y datos. La IA Frontend **JAMÁS** escribe en el backend: ni código, ni UFW,
> ni claves, ni DDL, ni datos por ninguna vía distinta a la API documentada
> en §3. Solo **lee** el archivo CONTEXTO_BACKEND como referencia.
> Ante cualquier fricción, el contrato de ESTE archivo manda del lado frontend.

Fecha de última actualización: 2026-09-20.
Dueño del archivo: IA Frontend. Leerlo al iniciar cada sesión del proyecto.

---

## 1. Arquitectura y límites inviolables

- `Vercel (este repo) → HTTPS → API servxn → MySQL LAN`. Cero `mysql2`,
  cero `DATABASE_URL`, cero credenciales MySQL en este código.
- `src/lib/api.js` es la **única** vía de datos (server-only; lanza si se
  importa desde `"use client"`). Auth con header `x-api-key` desde
  `API_URL` + `API_SECRET_KEY` (solo servidor/Vercel, jamás al cliente).
- `GET /api/health` es el único endpoint backend sin key.
- Comparaciones numéricas: `usuario_id`/`id`/`fuente_id` llegan como string
  del backend — normalizar a `Number` antes de comparar o filtrar.
- Presupuesto Vercel: 60 s por función. Llamadas al backend con timeout
  propio 30 s (lecturas) / 55 s (refresh); reintento solo en GET o ante 429
  (429 = no procesado). Respetar `Retry-After`.
- Convenciones de nombres: el backend habla `snake_case`; este frontend
  mapea a `camelCase` en `rss/route` (`fuentes_sin_cambios` →
  `fuentesSinCambios`). **No unificar por cuenta propia.**

## 2. Mapa de propiedad frontend (qué vive aquí)

- Rutas `/api/*` (Route Handlers, delgados, sin SQL): `rss` (feed, alta con
  descubrimiento local, refresh delegado, clasificación por lotes),
  `sources` (CRUD + borrado masivo con repliegue), `datos` (exportar RGPD +
  borrado de cuenta en cascada previa), `perfil`, `actividad`, `push`
  (VAPID subscribe/unsubscribe), `bienvenida`, `cron/refresh` (Vercel Cron →
  delega por usuario), `auth/*` (NextAuth, registro, invitado, recuperar),
  `icon`, `recommended-feeds`, `repo`.
- `src/lib/`: `api.js` (wrapper + reintentos + caché 45 s de usuarios),
  `clasificadorIA.js` (pipeline Gemini/Groq, catálogo cerrado, umbral 80%,
  few-shot, keyword fallback), `keywordFallback.js` (sin dependencias),
  `categoryClassifier.js` (catálogo de 25, única fuente), `webToRss.js`
  (fallback de conversión SOLO al dar de alta sin feed nativo; el refresh
  es del backend), `fetchCache.js` (dedupe+TTL+SWR client-side), `push.js`
  (envío VAPID), `temas.js` + `themes.css` + `globals.css` (8 temas),
  `i18n.js` (solo español), resto utilidades.
- Componentes/páginas: dashboard, lector modal, modales (fuentes, ajustes,
  onboarding, perfil), login/register/recuperar, not-found.
- Despliegue Vercel + `vercel.json` (cron diario). CI: build + lint.

## 3. Contratos consumidos (verificados; no renegociar sin acuerdo)

- Usuarios: `GET /api/users?email=` filtrado en SQL; CRUD por id; borrado
  **duro** + re-alta <10 s; `proveedor` CSV al vincular OAuth.
- Fuentes: CRUD con `usuario_id` por query **y** body; `409` duplicada;
  `PATCH` acepta `convert_full_page` (+ alias); `DELETE` atómico
  (`200 {ok,...}` / `404 {not_found,faltan}` / `500 {db_error,code}`);
  bulk `DELETE ?usuario_id=&ids=` todo-o-nada con repliegue local al loop.
- Artículos: `GET` con `total` sin paginar + `fuente_id/categoria/leido/
  guardado/order/dir/q`; `PATCH` persiste `categoria/metodo/confianza/
  leido/guardado/descartado` (+ aliases) y devuelve la fila; `descartado=1`
  excluido por defecto; `stats` coherente con listados.
- Refresh: `POST|GET /api/data/refresh {usuario_id,fuente_id?}` →
  `{fuentes,nuevos,omitidas,actualizadas,fuentes_sin_cambios,reparados,
  pendientes,detalle[]}`. `omitidas` = ARTÍCULOS; `fuentes_sin_cambios` =
  FUENTES (no intercambiar: causó el "130 vs 10"). `pendientes` alimenta
  la cola IA.
- Push: `GET|POST|DELETE /api/push/subscriptions` (acepta query o body).
- Recover con anti-enumeración, códigos 6 dígitos, 15 min, bloqueo a los
  5 intentos.

## 4. Reparto de clasificación (no pisarse)

- Backend **siembra** al ingerir (`local` + confianza real; `manual` por
  PATCH). Frontend **pule** por lotes (12–24, hasta 24/12 intentos,
  `excluir` por corrida, `reintentarEn`): retoma `sin-ia` y `General`/nulo
  de cualquier método salvo `manual`; `local`/`gemini`/`groq` con categoría
  real NO se reprocesan; veredictos propios <80% se retoman.
- Regla de oro: el frontend nunca persiste fuera del catálogo de 25 ni
  sobrescribe `manual`; `metodo` = proveedor real (`gemini`/`groq`), nunca
  hardcodeado. Keyword fallback (≥2 hits, empate = nada, jamás General)
  solo rescata fallos/tibios al piso 0.8.
- Auto-disparos silenciosos: login (1×/cuenta), alta, bienvenida, refresh
  con `nuevos>0`, import OPML. Tarjeta de progreso con `min(procesadas,
  total)` y corte en `lote===0`.

## 5. Convenciones UI propias (no "corregir" sin acuerdo)

- 8 temas con identidad fija; profundidad solo con filetes (cero orbes,
  glows, spotlights, bezels dobles, pills eyebrow). Tokens `app-*`;
  grises/sky remapeados por tema en `themes.css`.
- Insignias de categoría por hash con variantes CSS claro/oscuro
  (`.cat-pill` + `getCategoryVars`); texto AA en ambos.
- Optimismo con reversión: guardado excluye en vista sin refetch (el
  listado aún no refleja `guardado`); borrado masivo cera la pestaña
  activa; toggles restauran backup al fallar. Contadores solo vía refetch.
- Caché usuarios 45 s + `force:true` en escrituras; invalidar id+email al
  borrar cuenta (anti-fantasma). `getUserByEmail` sin filtro completo de
  respaldo si hay 429.

## 6. Verificación (solo lectura al backend)

- `npm run lint` (cero warnings), `npm run build`, `node --check` en
  `.js` no-JSX. Sondas solo a endpoints documentados, con IDs
  inexistentes o lecturas propias; jamás mutar datos reales para probar.
- Commits `tipo(alcance): ...` en español, push a `origin/main` solo a
  petición. Historial propio observable por backend en `git log`.

## 7. Historial frontend (para no re-trabajar)

- 2026-09-19/20 — Migración a API interna; borrado cuenta/fuentes con
  cascada previa; reintentos+caché anti-429; timeouts; paginado sin total;
  conteos por fuente; refresh real + VAPID; IA por lotes resucitada;
  `local`/`groq` como clasificados; auto-triggers; `General` como
  pendiente; dedup por corrida; umbral 80% + few-shot + keywords;
  rediseño anti-slop 8 temas; badges por CSS.
- Commits de referencia: `e46171b, 2bd58ae, d0cb786, 96c8609, 32c90aa,
  fac7784, 9a466d1, a07c777, 6ea1e03, bf44120, 0670a44, f27af7d, 765cece`.
