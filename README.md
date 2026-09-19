# Lector RSS — Dashboard de feeds con IA

Aplicación web full-stack para centralizar, organizar y leer noticias de fuentes RSS por usuario. Permite registrar feeds, consultar un dashboard de artículos, clasificarlos automáticamente con IA, marcarlos como leídos, guardarlos, descartarlos y administrar las fuentes. Despliegue en Vercel; toda la lectura/escritura de datos pasa por la API interna en `https://servxn-mysql.duckdns.org` (auth con header `x-api-key`). Sin acceso directo a MySQL desde Next.js.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), React 19, JavaScript |
| Estilos | Tailwind CSS 4, tema oscuro editorial, 8 temas configurables |
| Iconos | lucide-react + morphicons (iconos animados) |
| Tipografía | Geist / Geist Mono (`next/font`) |
| Backend | Route Handlers de Next.js (`rss-parser`, `cheerio`, `bcryptjs`, `animejs`) vía `src/lib/api.js` a la API interna |
| Autenticación | NextAuth 5 beta: credenciales, Google OAuth, GitHub OAuth |
| Base de datos | MySQL 8.4 en servidor local Ubuntu Server, acceso solo vía API interna (`https://servxn-mysql.duckdns.org`, header `x-api-key`). Sin `mysql2`, sin `DATABASE_URL`, sin credenciales MySQL en el frontend |
| IA | Gemini REST (`gemini-3.5-flash-lite` principal, `gemini-2.5-flash` alterno) |
| Notificaciones | Web Push API (VAPID) + Service Worker |
| CI | GitHub Actions (build + lint en Node 20.x y 22.x) |

## Qué hace la aplicación

### 1. Autenticación y aislamiento por cuenta
Tres proveedores (correo + contraseña con bcrypt, Google, GitHub) con registro automático OAuth. La sesión resuelve el `id` real vía la API interna y **todas** las consultas de fuentes y artículos se filtran por `usuario_id`. Incluye modo **invitado** (cuenta temporal en BD, cookie de sesión, se elimina al cerrar navegador).

### 2. Alta y descubrimiento de fuentes
Acepta URL directa de feed o página principal. Estrategias en cascada:
- Parseo directo (RSS, Atom, JSON Feed)
- Etiquetas `<link>` y `<meta>` vía Cheerio
- Enlaces con texto "RSS"
- URLs embebidas en scripts
- Rutas típicas de CMS (`/feed/`, `/rss.xml`, `/atom.xml`, `?feed=rss2`, etc.)

Encabezados de navegador reales y timeouts. Si la URL ya existe en la cuenta (comparación normalizada: minúsculas, sin slash final, sin `utm_*`, sin hash), responde **409** con el nombre de la fuente duplicada.

### 2b. Conversión web → RSS (estilo RSS.app)
Si la página no tiene feed nativo, el motor `src/lib/webToRss.js` la convierte automáticamente: extracción en 3 capas (JSON-LD → artículo único por Open Graph → heurística de lista con puntuación), fechas textuales EN/ES, autor, imagen y video. Incluye **crawling multipágina** (detecta `rel="next"`, `/page/N`, botones "Siguiente"; topes: 20 páginas / 100 noticias / 45 s, con pausa de cortesía) y consolidación desduplicada en orden cronológico inverso. Con el checkbox *"Convertir página completa"* (`forzar_conversion`) se omite el feed nativo y se crawlea la paginación (útil cuando el feed recorta el histórico, p. ej. WordPress sirve ~10 ítems). Las convertidas se guardan con `origen='web'` y se refrescan re-scrapeando, con el mismo caché condicional. Descargas bajo guarda SSRF (`src/lib/ssrf.js`: IP pública, redirects revalidados).

### 3. Clasificación 100% IA (sin clasificador local)
Gemini recibe título, resumen y un **catálogo cerrado de 24 categorías** con descripción (incluye **Developers**: programación, frameworks, DevOps, APIs, código abierto e IA aplicada). Solo puede elegir una categoría existente (validación insensible a acentos). Cadena de modelos con reintento ante 429 (espera sugerida por la API), timeout 25 s y `maxDuration = 60` en la ruta.

### 4. Sincronización optimizada para serverless
- **Respuesta inmediata**: noticias se guardan con categoría provisional, sin bloquear en IA
- **Solo-nuevas**: SELECT previo reutiliza categorías ya guardadas; las marcadas `sin-ia` se reclasifican (autorreparación)
- **Lotes de 12** por llamada IA, con caché en memoria (solo éxitos) y deduplicación
- **Persistencia masiva**: máx. 3 consultas por fuente (INSERT multivalor + UPDATEs con `CASE`), sin tocar `leido`/`guardado`
- **Cola con progreso**: acción `clasificar_pendientes` clasifica 12 y devuelve `restantes`; el panel la solicita en ciclo corto hasta agotarla (pausa 30 s si no hay cuota)
- **Restauración**: Refrescar recupera descartadas del día (`restore_today`)
- **Descargas condicionales**: cada fuente guarda `etag`/`last_modified`; si el feed responde 304 se omite sin parsear, clasificar ni guardar
- **Poda automática**: tras refrescar se eliminan descartadas de +7 días y leídas no guardadas de +60 días (nunca guardadas ni pendientes de leer)

Tiempos estimados: refresco sin novedades ~2–4 s; fuente nueva de 40 artículos ~9 s + cola visible; 100 artículos ~25–30 s (hasta ~2.5 min con cuota limitada).

### 5. Persistencia (esquema MySQL)
Tablas principales:
- `usuarios` — identidad, hash, proveedor
- `fuentes_rss` — propietario, título, URL, categoría, creación, validadores de caché (`etag`, `last_modified`, `ultima_revision`) y `origen` (`rss` nativo / `web` convertida)
- `articulos_publicados` — fuente, título, resumen, URL, fecha, categoría, método y confianza de clasificación, leído, guardado, descartado

Columnas de clasificación creadas de forma idempotente. Soporte UTF-8 / ISO-8859-1 / Windows-1252 con reparación de mojibake.

### 6. Interfaz y accesibilidad
Tema oscuro editorial, responsive, skeleton loaders, toasts, filtros por texto / categoría / fuente. Checkboxes personalizados con icono Lucide real. Imagen lateral del feed en el lector (solo visualización remota, se oculta si falla). `aria-labels`, `focus-visible`, cierre con Escape, `role="status"`. Soporte para **reduced motion** y densidad compacta/cómoda persistidas en `localStorage`.

### 7. Lector modal con navegación fluida
- Navegación teclado (←/→), swipe táctil, rueda del mouse en desktop
- Animaciones de entrada/salida según dirección
- Marcado automático como leído al pasar a la siguiente noticia (opcional)
- Edición de categoría inline con catálogo desplegable
- Badge IA / Manual / Sin IA con confianza
- Tamaño de fuente persistido (3 niveles)
- Imagen del artículo como fondo lateral (gradiente, máscara, solo visual)

### 8. Onboarding de nuevos usuarios
Encuesta de preferencias al primer ingreso que sugiere feeds recomendados (curados en `src/data/recommended-feeds.json`, 108 feeds verificados) y permite agregarlos con un clic. Incluye la categoría **Developers** (🧑‍💻) con 7 fuentes curadas y verificadas: GitHub Blog, Hacker News, DEV Community, Stack Overflow Blog, CSS-Tricks, Smashing Magazine y Martin Fowler. Verificación automática semanal de feeds recomendados via GitHub Action.

### 9. Notificaciones push
Web Push API con VAPID. Service Worker registrado en cliente. Suscripción/desuscripción desde panel de ajustes. Clave pública servida desde `/api/push`.

### 10. Seguridad
Consultas parametrizadas (anti SQL injection), contraseñas con bcrypt, aislamiento por usuario, clave de Gemini solo en servidor, `.env*` ignorados en Git.

### 11. Caché client-side del dashboard
`src/lib/fetchCache.js`: deduplicación de peticiones concurrentes idénticas, TTL por endpoint (fuentes, facetas, páginas) y versión global que invalida todo al mutar (o al cambiar de cuenta). El feed usa stale-while-revalidate por vista (pintado instantáneo + revalidación) con prefetch de páginas vecinas y guarda anti-carreras. Sin cambios visuales ni de UX.

## Estructura del proyecto (puntos de entrada)

```
src/
├── auth.js                      # NextAuth: credenciales, Google, GitHub, sesión con id real
├── middleware.js                # Passthrough ligero
├── app/
│   ├── layout.js                # Layout raíz, metadata, lang="es", tipografía
│   ├── page.js                  # Dashboard: filtros, polling de cola IA, modales
│   ├── globals.css              # Tema, accesibilidad, estilos rss-check
│   ├── login/                   # Página de acceso
│   ├── register/                # Página de registro
│   ├── recuperar/               # Recuperación de contraseña
│   ├── components/
│   │   ├── AddFeedModal.js      # Alta de feeds (propaga pendientes de IA + conversión forzada)
│   │   ├── ManageSourcesModal.js# Editar, refrescar y eliminar fuentes
│   │   ├── NewsFeed.js          # Tarjetas de noticias (memo, stagger, spotlight)
│   │   ├── ArticleReaderModal.js# Lector modal con badge IA/Sin IA y confianza
│   │   ├── ErrorBoundary.js     # Aisla fallos del lector sin tumbar el dashboard
│   │   ├── MorphIcon.js         # Iconos animados (morphicons)
│   │   └── dashboard/           # StatsCards, Paginacion, Toast, WelcomeModal, etc.
│   ├── api/
│   │   ├── auth/                # Registro y handlers NextAuth
│   │   ├── rss/                 # Alta, lectura, refresco, borrado, clasificación
│   │   ├── sources/             # CRUD de fuentes con borrado transaccional
│   │   ├── push/                # Web Push VAPID (subscribe/unsubscribe/key)
│   │   ├── cron/refresh/        # Endpoint para refresco programado (cron externo)
│   │   ├── icon/                # Favicon remoto por dominio
│   │   ├── recommended-feeds/   # Feed curados para onboarding
│   │   ├── perfil/              # Perfil de usuario
│   │   ├── actividad/           # Log de actividad
│   │   ├── datos/               # Exportación de datos (RGPD)
│   │   ├── compartir/           # Web Share Target
│   │   └── repo/                # Info del repositorio
├── lib/
│   ├── api.js                   # Wrapper servidor -> API interna (única vía de datos, `x-api-key`)
│   ├── ssrf.js                  # Guarda de egreso: IP pública, redirects, tope de bytes
│   ├── webToRss.js              # Motor web→RSS: extracción, paginación, fechas/autor
│   ├── fetchCache.js            # Caché client-side: dedupe, TTL, SWR, prefetch
│   ├── ajustesPorDefecto.js     # Defaults y limpieza de ajustes locales por cuenta
│   ├── animaciones.js           # Helpers Anime.js (tarjetas, modales, botones)
│   ├── categoryClassifier.js    # Catálogo cerrado 24 categorías + prompt
│   ├── categoryStyles.js        # Colores deterministas por hash del nombre
│   ├── feed-utils.js            # Utilidades puras (params, VAPID, paginación)
│   ├── formato.js               # Formato fecha, dominio, truncado
│   ├── lectura.js               # Estimación tiempo de lectura
│   ├── i18n.js                  # Solo español con diccionario plano
│   ├── temas.js                 # 8 temas (oscuros + claros) + aplicador
│   ├── useBloquearScroll.js     # Hook: bloquea scroll body al abrir modal
│   ├── opml.js                  # Export/import OPML
│   ├── invitado.js              # Lógica modo invitado
│   ├── correo.js                # Nodemailer (recuperación contraseña)
│   └── push.js                  # Helpers VAPID
├── data/
│   └── recommended-feeds.json   # Feeds curados para onboarding (verificados semanalmente)
sql/
├── 00_base_datos.sql            # CREATE DATABASE utf8mb4
├── 01_usuarios.sql              # Tabla usuarios + índices
├── 02_fuentes_rss.sql           # Tabla fuentes_rss + FK usuario
├── 03_articulos.sql             # Tabla articulos_publicados + FKs + índices
├── 04_recuperacion.sql          # Tokens de recuperación contraseña
├── 05_paginacion.sql            # Índices para paginación eficiente
├── 06_ensure_schema.sql         # Migraciones idempotentes (columnas IA)
├── 07_push.sql                  # Tabla push_subscriptions
├── 08_bienvenida.sql            # Flag bienvenida_vista en usuarios
├── 09_drop_vistas.sql           # Limpieza vistas legacy
├── 10_borrado_cascada.sql       # Verificación FKs en cascada (borrado permanente)
└── 11_fuentes_convertidas.sql   # Columna origen (rss / web) en fuentes_rss
scripts/
├── verify-feeds.js              # Verifica feeds recomendados (HTTP 200 + XML válido + items)
├── recategorizar-feeds.js       # Reclasificación masiva
└── generar-iconos.mjs           # Genera favicons para fuentes
```

## Comandos y entorno

```bash
npm run dev          # Desarrollo (Turbopack)
npm run build        # Build producción
npm start            # Servidor producción
npm run lint         # ESLint (flat config)
npm run verify:feeds # Verifica feeds recomendados y actualiza JSON
```

Variables de entorno (`.env.local`, solo servidor):

```
API_URL, API_SECRET_KEY
AUTH_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GITHUB_ID, GITHUB_SECRET
GEMINI_API_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

Sin `mysql2`, sin `DATABASE_URL`, sin `DB_HOST/DB_USER/DB_PASSWORD`: no existe ninguna credencial MySQL en el código desplegado. Todo el acceso a datos pasa por `src/lib/api.js` hacia la API interna.

## Validación y limitaciones conocidas

- `npm run lint` limpio
- Pruebas en vivo de clasificación (lotes de 6 en ~1.4 s con categoría correcta)
- **Límites**: cuota gratuita Gemini (~20 RPM, backoff automático), caché IA solo en memoria, algunos sitios bloquean scraping pese a encabezados
- Verificación semanal de feeds recomendados via GitHub Action (`.github/workflows/verify-feeds.yml`)

## Despliegue

> **Infraestructura actual:** se migró de Aiven a un servidor MySQL local en Ubuntu Server (equipo dedicado como servidor completo, `servxn-mysql.duckdns.org`). Aiven era una limitante para la página (cuota, latencia y control), por lo que ya no se utiliza. La aplicación Next.js (Vercel) ya no se conecta directo a MySQL: toda la lectura/escritura pasa por la API interna en `https://servxn-mysql.duckdns.org` (auth con header `x-api-key`).

1. Base de datos MySQL 8.4 en servidor local Ubuntu Server, consumida solo vía API interna HTTPS
2. Ejecutar scripts SQL en orden (`00_` a `11_`) o usar `06_ensure_schema.sql` para migraciones idempotentes
3. Configurar variables de entorno en Vercel (`API_URL`, `API_SECRET_KEY`, resto de claves)
4. Deploy automático en push a `main`
5. (Opcional) Cron externo → `POST /api/cron/refresh` para refresco programado

## Acceso a datos y administración de MySQL

El puerto MySQL (3306) en `xxx.duckdns.org` está cerrado por UFW y **no se reabrirá a internet**. Por eso se eliminó del frontend todo acceso directo a la BD (`mysql2`, `DATABASE_URL`, `DB_HOST/DB_USER/DB_PASSWORD`, `createPool`): ya no existe ninguna credencial MySQL en el código desplegado.

### Por qué el servidor solo se abre vía LAN

Exponer 3306 o SSH a internet (`ALLOW Anywhere`) los deja al alcance de bots que barren todo el IPv4 con ataques de fuerza bruta y exploits. En cambio, restringidos a la LAN (`192.168.1.0/24`):

- Internet **no puede ni tocar** esos puertos (UFW descarta el tráfico).
- Solo equipos de la red local (o dentro de un túnel/VPN) llegan a MySQL/SSH.
- Los únicos puertos abiertos a `Anywhere` son 80/443 (HTTPS de la API y DuckDNS) y los del servidor de Minecraft (19132/19133).

Estado actual (verificable con `sudo ufw status`):

| Puerto | Desde | Motivo |
|---|---|---|
| 3306 | `192.168.1.0/24` | MySQL solo LAN |
| 2222/tcp | `192.168.1.0/24` | SSH solo LAN |
| 80, 443 | Anywhere | API HTTPS + DuckDNS |

MySQL además escucha la LAN (`bind-address = 0.0.0.0`), y la administración usa un usuario exclusivo de LAN (`'admin_lan'@'192.168.1.%'`), nunca el usuario de internet de la app.

### Conectarse con MySQL Workbench (desde la LAN)

1. Host `192.168.1.106`, puerto `3306`, usuario `admin_lan`, schema `lector_rss_db`. Sin túnel ni nada extra.
2. Alternativa sin exponer nada (túnel SSH): `ssh -p 2222 -L 3306:localhost:3306 ivanfuentes@192.168.1.106` y en Workbench host `localhost:3306` con un usuario MySQL de `localhost`.
3. Desde fuera de la LAN (otra red/internet): no abrir puertos; usar Tailscale/WireGuard para "estar" en la red local. Por HTTPS (80/443) la API sí es alcanzable desde internet, por diseño.

Ajusta los nombres de usuario/IP si cambian en el futuro; el resto describe el estado verificado hoy (bind 0.0.0.0, regla 3306 LAN-only, sin ALLOW Anywhere en 3306/2222).

## Licencia

MIT — uso libre, modificar y distribuir.