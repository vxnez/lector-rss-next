# Lector RSS — Dashboard de feeds con IA

Aplicación web full-stack para centralizar, organizar y leer noticias de fuentes RSS por usuario. Permite registrar feeds, consultar un dashboard de artículos, clasificarlos automáticamente con IA, marcarlos como leídos, guardarlos, descartarlos y administrar las fuentes. Despliegue en Vercel con MySQL en servidor local (Ubuntu Server).

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router), React 19, JavaScript |
| Estilos | Tailwind CSS 4, tema oscuro editorial, 8 temas configurables |
| Iconos | lucide-react + morphicons (iconos animados) |
| Tipografía | Geist / Geist Mono (`next/font`) |
| Backend | Route Handlers de Next.js (`rss-parser`, `cheerio`, `mysql2/promise`, `bcryptjs`) |
| Autenticación | NextAuth 5 beta: credenciales, Google OAuth, GitHub OAuth |
| Base de datos | MySQL 8.4 en servidor local Ubuntu Server (pool 10, SSL, `utf8mb4`) |
| IA | Gemini REST (`gemini-3.5-flash-lite` principal, `gemini-2.5-flash` alterno) |
| Notificaciones | Web Push API (VAPID) + Service Worker |
| CI | GitHub Actions (build + lint en Node 20.x y 22.x) |

## Qué hace la aplicación

### 1. Autenticación y aislamiento por cuenta
Tres proveedores (correo + contraseña con bcrypt, Google, GitHub) con registro automático OAuth. La sesión resuelve el `id` real desde MySQL y **todas** las consultas de fuentes y artículos se filtran por `usuario_id`. Incluye modo **invitado** (cuenta temporal en BD, cookie de sesión, se elimina al cerrar navegador).

### 2. Alta y descubrimiento de fuentes
Acepta URL directa de feed o página principal. Estrategias en cascada:
- Parseo directo (RSS, Atom, JSON Feed)
- Etiquetas `<link>` y `<meta>` vía Cheerio
- Enlaces con texto "RSS"
- URLs embebidas en scripts
- Rutas típicas de CMS (`/feed/`, `/rss.xml`, `/atom.xml`, `?feed=rss2`, etc.)

Encabezados de navegador reales y timeouts. Si la URL ya existe en la cuenta (comparación normalizada: minúsculas, sin slash final, sin `utm_*`, sin hash), responde **409** con el nombre de la fuente duplicada.

### 3. Clasificación 100% IA (sin clasificador local)
Gemini recibe título, resumen y un **catálogo cerrado de 23 categorías** con descripción. Solo puede elegir una categoría existente (validación insensible a acentos). Cadena de modelos con reintento ante 429 (espera sugerida por la API), timeout 25 s y `maxDuration = 60` en la ruta.

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
- `fuentes_rss` — propietario, título, URL, categoría, creación
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
Encuesta de preferencias al primer ingreso que sugiere feeds recomendados (curados en `src/data/recommended-feeds.json`) y permite agregarlos con un clic. Verificación automática semanal de feeds recomendados via GitHub Action.

### 9. Notificaciones push
Web Push API con VAPID. Service Worker registrado en cliente. Suscripción/desuscripción desde panel de ajustes. Clave pública servida desde `/api/push`.

### 10. Seguridad
Consultas parametrizadas (anti SQL injection), contraseñas con bcrypt, aislamiento por usuario, clave de Gemini solo en servidor, `.env*` ignorados en Git.

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
│   │   ├── AddFeedModal.js      # Alta de feeds (propaga pendientes de IA)
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
│   ├── db.js                    # Pool MySQL (servidor local Ubuntu, SSL)
│   ├── categoryClassifier.js    # Catálogo cerrado 23 categorías + prompt
│   ├── categoryStyles.js        # Colores deterministas por hash del nombre
│   ├── feed-utils.js            # Utilidades puras (params, VAPID, paginación)
│   ├── formato.js               # Formato fecha, dominio, truncado
│   ├── lectura.js               # Estimación tiempo de lectura
│   ├── i18n.js                  # ES/EN con diccionario plano
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
├── 05_paginacion.sql            # Vistas para paginación eficiente
├── 06_ensure_schema.sql         # Migraciones idempotentes (columnas IA)
├── 07_push.sql                  # Tabla push_subscriptions
└── 09_drop_vistas.sql           # Limpieza vistas legacy
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

Variables de entorno (`.env.local`):

```
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT
AUTH_SECRET
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
GITHUB_ID, GITHUB_SECRET
GEMINI_API_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
```

## Validación y limitaciones conocidas

- `npm run lint` limpio
- Pruebas en vivo de clasificación (lotes de 6 en ~1.4 s con categoría correcta)
- **Límites**: cuota gratuita Gemini (~20 RPM, backoff automático), caché IA solo en memoria, algunos sitios bloquean scraping pese a encabezados
- Verificación semanal de feeds recomendados via GitHub Action (`.github/workflows/verify-feeds.yml`)

## Despliegue

> **Infraestructura actual:** se migró de Aiven a un servidor MySQL local en Ubuntu Server (equipo dedicado como servidor completo, `servxn-mysql.duckdns.org`). Aiven era una limitante para la página (cuota, latencia y control), por lo que ya no se utiliza.

1. Base de datos MySQL 8.4 en servidor local Ubuntu Server (`servxn-mysql.duckdns.org:3306`, SSL con `TLS_AES_128_GCM_SHA256`, `utf8mb4_unicode_ci`, `innodb_buffer_pool_size = 2G`)
2. Ejecutar scripts SQL en orden (`00_` a `09_`) o usar `06_ensure_schema.sql` para migraciones idempotentes
3. Configurar variables de entorno en Vercel
4. Deploy automático en push a `main`
5. (Opcional) Cron externo → `POST /api/cron/refresh` para refresco programado

## Licencia

MIT — uso libre, modificar y distribuir.