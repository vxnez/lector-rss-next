# Informe del proyecto: RSS Dashboard (Feed Dashboard)

## 1. Descripcion

Aplicacion web full-stack para centralizar, organizar y leer noticias de fuentes RSS por usuario. Permite registrar feeds, consultar un dashboard de articulos, clasificarlos automaticamente con IA, marcarlos como leidos, guardarlos, descartarlos y administrar las fuentes. Despliegue en Vercel con MySQL en Aiven.

## 2. Stack tecnico

| Capa | Tecnologia |
|---|---|
| Framework | Next.js 16.3.4 (App Router), React 19, JavaScript |
| Estilos | Tailwind CSS 4, tema oscuro propio, checkboxes personalizados |
| Iconos | lucide-react |
| Tipografia | Geist y Geist Mono (`next/font`) |
| Backend | Route Handlers de Next.js (`rss-parser`, `cheerio`, `mysql2/promise`, `bcryptjs`) |
| Autenticacion | NextAuth 5 beta: credenciales, Google OAuth y GitHub OAuth |
| Base de datos | MySQL en Aiven (pool de 10, SSL, `utf8mb4`) |
| IA | Gemini REST (`gemini-3.5-flash-lite` primero, `gemini-2.5-flash` alterno) |
| CI | GitHub Actions (build + lint en Node 20.x y 22.x) |

## 3. Estructura del proyecto

```text
src/
  auth.js                         NextAuth: credenciales, Google, GitHub, sesion con id real
  middleware.js                   Passthrough ligero
  app/
    layout.js                     Layout raiz, metadata, lang="es", tipografia
    page.js                       Dashboard: filtros, polling de cola IA, modales
    globals.css                   Tema, accesibilidad y estilos rss-check
    login/ - register/            Paginas de acceso y registro
    components/
      AddFeedModal.js             Alta de feeds (propaga pendientes de IA)
      ManageSourcesModal.js       Editar, refrescar y eliminar fuentes
      NewsFeed.js                 Tarjetas de noticias
      ArticleReaderModal.js       Lector modal con badge IA/Sin IA y confianza
    api/
      auth/                       Registro y handlers de NextAuth
      rss/                        Alta, lectura, refresco, borrado y clasificacion
      sources/                    CRUD de fuentes con borrado transaccional
  lib/
    db.js                         Pool MySQL
    categoryClassifier.js         Catalogo cerrado de 23 categorias con descripcion
    categoryStyles.js             Colores deterministas por hash del nombre
```

## 4. Detalles tecnicos relevantes

### 4.1 Autenticacion y aislamiento por cuenta

Tres proveedores (correo+contrasena con bcrypt, Google, GitHub) con registro automatico OAuth. La sesion resuelve el `id` real desde MySQL y todas las consultas de fuentes y articulos se filtran por `usuario_id`.

### 4.2 Alta y descubrimiento de fuentes

Acepta URL directa de feed o pagina principal, con estrategias en cascada: parseo directo (RSS, Atom, JSON Feed), etiquetas `<link>` y `meta` via Cheerio, enlaces con texto RSS, URLs embebidas en scripts y rutas tipicas de CMS (`/feed/`, `/rss.xml`, `/atom.xml`, `?feed=rss2`, etc.), con encabezados de navegador y timeouts.

Si la URL ya existe en la cuenta (comparacion normalizada: minusculas, sin slash final, sin `utm_*`, sin hash), responde **409** con el nombre de la fuente duplicada.

### 4.3 Clasificacion 100% IA

Sin clasificador local. Gemini recibe titulo, resumen y el catalogo cerrado con descripciones, y solo puede elegir una categoria existente (validacion insensible a acentos). Cadena de modelos con reintento ante 429 (espera sugerida por la API), timeout de 25s y `maxDuration = 60` en la ruta.

### 4.4 Sincronizacion optimizada

- **Respuesta inmediata**: las noticias se guardan con categoria provisional, sin bloquear en IA.
- **Solo-nuevas**: un SELECT previo reutiliza categorias ya guardadas; las marcadas `sin-ia` se reclasifican (autorreparacion).
- **Lotes de 12** por llamada IA, con cache en memoria (solo exitos) y deduplicacion.
- **Persistencia masiva**: maximo 3 consultas por fuente (INSERT multivalor + UPDATEs con `CASE`), sin tocar `leido`/`guardado`.
- **Cola con progreso**: la accion `clasificar_pendientes` clasifica 12 y devuelve `restantes`; el panel la solicita en ciclo corto hasta agotarla (pausa de 30s si no hay cuota). Compatible con serverless.
- **Restauracion**: Refrescar recupera las descartadas del dia (`restore_today`).

Tiempos estimados: refresco sin novedades ~2-4s; fuente nueva de 40 ~9s + cola visible; 100 noticias ~25-30s (hasta ~2.5 min con cuota limitada).

### 4.5 Persistencia

`usuarios` (identidad, hash, proveedor) · `fuentes_rss` (propietario, titulo, URL, categoria, creacion) · `articulos_publicados` (fuente, titulo, resumen, URL, fecha, categoria, metodo y confianza, leido, guardado, descartado). Columnas de clasificacion creadas de forma idempotente. Soporte UTF-8/ISO-8859-1/Windows-1252 con reparacion de mojibake.

### 4.6 Interfaz y accesibilidad

Tema oscuro editorial, responsive, skeleton loaders, toasts, filtros por texto/categoria/fuente, checkboxes personalizados con icono Lucide real, `aria-labels`, `focus-visible`, cierre con Escape y `role="status"`.

### 4.7 Seguridad

Consultas parametrizadas (anti SQL injection), contrasenas con bcrypt, aislamiento por usuario, clave de Gemini solo en servidor y `.env*` ignorados en Git.

## 5. Comandos y entorno

```bash
npm run dev | npm run build | npm start | npm run lint
```

Variables: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_ID/SECRET`, `GEMINI_API_KEY`.

## 6. Validacion y limitaciones

Validado con `npm run lint` limpio y pruebas en vivo de clasificacion (lotes de 6 en ~1.4s con categoria correcta). Limites conocidos: cuota gratuita de Gemini (~20 RPM, con backoff automatico), cache IA solo en memoria y algunos sitios que bloquean scraping pese a los encabezados.
