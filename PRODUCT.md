# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Lector intensivo que sigue muchas fuentes RSS y necesita centralizar, clasificar y leer rápido. Opera en un dashboard personal aislado por cuenta (`usuario_id`); incluye modo invitado temporal que se elimina al cerrar el navegador.

## Product Purpose

Centralizar, organizar y leer noticias de fuentes RSS por usuario: registrar feeds, consultar un dashboard de artículos, clasificar automáticamente con IA, marcar como leídos, guardar, descartar y administrar fuentes. Éxito = pendientes en cero, clasificación correcta, refresco con novedades sin fricción y lectura rápida.

## Positioning

Dashboard RSS personal que combina clasificación IA híbrida (backend siembra `local` al ingerir, frontend pule por lotes con Gemini/Groq, catálogo cerrado, umbral 80%, fallback por palabras clave) con conversión web→RSS automática (extracción en 3 capas + crawling multipágina con topes 20 páginas / 100 noticias / 45 s). Ningún lector RSS genérico ofrece ese par en un dashboard con datos propios servidos por API interna.

## Operating Context

Flujos: alta de fuentes por URL directa o página (descubrimiento en cascada, 409 si duplicada); refresco manual por fuente o total y cron diario Vercel que delega por usuario; cola IA por lotes con tarjeta de progreso; lector modal con navegación teclado (←/→), swipe, rueda y marcado auto como leído; onboarding con encuesta y 108 feeds curados en un clic; push VAPID tras refresco con novedades; exportación RGPD/OPML.

Entornos: `Vercel (este repo) → HTTPS → API servxn (https://servxn-mysql.duckdns.org) → MySQL LAN`. Presupuesto Vercel 60 s por función; timeouts propios 30 s lecturas / 55 s refresh; reintento solo en GET o ante 429 respetando `Retry-After`.

## Capabilities and Constraints

Confirmado: auth NextAuth 5 (credenciales bcrypt, Google, GitHub) + invitado; ingesta al alta con upsert por fuente+URL; descargas condicionales `etag`/`last_modified` (304 omite); poda (descartadas +7 días, leídas no guardadas +60 días); contratos `fuentes`, `articulos` con `total` sin paginar, `descartado=1` excluido, `PATCH` devuelve la fila; frontend nunca persiste fuera del catálogo ni sobrescribe `manual`; `metodo` = proveedor real; caché client-side dedupe+TTL+SWR; offline parcial (IndexedDB guardados + últimas 50 en localStorage con badge Modo caché); 12 temas con identidad fija (Vainilla claro por defecto, Mineral contraparte oscura); bilingüe ES (defecto)/EN de interfaz.

Restricciones inviolables: cero `mysql2`, cero `DATABASE_URL`, cero credenciales MySQL en este código; `src/lib/api.js` server-only es la única vía de datos con `x-api-key`; backend habla `snake_case`, frontend mapea a `camelCase`; `usuario_id` llega como string y se normaliza a `Number`; sin SSG/ISR en dashboard por usuario; cuotas gratuitas Gemini/Groq con backoff+failover, cachés IA en memoria; algunos sitios bloquean scraping.

## Brand Commitments

Nombre: Lector RSS — Dashboard de feeds con IA. Voz bilingüe ES/EN nativa. Licencia MIT.

## Evidence on Hand

Real: `src/data/recommended-feeds.json` (108 feeds verificados, verificación semanal vía GitHub Action); `sql/00-11` + `06_ensure_schema.sql`; `scripts/verify-feeds.js`; `README.md`, `CONTEXTO_FRONTEND.md`, `CONTEXTO_BACKEND.md` (solo lectura). Ausencias que no deben fabricarse: sin testimonios, sin clientes, sin benchmarks, sin precios.

## Product Principles

1. Aislamiento por cuenta ante todo: ninguna consulta cruza `usuario_id`.
2. IA que siembra y pule sin pisarse: catálogo cerrado, umbral de confianza, `manual` intocable.
3. Nunca perder una novedad: ingesta robusta, refresh aislado por fuente, offline y poda segura.
4. Lectura rápida y accesible primero: teclado, swipe, optimismo con reversión, sin cambios visuales por caché.
5. El contrato API manda: sin atajos a la BD ni renegociación unilateral.

## Accessibility & Inclusion

Requisitos conocidos: `aria-labels`, `focus-visible`, cierre con Escape, `role="status"`; soporte `reduced motion`; densidad compacta/cómoda persistida; slider de texto global 12–24px; navegación teclado y táctil en lector; responsive con skeleton loaders y toasts; contraste AA en insignias en ambos modos.
