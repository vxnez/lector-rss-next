# CONTEXTO BACKEND — servxn-api (lector_rss_db)

> **REGLA DE PROPIEDAD (sin excepción):**
> Todo lo descrito en este archivo lo hace la **IA Backend** (este dispositivo).
> La **IA Frontend** (otro dispositivo, repo `lector-rss-next`) hace **TODO el
> frontend sin excepción**: componentes, páginas, rutas `/api/*` de Next.js,
> `src/lib/*`, estilos, i18n y despliegue Vercel.
> La IA Frontend **JAMÁS** debe crear, modificar ni "corregir" nada del lado
> backend: ni `~/proyectos/servxn-api/*`, ni UFW, ni `x-api-key`, ni el esquema
> o los datos de MySQL por ninguna vía distinta a la API documentada abajo.
> Ante cualquier fricción, el contrato de este archivo manda.

Fecha de última actualización: 2026-09-21.
Dueño del archivo: IA Backend. La IA Frontend solo lo LEE.

---

## 1. Arquitectura y acceso

- `Vercel (frontend) → HTTPS Caddy → 127.0.0.1:4000 (servxn-api, systemd) → MySQL 127.0.0.1:3306`.
- Base de datos: `lector_rss_db`, MySQL 8.4. Solo la API habla con MySQL.
- Auth interna: header `x-api-key == API_SECRET_KEY` (valor solo en `.env` del
  servidor y en Vercel; **nadie lo rota ni lo expone**).
- Ficheros backend (propiedad exclusiva IA Backend):
  `server.js`, `ingest.js`, `taxonomia.js`, `poda.js`, `migrar-taxonomia.js`,
  `*.sql`, `*.service`, `.env`.

## 2. Esquema (referencia de lectura; el backend no hace DDL en caliente)

- `usuarios(id, nombre, email, password_hash, imagen_url, proveedor, genero, bienvenida_vista, creado_en)`.
- `fuentes_rss(id, usuario_id, titulo, url_feed, categoria, etag, last_modified, ultima_revision, origen['rss'|'web'], convert_full_page[0|1], pagina_origen, creado_en)`.
- `articulos_publicados(id, fuente_id, titulo(500), resumen, url_original(500), fecha_publicacion, creado_en, leido, guardado, descartado, categoria, clasificacion_metodo(20), clasificacion_confianza decimal(4,3), imagen_url, video_url)` (+ `resumen_completo, longitud_resumen` v003 y `fecha_estimada` v004, DDL aplicados 2026-09-21; pre-DDL el código degrada sin romper nada).
  - Unicidad: `(fuente_id, url_original)`. Borrado fuente → CASCADE.
- `usuario_articulos(usuario_id, articulo_id, leido, guardado)` (estado por usuario).
- `notificaciones(id, usuario_id FK CASCADE, tipo ENUM('info','success','error','ia','push'), titulo(120), mensaje TEXT, leida, pinned, creado_en)` + índice `(usuario_id, leida, creado_en)`. DDL aplicado 2026-09-21 (`sql-upgrade-002-notificaciones.sql`); pre-DDL el código degrada (GET `[]`, resto `503`, refresh sin notificaciones).
- `push_subscriptions`, `recuperacion_codigos` (flujos auth/push). `push_subscriptions.activa` (1 = activa, 0 = dada de baja tras 410/404 del push service: no se reintenta; misma migración v002).

## 3. Contratos API (base `https://servxn-mysql.duckdns.org`, siempre `x-api-key`)

- `GET /api/health` → `{ok, db, time}` (pública).
- `GET /api/health/db` → `{ok}` (con key).
- `GET /api/users?email=` → `[{id,nombre,email,...}]` (200 `[]` si no existe).
- `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id` (borrado de cuenta ATÓMICO todo-o-nada en transacción: `recuperacion_codigos` + `notificaciones` explícito + `push_subscriptions` revocadas + usuario con CASCADE para fuentes/artículos) → `200 {ok,notificacionesEliminadas}`, `404 {not_found}` sin tocar nada, `500 {db_error,code}` tras rollback (códigos intactos).
- `POST /api/auth/login|recover/request|recover/verify` (rate-limit estricto).
- `GET /api/data/fuentes?usuario_id=` → fuentes con `articulos_count` (+ columnas `origen`, `convert_full_page`, `pagina_origen`).
- `POST /api/data/fuentes {usuario_id,titulo,url_feed,categoria}` → `201 {id,nuevos,omitidas}` (auto-ingesta; 409 si duplicada).
- `PATCH /api/data/fuentes/:id` (`titulo,url_feed,categoria,convert_full_page`; alias `convertFullPage`; `usuario_id` por query o body) → fila actualizada o 404.
- `DELETE /api/data/fuentes/:id?usuario_id=` → transacción atómica (artículos+fuente): `200 {ok,articulos_eliminados}`, `404 {not_found}`, `500 {db_error,code}` real.
- `DELETE /api/data/fuentes?usuario_id=&ids=1,2` → borrado MASIVO atómico todo-o-nada: `200 {ok,eliminadas,articulos_eliminados}`, `404 {not_found,faltan:[...]}` sin borrar nada, `409` conflicto, `500 {db_error,code}`.
- `GET /api/data/articulos?usuario_id&limit&offset&order&dir&q&categoria&leido&guardado&incluir_descartados` → `{articles,total,limit,offset}` (oculta `descartado=1` salvo opt-in). Estado EFECTIVO por usuario (`COALESCE(usuario_articulos, articulos_publicados)`): el payload devuelve `leido`/`guardado` efectivos (el frontend lee esos, no la base), más alias `leido_ef`/`guardado_ef` (compat) y `leido_base`/`guardado_base` (flag global, depuración). Filtros `leido`/`guardado` usan la misma fuente COALESCE. **Pendientes (`leido=0` sin `guardado` explícito) excluye `guardado_ef=1`**: guardar desde Pendientes saca la fila del listado en el refetch sin parche del cliente. Para ver guardados no leídos, pedir explícito `leido=0&guardado=1`.
- `PATCH /api/data/articulos/:id {usuario_id,categoria?,clasificacion_metodo?,clasificacion_confianza?,leido?,guardado?,descartado?}` (+ alias camelCase) → **200 con la fila actualizada**, 404 si no existe/no pertenece. Sin método/confianza y con categoría ⇒ `manual/1.0`.
- Resúmenes acotados (ingesta en refresh + alta): se guardan truncados a 1200 caracteres con corte en palabra + `…`; `resumen_completo=1` ⇔ TRUNCADO; `longitud_resumen` = longitud ORIGINAL pre-truncado. Longitud máxima efectiva garantizada: 1200 en `GET /api/data/articulos` (tope de ingesta; el lector puede pintar íntegro sin corte en cliente), 8000 en `GET /:id/resumen` re-extraído. `GET /api/data/articulos` (y el `PATCH`, misma fila) exponen ambos sin renombrar nada existente (`stats` sin cambios).
- Resumen Markdown ligero (mismo 1200, corte en límite de BLOQUE nunca a mitad de viñeta): el HTML de los feeds se convierte en ingesta a subset cerrado `##` / `-` / `1.` / `**negrita**` / párrafos (sanitizado una vez: fuera script/iframe/form/img/video/audio, `on*`, `javascript:`, estilos; solo `h2/h3/p/ul/ol/li/strong/em/br`; sin tablas/enlaces/imágenes/HTML crudo; lo no estructurable queda en texto plano). `GET /api/data/articulos/:id/resumen` devuelve el mismo subset: readability (página completa) primero, rescate cheerio después.
- Parseo endurecido (ingesta refresh+alta): contenido `content:encoded → content → description → summary`; fecha `pubDate → published → updated → dc:date → ahora` (`fecha_estimada=1`, columna v004 aplicada y expuesta en GET sin renombres); título (trim, 300, `Sin título`), URL canónica sin `utm_*/fbclid` (guid como respaldo), `fecha_publicacion` UTC ISO; XML inválido → reintento des-prefijado → rescate web; binario → `tipo_incompatible`; vacío → rescate; 401/403/429/5xx sin insistir (código en `detalle[]`/`ingest_error`, `timeout` normalizado). Alta con UA `RSSDashboard/1.0 (+https://lector-rss-next.vercel.app)`, 3 redirects.
- `GET /api/data/articulos/:id/resumen?usuario_id=` → texto completo bajo demanda: fila íntegra ⇒ lo guardado (`{completo:true,obsoleto:false,reextraido:false}`); si no, re-extracción SSRF-safe de `url_original` (timeout 10 s, tope 8000 con corte en límite de bloque, caché en memoria 24 h por `fuente_id+hash(url)`, tope 500) ⇒ `{id,url,resumen,completo,obsoleto,cacheado,reextraido,longitud}`; fallo con respaldo (caché caducada o fila) ⇒ `200 {obsoleto:true}`; sin respaldo ⇒ `404 {not_found}` (también si el id no existe/no pertenece). Nunca tumba el listado.
- `POST|GET /api/data/refresh {usuario_id,fuente_id?}` → `{fuentes,nuevos,omitidas,actualizadas,fuentes_sin_cambios,reparados,pendientes,detalle[]}` donde `detalle[]={fuente_id,nuevos,omitidas,estado[,origen,paginas,error]}`. Fallo aislado por fuente (try/catch propio, timeout 10 s por descarga, presupuestos 45 s crawl): `detalle[]` suma `{fuente_id,fuente:titulo,nuevos:0,omitidas:0,estado:'error',ok:false,error}` sin abortar la corrida; campos nuevos `fuentes_fallidas:[ids]` y `reparadas:[ids]` (cero renombres; `omitidas`=artículos, `fuentes_sin_cambios`=fuentes).
- `GET /api/ia/progreso?usuario_id=` → `{pendientes,en_curso,actualizados_en}` con UNA query COUNT (sin traer artículos; `pendientes` = General/nula no descartada, cola gruesa). `en_curso` es heurística en memoria (PATCH `gemini`/`groq` o refresh con reparación hace <180 s; se pierde al reiniciar). Recomendación al frontend: short-poll ~3 s solo durante corridas; sin WebSockets/SSE/Redis en este despliegue (en VPS propio futuro, BullMQ+Redis+SSE).
- Refresh con concurrencia acotada (máx. 3 fuentes a la vez, cola en memoria dentro del request, sin workers): misma salida que en serie. Frente IA (lo sirve este backend): `PATCH` persiste veredictos y alimenta `en_curso`; lote/inferencia/caché de veredictos/prompt los lleva el frontend en su ruta `clasificar_pendientes` (aquí solo consta el contrato que ya consume: `PATCH` con `categoria/metodo/confianza`).
- `GET /api/data/stats?usuario_id` → `{fuentes,articulos,no_leidos,pendientes,guardadas,leidas}` (misma fuente COALESCE + `descartado=0` que el listado: `guardadas` == total de `GET articulos?guardado=1`, `pendientes` == total de `GET articulos?leido=0`, `leidas` == total de `GET articulos?leido=1`). `no_leidos` es legado (no leídos incluyendo guardados) y se conserva por compat; la badge de Pendientes debe usar `pendientes`.
- `GET|POST|DELETE /api/push/subscriptions`, `POST /api/data/poda`.
- Pre-traducción opcional aditiva (v006, `traduccion.js` + `sql-upgrade-006-traduccion.sql`, DDL con sudo + reinicio): columnas NULL `titulo_es(300)/resumen_es/idioma(2)` (NULL = pendiente, el frontend muestra el original); `GET /api/data/articulos` (y `PATCH`, misma fila) las exponen solo post-DDL. Worker best-effort en proceso (tick 10 s, 15 cola + 15 perezosos con concurrencia 2, 1 llamada HTTP por artículo, tope 3 intentos/id): es→copia sin red; otro→`LIBRETRANSLATE_URL`/translate (timeout 15 s, `LIBRETRANSLATE_KEY` opcional); fallo→NULL y seguir. Encolado en `insertarArticulo` solo si `affectedRows>0` (nunca bloquea refresh/Vercel 60 s). Backfill SQL atómico solo con marcas inequívocas de español (tildes/ñ/¿¡); resto NULL perezoso. Pausa solidaria (v006b): con sesiones interactivas (SSH 2222 / tty) el worker no traduce; al cerrarse todas reanuda solo (`TRAD_SOLO_SIN_SESION=0` lo desactiva).
- Pipeline RETIRADO (frontend 8c87c31 traduce en navegador): kill-switch `TRADUCCION_ACTIVA=1` para reencender (por defecto APAGADO; apagado no encola ni traduce). Columnas `titulo_es/resumen_es/idioma` se CONSERVAN (NULLABLE, DROP futuro solo tras confirmar que ningún cliente las lee) y se siguen exponiendo en el listado (aditivo). Prohibido retomar traducción automática sin acuerdo.
- i18n de interfaz 100% cliente (frontend ES/EN con diccionarios en bundle): no servir diccionarios por API; errores crudos tal cual (futuro opcional: `codigo` estable para mapeo ES/EN).
- Categorías: sin diccionario en backend (decisión; BD/API en español canónico, el frontend traduce en display; catálogo `taxonomia.js`).
- Refresh: timeout 10 s por descarga + try/catch por fuente sin abortar la corrida (`detalle[]` con `estado:'error'`); formas intactas.
- Bulk página completa: `PATCH /api/data/fuentes {ids[], convert_full_page}` todo-o-nada (`{ok, actualizadas, convert_full_page}` / 404 `{not_found, faltan}`), espejo del borrado masivo; avisar al frontend antes de cablearlo. Sin SSG/ISR: dashboard por usuario, prohibido cachear páginas en CDN.
- Huérfanos de notificaciones (cuentas eliminadas sin cascada): `limpiar-huerfanos.sql` para ejecución manual única (solo DML, sin sudo) + job semanal `purgarHuerfanos()` en proceso (primer pase a los 10 min del arranque, luego cada 7 días; logea solo si purga >0). Con `fk_notif_user` CASCADE no debería haber ninguno.
- `GET /api/notifications?usuario_id=` → `[{id,usuario_id,tipo,titulo,mensaje,leida,pinned,creado_en}]` orden `pinned DESC, creado_en DESC, id DESC`, tope 50 (`[]` pre-DDL).
- `POST /api/notifications {usuario_id,titulo,mensaje,tipo?,pinned?}` (`usuario_id` por query o body) → `201` con la fila; `tipo` en `info|success|error|ia|push` (defecto `info`); `400` si falta `titulo`/`mensaje` o `tipo` inválido; `404` si el usuario no existe; `503 {notifications_unavailable}` pre-DDL.
- `PATCH /api/notifications {usuario_id,ids[],leida}` (`usuario_id`/`ids` por query o body) → todo-o-nada: `200 {ok,actualizadas}`, `404 {not_found,faltan}` sin tocar nada, `503` pre-DDL.
- `DELETE /api/notifications?usuario_id=&ids=[&forzar=1]` (`ids`/`forzar` por query o body) → todo-o-nada: `200 {ok,eliminadas}`, `404 {not_found,faltan}` sin borrar nada, `409 {pinned_protegido,ids}` si hay `pinned=1` sin `forzar=1`.
- `POST|GET /api/data/refresh` devuelve además `notificacion_id` (nuevo, sin romper el contrato): id de la `info` "Nuevas noticias" (`{nuevos} nuevas en {fuentes} fuentes`) si `nuevos>0`; si no, el de la `ia` pinned actualizada al cerrar la corrida de clasificación (`IA: {reparados} reparadas, {pendientes} pendientes`); si no, `null`. Las corridas de clasificación del frontend (lotes vía PATCH) siguen siendo cliente hasta que migre a estos endpoints; la pinned `ia` del backend nace del `repararGenerales` dentro del refresh.
- `PATCH /api/push/subscriptions {usuario_id,endpoint,activa}` → `200 {ok,activa}`, `404` si no existe; el emisor marca `activa=0` ante 410/404 del push service en vez de borrar (se conserva la fila; el frontend pinta el estado con `GET`). `GET` devuelve además `activa` (1 por defecto pre-migración). `POST` (re-suscribir) reactiva (`activa=1`).
- 429 con `Retry-After`: el rate-limit global/auth lo envía automático (express-rate-limit v7); `POST /api/auth/recover/verify` bloqueado por intentos responde `429 {too_many_attempts}` con `Retry-After: 900`.

## 4. Motor de ingesta (`ingest.js`, propiedad backend)

- RSS/Atom/JSON-Feed con `etag/last_modified` (304 = sin cambios), timeout 10 s por descarga (presupuesto crawl 45 s intacto), tope 8 MB, validación SSRF (DNS + IP privada/bloqueada, hasta 3 redirects revalidados).
- `convert_full_page=1` **se lee en cada refresh** (activar el flag tras el alta trae el histórico al siguiente refresh; bypass de 304).
  - `url_feed` feed sin `pagina_origen` → pagina el feed (`rel="next"`, `?paged/?page/?p`, `/page/N`, continuación mismo estilo).
  - Con `pagina_origen` o URL HTML → crawl multipágina del listado: `rel="next"`, numerados N+1, botones "Siguiente", sondeo `/page/2/`+`?paged=2`+`?page=2`.
  - Topes: **20 páginas / 100 noticias / 45 s**, pausa de cortesía, dedup por URL, **orden cronológico inverso**.
- Extracción HTML por capas: JSON-LD (con `@graph`), artículo único OG (vetado en listados ≥2 `<article>`), heurística de lista, dedup intra-página.
- `origen='web'` va directo al crawl. Inserción `INSERT IGNORE` (dedupe por fuente+URL).
- **Rescate de pendientes en cada refresh** (`repararGenerales`, tope 100 / 10 con LLM): `categoria='General' OR NULL OR ''` cuenta como pendiente **aunque tenga veredicto**, pero SOLO veredictos propios (`local/sin-ia`); `manual/gemini/groq` del frontend **no se tocan**; solo mejora, nunca degrada.

## 5. Motor de categorización (`taxonomia.js`, propiedad backend)

- Catálogo cerrado (24 nombres, idéntico al frontend; ambos lo llaman "25" por historia — **la lista de §5.1 es la autoridad**).
- Reglas ES/EN por palabras clave: **mínimo 2 coincidencias DISTINTAS** por categoría; **empate en la cima = sin veredicto** → `General`.
- LLM (solo si hay clave en `.env`, hoy NO hay ninguna: todo es local y rápido):
  prompt con descripciones mutuamente excluyentes + 6 few-shot + desempates + JSON estricto `{"categoria","confidence"}` (payload título+resumen);
  **umbral `UMBRAL_CONFIANZA = 0.70`** (acepta y persiste; debajo → respaldo keyword).
- Confianza persistida **real** (`confianzaLocal`: ≥6→0.9, ≥4→0.8, ≥2→0.65, si no 0.5; etiqueta directa 0.9; LLM su `confidence`).
- Valores de `clasificacion_metodo` que el backend emite: `local` (reglas/etiqueta), `groq`/`gemini` (LLM), `manual` (vía PATCH). `sin-ia` solo existe como legado.

### 5.1 Catálogo (único válido en ambos lados)

Política, Economía y Finanzas, Seguridad y Justicia, Tecnología, Developers, Celulares, Computadoras, Videojuegos, Ciencia y Espacio, Salud y Medicina, Fitness y Nutrición, Medio Ambiente, Clima y Meteorología, Deportes, Cultura y Arte, Cine y Series, Música, Gastronomía, Viajes y Turismo, Motor, Educación, Moda y Belleza, Hogar y Vida Diaria, General.

### 5.2 Reparto de clasificación (para no pisarse)

- Backend **siembra** al ingerir (`local` + confianza real; `manual` si el usuario reclasifica vía PATCH).
- Frontend **pule** con su lote (Gemini/Groq): retoma `sin-ia` y `General`/nulo de cualquier método salvo `manual`; `local`/`gemini`/`groq` con categoría real **no se reprocesan**.
- Regla de oro: el backend nunca sobrescribe `manual/gemini/groq`; el frontend nunca persiste categorías fuera del catálogo.

## 6. Convenciones compartidas (no "corregir" sin acuerdo)

- Nombres: el backend habla `snake_case` (`fuentes_sin_cambios`); el frontend mapea a `camelCase` (`fuentesSinCambios`) en su `rss/route`. **No unificar por cuenta propia.**
- `omitidas` = ARTÍCULOS duplicados; `fuentes_sin_cambios` = FUENTES sin novedades. No intercambiarlos en mensajes (causó el "130 vs 10").
- `pendientes` del refresh = `General/NULL` restantes en el alcance (lo consume la cola IA del frontend).
- Poda automática del backend (24 h + 5 min tras arranque): borra `descartado>7d` y `leído-no-guardado>60d`; purga invitados inactivos. Es comportamiento propio, no un bug.

## 7. Historial backend (qué se hizo y cuándo, para no re-trabajar)

- 2026-09-19/20 — Ingesta multipágina + `convert_full_page` por refresh; `PATCH articulos` persiste categoría/método/confianza y devuelve la fila; `DELETE fuentes` transaccional + bulk atómico; `fuentes_sin_cambios` en refresh.
- 2026-09-20 — Extractor HTML: `@graph`, veto de único en listados, dedup, lote inicial con sondeo.- 2026-09-20 — Motor IA: prompt con descripciones+few-shot+`confidence`, umbral 0.70, fallback keyword (min-2/empate), confianza real persistida, `repararGenerales` + `pendientes/reparados` en refresh.
- Frontend de referencia: clonado fresco en cada turno (`/tmp/frontend-ref`); commits suyos observados: `e46171b, 2bd58ae, d0cb786, 96c8609, 32c90aa, fac7784, 9a466d1, 636ff33, dddf1d0, 7a86d5b, dd7d261` (bandeja `NotificationPanel` + hook `useNotificaciones` con localStorage; aún no consume `/api/notifications`).
- 2026-09-21 — Notificaciones persistentes multi-dispositivo: tabla `notificaciones` (migración versionada `sql-upgrade-002-notificaciones.sql`, DDL pendiente de sudo), 4 endpoints todo-o-nada, `notificacion_id` en refresh + upsert de la pinned `ia` al cerrar la corrida, `push_subscriptions.activa` con `PATCH` (410/404 → inactiva, no borrar; `POST` reactiva), 429 con `Retry-After`. DDL aplicado el mismo día y verificado end-to-end en prod (CRUD, orden pinned, 404 con `faltan` + rollback, 409 pinned/`forzar=1`, push activa 1→0→1, refresh con `nuevos=20` → `notificacion_id` + info exacta + pinned `ia`; cero restos).
- 2026-09-21 — Borrado de cuenta atómico: `DELETE /api/users/:id` en transacción (todo-o-nada como el bulk de fuentes) con `notificacionesEliminadas` en el `200 {ok,...}` para auditoría del frontend, revoke de `push_subscriptions` en la misma tx y `fk_notif_user` CASCADE verificado en vivo (red de seguridad); `limpiar-huerfanos.sql` + purga semanal (0 huérfanos; verificado en prod con usuario temporal: cascada total user/notif/push/recover/fuente/artículos).
- 2026-09-21 — Resúmenes acotados + señal de truncado: `sql-upgrade-003-resumenes.sql` (DDL aplicado; re-aplicar da 1060 harmless porque las columnas ya existen — el backfill es lo que importa y es idempotente en filas no procesadas), truncado 1200 con corte en palabra en los 3 caminos de ingesta (clasificación intacta con texto íntegro), `resumen_completo`/`longitud_resumen` en GET/PATCH sin renombres, endpoint on-demand con caché 24h; verificado pre-DDL en prod (unit 10/10, listado y stats intactos, re-extracción viva 3910 chars + caché; cero restos). Post-DDL verificado: 12/12 filas exponen las columnas, truncado real (13413→1145 con marca=1), PATCH incluido.
- 2026-09-21 — Resumen Markdown con jerarquía: `htmlAMarkdown` en ingesta (solo HTML de feeds; crawl-corto sigue plano), corte 1200 en límite de bloque, endpoint con readability+linkedom primero y rescate cheerio; sin HTML crudo en ninguna salida; verificado en prod (unit 15/15 + clasificación estable, dev.to 11/12 con `##`/`-`, 12/12 limpias, endpoint 6206 chars + caché; cero restos). Sin DDL nuevo (v003 lo cubre).
- 2026-09-21 — Parseo endurecido: orden contenido/fecha con `fecha_estimada` (v004 aplicada + reinicio; backfill no-op, todo en 0); URL canónica sin tracking, título 300/`Sin título`, reintento des-prefijado, rescate en vacío, `tipo_incompatible` en binario, terminales sin insistir, UA propia, 3 redirects, timeout 10 s; refresh con `{fuente,ok:false,error}` + `fuentes_fallidas`/`reparadas` (cero renombres); verificado en prod (sondas rss-parser, unit fechas/urls/códigos, refresh con fuentes lenta+401 aisladas y timeout `timeout` en vivo; cero restos).
- 2026-09-21 — Telemetría IA + concurrencia: `GET /api/ia/progreso` (`{pendientes,en_curso,actualizados_en}`, 1 COUNT; `en_curso` heurística 180 s en memoria), refresh cap-3 con misma salida, `PATCH gemini/groq` alimenta actividad; verificado en prod (forma exacta, pendientes 21 tras alta, orden detalle preservado, `en_curso:true` tras PATCH, aislamiento por usuario; cero restos). Decisión tiempo real: short-poll, sin WS/SSE/Redis. Frontend confirma consumo aditivo (lote suma `resultados[]` intacto, proxy de progreso no-store, sondeo sin escribir `total/procesadas`: sin fricción con la heurística).

## 8. Verificación (solo lectura)

- `curl http://127.0.0.1:4000/api/health` (+ `/api/health/db` con key).
- Tests locales sin BD: `/tmp/test-motor.js`, `/tmp/test-20tech.js`, `/tmp/test-reparar.js`.
- Reinicio: `kill <pid node servxn-api>` (systemd lo levanta en ~5 s); jamás `systemctl` sin sudo disponible, jamás UFW.
