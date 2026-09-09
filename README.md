# Informe del proyecto: Feed Dashboard

## 1. Descripcion general

Feed Dashboard es una aplicacion web para reunir, organizar y leer noticias provenientes de fuentes RSS. Permite que cada usuario registre sus propios feeds, consulte sus articulos en un dashboard, los clasifique por categorias, los marque como leidos, los guarde para despues y administre sus fuentes.

El proyecto esta construido con Next.js y utiliza una base de datos MySQL para conservar usuarios, fuentes RSS y articulos publicados.

## 2. Tecnologias utilizadas

### Frontend

- React 19.
- Next.js 16.3.4 con App Router.
- Tailwind CSS 4 mediante PostCSS.
- Lucide React para iconos.
- Geist y Geist Mono mediante `next/font/google`.
- Interfaz completamente adaptable para escritorio, tablet y movil.

### Backend

- Route Handlers de Next.js.
- Node.js para operaciones de servidor.
- `rss-parser` para interpretar RSS y Atom.
- `cheerio` para descubrir feeds dentro del HTML de una pagina.
- `mysql2/promise` para conectarse a MySQL.
- `bcryptjs` para verificar contrasenas.
- NextAuth 5 beta para autenticacion.

### Servicios externos

- MySQL/Aiven para persistencia.
- Gemini (2.5 Flash y modelos alternos) para clasificacion mediante IA.
- Proveedores OAuth de Google y GitHub, configurables mediante variables de entorno.

## 3. Estructura principal

```text
src/
  auth.js                         Configuracion de NextAuth
  middleware.js                   Middleware ligero compatible con Next.js
  app/
    layout.js                     Layout, metadata, idioma y tipografia
    page.js                       Dashboard principal
    globals.css                   Tema global, accesibilidad y estilos base
    api/
      auth/                       Inicio de sesion y registro
      rss/                        Alta, lectura, refresco y clasificacion RSS
      sources/                    Administracion de fuentes
    components/
      AddFeedModal.js             Modal para agregar feeds
      ArticleReaderModal.js       Lector detallado de una noticia
      ManageSourcesModal.js       Gestion, edicion y eliminacion de fuentes
      NewsFeed.js                 Tarjetas de noticias
  lib/
    db.js                         Pool de conexion MySQL
    categoryClassifier.js         Catalogo de categorias para la clasificacion IA
    categoryStyles.js             Colores deterministas por categoria
```

## 4. Autenticacion y usuarios

El sistema permite autenticarse mediante:

- Correo y contrasena.
- Google OAuth, si se configuran sus credenciales.
- GitHub OAuth, si se configuran sus credenciales.

Las contrasenas se validan con `bcryptjs`. La sesion recupera el identificador real del usuario desde MySQL, lo que permite separar las fuentes y articulos de cada cuenta.

La informacion de cada usuario se mantiene aislada mediante `usuario_id` en las consultas de fuentes y mediante la relacion entre fuentes y articulos.

## 5. Gestion de fuentes RSS

El usuario puede:

- Agregar una fuente usando una URL.
- Introducir una URL de feed RSS o Atom directamente.
- Introducir la pagina principal de un sitio para intentar descubrir automaticamente su feed.
- Editar nombre, URL y categoria de una fuente.
- Consultar la URL completa de cada fuente.
- Ver la cantidad de articulos asociados.
- Ver la fecha de la ultima actualizacion registrada.
- Refrescar una fuente individual.
- Refrescar todas las fuentes.
- Eliminar una fuente y sus articulos relacionados.

El detector de feeds intenta varias estrategias:

1. Interpretar directamente la URL como RSS o Atom.
2. Analizar enlaces `link` con tipos RSS o Atom dentro del HTML.
3. Analizar enlaces de la pagina que contengan rutas como `feed`, `rss`, `atom` o `.xml`.
4. Probar rutas frecuentes de WordPress y otros CMS, como `/feed/`, `/rss.xml`, `/atom.xml`, `/feed.xml`, `/rss/` y `?feed=rss2`.
5. Utilizar encabezados de navegador y de feed para reducir bloqueos HTTP de algunos sitios.

Cuando la URL no es valida, no responde, no contiene un feed o no contiene articulos con enlaces validos, el usuario recibe un mensaje explicativo dentro del modal.

## 6. Lectura y organizacion de noticias

El dashboard permite:

- Visualizar noticias en tarjetas.
- Abrir una noticia en un lector modal.
- Consultar titulo, resumen, fuente, categoria y fecha.
- Abrir la noticia original en el sitio oficial.
- Marcar noticias como leidas.
- Guardar noticias para despues.
- Descartar noticias que no interesan.
- Consultar pestañas separadas para pendientes, leidas y guardadas.
- Ordenar por fecha o alfabeticamente.
- Buscar por titulo y resumen.
- Filtrar por categoria.
- Filtrar por fuente RSS.
- Limpiar todos los filtros activos.

La pestaña principal excluye automaticamente noticias leidas y guardadas. Al marcar una noticia, esta desaparece de pendientes y pasa a su apartado correspondiente.

## 7. Clasificacion de categorias

La clasificacion de cada noticia la realiza exclusivamente la inteligencia artificial (Gemini); no existe clasificador heuristico local.

El proyecto cuenta con un catalogo de categorias controlado por codigo en `src/lib/categoryClassifier.js`. Gemini no puede inventar categorias: recibe el catalogo completo con la descripcion de cada categoria y solo puede seleccionar una de ellas a partir del titulo y el resumen.

Entre las categorias del catalogo se encuentran:

- Politica.
- Economia y Finanzas.
- Seguridad y Justicia.
- Tecnologia.
- Celulares.
- Computadoras.
- Videojuegos.
- Ciencia y Espacio.
- Salud y Medicina.
- Fitness y Nutricion.
- Medio Ambiente.
- Clima y Meteorologia.
- Deportes.
- Cultura y Arte.
- Cine y Series.
- Musica.
- Gastronomia.
- Viajes y Turismo.
- Motor.
- Educacion.
- Moda y Belleza.
- Hogar y Vida Diaria.
- General, como categoria de respaldo.

## 8. Clasificacion con Gemini

Cuando existe `GEMINI_API_KEY` en `.env.local`, cada noticia se clasifica llamando a Gemini.

Gemini recibe:

- El titulo de la noticia.
- El resumen breve.
- El catalogo de categorias permitidas con una descripcion de cada una.

La respuesta esperada contiene:

- Nombre exacto de la categoria.
- Nivel de confianza entre 0 y 1.

La respuesta se valida contra `CATEGORIAS_DISPONIBLES`. Si Gemini responde una categoria inexistente, falla, excede el tiempo limite o no existe la clave de API, el articulo se guarda como `General` con clasificacion `sin-ia` (no se usa ningun clasificador local).

Para mejorar el rendimiento:

- Se utiliza una cache en memoria basada en titulo y resumen.
- Se procesan hasta cuatro clasificaciones simultaneamente.
- No se repite la llamada de IA para contenido identico durante la vida del proceso.

En la base de datos se conservan:

- `categoria`.
- `clasificacion_metodo`: `gemini` o `sin-ia`.
- `clasificacion_confianza`.

Las columnas de metodo y confianza se crean de forma idempotente cuando la API verifica el esquema.

## 9. Persistencia de datos

Las entidades principales son:

### Usuarios

Conservan identidad, correo, contrasena cifrada, imagen y proveedor de autenticacion.

### Fuentes RSS

Conservan:

- Usuario propietario.
- Nombre.
- URL del feed.
- Categoria de la fuente.
- Fecha de creacion.

### Articulos publicados

Conservan:

- Fuente asociada.
- Titulo.
- Resumen.
- URL original.
- Fecha de publicacion.
- Categoria.
- Metodo y confianza de clasificacion.
- Estado leido.
- Estado guardado.
- Estado descartado.

La conexion MySQL usa `utf8mb4` para soportar acentos, simbolos y caracteres internacionales.

## 10. Codificacion y normalizacion

El lector intenta reconocer la codificacion declarada por cada feed y soporta UTF-8, ISO-8859-1 y Windows-1252. Tambien contiene una reparacion para textos antiguos almacenados como mojibake, por ejemplo `DistopÃ­a`.

Durante un refresco, los titulos y resumenes existentes se actualizan con la version recien descargada, lo que permite corregir registros antiguos con caracteres dañados.

## 11. Experiencia visual

La interfaz utiliza un tema oscuro editorial con:

- Tipografia Geist.
- Variables globales de color.
- Contraste controlado.
- Estados de foco visibles.
- Skeleton loaders durante la carga.
- Tarjetas de estadisticas.
- Toasts para operaciones exitosas o fallidas.
- Colores automaticos por nombre de categoria.
- Diseño adaptable a diferentes tamaños de pantalla.

El color de una categoria se obtiene mediante un hash estable de su nombre. Por esa razon, cualquier categoria nueva recibe automaticamente un color consistente sin necesidad de agregar otro `case` manual.

## 12. Accesibilidad

Se incluyen:

- `lang="es"` en el documento HTML.
- `aria-label` en acciones de iconos.
- Estados `focus-visible`.
- Cierre de modales con la tecla Escape.
- Mensajes de estado mediante elementos con `role="status"`.
- Contraste de texto y controles sobre fondos oscuros.

## 13. Seguridad

- Las consultas MySQL utilizan parametros.
- Las contraseñas se validan con bcrypt.
- Las fuentes se consultan por usuario autenticado.
- La clave de Gemini se utiliza solamente en servidor.
- Las variables de entorno no deben subirse a Git.
- Las credenciales compartidas anteriormente deben rotarse antes de un despliegue real.

## 14. Comandos del proyecto

```bash
npm run dev
```

Inicia el servidor de desarrollo.

```bash
npm run build
```

Genera la compilacion optimizada de produccion.

```bash
npm start
```

Inicia la aplicacion compilada.

```bash
npm run lint
```

Ejecuta ESLint.

## 15. Validacion actual

La aplicacion ha sido validada con:

- `npm run lint`.
- `npm run build`.
- Inicio de produccion mediante `npm start`.
- Consulta de la API RSS.
- Verificacion de insercion y refresco de fuentes.
- Verificacion de filtros de fuente y categoria.
- Verificacion de clasificacion local y fallback de Gemini.

## 16. Limitaciones conocidas

- El estado de fuente se presenta actualmente como activa desde la consulta de fuentes; los errores de refresco se comunican mediante toast, pero no se conserva un historial persistente de errores.
- La cache de Gemini vive en memoria y se pierde al reiniciar el servidor.
- La clasificacion automatica depende de la calidad del titulo y resumen proporcionados por cada feed.
- Algunos sitios pueden bloquear solicitudes automatizadas aunque se utilicen encabezados de navegador.
- La migracion de las columnas de confianza ocurre al acceder a la API y debe contar con permisos de alteracion de tabla.

## 17. Beneficio para el usuario

El usuario obtiene un lector RSS personalizado que centraliza sus fuentes, reduce el tiempo de consulta de multiples paginas, organiza automaticamente las noticias, permite conservar lecturas importantes y facilita encontrar contenido mediante busqueda, filtros y categorias.

El sistema combina reglas locales deterministas con inteligencia artificial opcional. Esto permite mantener el funcionamiento incluso sin Gemini y aprovechar una clasificacion mas contextual cuando la API esta configurada.
