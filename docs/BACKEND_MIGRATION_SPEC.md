# Spec-Driven Development: Migración y Alineación Backend (servxn-api) con Frontend (lector-rss-next)

**Fecha:** 2026-10-30
**Proyecto:** Lector RSS Dashboard
**Frontend:** `lector-rss-next` (Next.js 16 + React 19, Vercel) — **YA ACTUALIZADO**
**Backend:** `servxn-api` (Node.js/Express + MySQL 8.4) — **REQUIERE MIGRACIÓN**

---

## Idea

El frontend `lector-rss-next` ha sido completamente actualizado con mejoras de seguridad, rendimiento y arquitectura. Ahora el backend `servxn-api` debe alinearse para soportar los nuevos contratos, endpoints y comportamientos que el frontend consume. Este spec define las modificaciones necesarias en el backend para garantizar compatibilidad total sin romper la funcionalidad existente.

---

## Regla de Propiedad (sin excepción)

- **IA Frontend** (este repo, Vercel): dueña exclusiva del frontend, UI, Next.js, Vercel.
- **IA Backend** (servxn-api, MySQL): dueña exclusiva del servidor, UFW, esquema, datos, API.
- El frontend **JAMÁS** escribe en el backend (ni código, ni DDL, ni datos).
- El backend **JAMÁS** asume que el frontend tiene credenciales MySQL o acceso directo a la BD.
- Toda comunicación es via HTTPS + header `x-api-key`.

---

## Requisitos

1. **Compatibilidad total** con los contratos documentados en `CONTEXTO_FRONTEND.md` §3.
2. **No romper** endpoints existentes que el frontend ya consume.
3. **Implementar** endpoints que el frontend espera pero que actualmente retornan 404.
4. **Respetar** los límites de Vercel (60s por función, 30s lecturas, 55s refresh).
5. **Mantener** la regla de propiedad: el backend es dueño de MySQL, esquema y datos.
6. **Seguridad**: rate-limiting, headers CORS, validación de input, anti-enumeración.

---

## Contratos Actuales (Verificados por Frontend)

### Usuarios
- `GET /api/users?email=` → Filtrado en SQL, devuelve lista o null.
- `GET /api/users/:id` → Devuelve usuario por id.
- `POST /api/users` → **FALTA IMPLEMENTAR** (retorna 404 actualmente). El frontend intenta crear usuario OAuth aquí.
- `PATCH /api/users/:id` → Actualiza usuario (proveedor, bienvenida_vista, etc.).
- `DELETE /api/users/:id` → Borrado duro.
- `GET /api/users` → Listado completo (solo para cron, evita martillar).

### Autenticación
- `POST /api/auth/login` → `{ email, password }` → `{ user, ... }`.
- `POST /api/auth/recover/request` → `{ email }` → envía código 6 dígitos, 15 min, bloqueo a 5 intentos.
- `POST /api/auth/recover/verify` → `{ email, code, newPassword }` → verifica y restablece.

### Fuentes
- `GET /api/data/fuentes?usuario_id=` → Lista fuentes del usuario.
- `POST /api/data/fuentes` → `{ usuario_id, titulo, url_feed, categoria }` → crea fuente.
- `PATCH /api/data/fuentes/:id` → Actualiza fuente.
- `PATCH /api/data/fuentes` → Bulk atómico: `{ usuario_id, ids, convert_full_page }`.
- `DELETE /api/data/fuentes/:id` → Borra fuente + artículos (atómico).
- `DELETE /api/data/fuentes?usuario_id=&ids=` → Bulk atómico todo-o-nada.

### Artículos
- `GET /api/data/articulos?usuario_id=&limit=&offset=&q=&categoria=&leido=&guardado=&order=&dir=&modo_busqueda=` → Lista artículos con total.
- `PATCH /api/data/articulos/:id` → `{ usuario_id, categoria, clasificacion_metodo, clasificacion_confianza, leido, guardado, descartado }` → devuelve fila actualizada.
- `GET /api/data/stats?usuario_id=` → `{ articulos, no_leidos, guardadas, ... }`.

### Refresh
- `POST /api/data/refresh` → `{ usuario_id, fuente_id? }` → `{ fuentes, nuevos, omitidas, actualizadas, fuentes_sin_cambios, reparados, pendientes, detalle[] }`.
- `GET /api/data/refresh` → Variante GET (fallback).

### IA
- `POST /api/ia/resumen` → `{ usuario_id, titulo, resumen, proveedor }` → `{ puntos, diag, cacheado }`.
- `GET /api/ia/progreso?usuario_id=` → `{ pendientes, en_curso, actualizados_en }`.

### Push
- `GET|POST|DELETE /api/push/subscriptions` → `{ usuario_id, endpoint, p256dh, auth }`.

### Otros
- `GET /api/health` → Health check (sin key).
- `GET /api/health/db` → Health check BD (con key).
- `GET /api/data/bienvenida?usuario_id=` → Bienvenida.
- `GET /api/repo` → Info del repo.

---

## Tareas (Prioridad 1 — Blockers)

### 1.1 Implementar `POST /api/users` (Crear usuario)
**Problema actual:** El frontend llama a `POST /api/users` en el callback OAuth de NextAuth para crear usuarios nuevos. El backend retorna 404.

**Contrato esperado:**
```
POST /api/users
Headers: x-api-key: <API_SECRET_KEY>
Body: { nombre, email, password, proveedor? }
Response 201: { user: { id, nombre, email, proveedor, ... } } o { usuario: { ... } } o { id, ... }
Response 409: { error: "el correo ya está registrado" } (si email duplicado)
Response 400: { error: "..." } (validación)
```

**Requisitos:**
- Validar email único (SQL UNIQUE constraint).
- Hash de password con bcrypt (el frontend envía password plano).
- `proveedor` es CSV (ej. "google", "github", "google,github", "invitado").
- Si `proveedor` incluye "invitado", marcar como cuenta temporal.
- Devolver el usuario creado con `id` (numérico).
- Anti-enumeración: no revelar si el email ya existe en el mensaje de error (usar 409 genérico).

**DDL sugerido (si no existe):**
```sql
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  proveedor VARCHAR(255) DEFAULT NULL,
  imagen_url VARCHAR(500) DEFAULT NULL,
  genero VARCHAR(50) DEFAULT NULL,
  bienvenida_vista TINYINT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

### 1.2 Implementar `GET /api/users?email=` (Filtrado en SQL)
**Problema actual:** El frontend depende de esto para el callback OAuth. Si no existe, cada login falla.

**Contrato esperado:**
```
GET /api/users?email=usuario@ejemplo.com
Headers: x-api-key: <API_SECRET_KEY>
Response 200: { users: [ { id, nombre, email, proveedor, ... } ] } o [ { ... } ] o { data: [ ... ] }
Response 200 (sin coincidencia): { users: [] } o [] (nunca 404)
```

**Requisitos:**
- Filtrado en SQL: `WHERE email = ?` (no traer toda la tabla).
- Normalizar email (lowercase, trim) antes de comparar.
- Si no hay coincidencia, devolver array vacío (no 404).

---

### 1.3 Implementar `GET /api/users/:id`
**Contrato esperado:**
```
GET /api/users/:id
Headers: x-api-key: <API_SECRET_KEY>
Response 200: { user: { id, nombre, email, proveedor, ... } } o { usuario: { ... } } o { id, ... }
Response 404: { error: "not_found" } (si no existe)
```

**Requisitos:**
- Devolver usuario por id numérico.
- `usuario_id`/`id` deben ser comparables como Number (el frontend normaliza a Number).

---

### 1.4 Implementar `PATCH /api/users/:id`
**Contrato esperado:**
```
PATCH /api/users/:id
Headers: x-api-key: <API_SECRET_KEY>
Body: { proveedor?, bienvenida_vista?, nombre?, imagen_url?, genero? }
Response 200: { user: { ... } } o { usuario: { ... } } o { id, ... }
Response 404: { error: "not_found" }
```

**Requisitos:**
- Actualización parcial (solo campos presentes en body).
- `proveedor` se actualiza como CSV (el frontend envía el string completo).
- `bienvenida_vista` acepta 0/1.

---

### 1.5 Implementar `DELETE /api/users/:id`
**Contrato esperado:**
```
DELETE /api/users/:id
Headers: x-api-key: <API_SECRET_KEY>
Response 200: { ok: true, ... }
Response 404: { error: "not_found" }
```

**Requisitos:**
- Borrado duro (DELETE FROM usuarios WHERE id = ?).
- Cascada: borrar fuentes, artículos, push subscriptions del usuario.
- El frontend invalida cache local tras borrado.

---

## Tareas (Prioridad 2 — Sprint Actual)

### 2.1 Rate Limiting en Backend
**Problema:** El frontend tiene rate limiting propio, pero el backend no. Un atacante puede saltar el frontend y llamar directamente al backend.

**Implementar:**
- Rate limit por IP en `/api/auth/*` (5 req/min).
- Rate limit por IP en `/api/users` (10 req/min).
- Usar `express-rate-limit` con store en memoria o Redis.
- Devolver `429` con header `Retry-After`.

```javascript
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: "Demasiados intentos. Intente de nuevo en un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);
```

---

### 2.2 CORS Estricto
**Problema:** El backend debe aceptar requests solo del frontend en Vercel.

**Implementar:**
```javascript
const cors = require('cors');
app.use(cors({
  origin: ['https://rssdashboard.vercel.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
  credentials: true,
}));
```

---

### 2.3 Headers de Seguridad (Helmet)
**Implementar:**
```javascript
const helmet = require('helmet');
app.use(helmet({
  contentSecurityPolicy: false, // El frontend ya lo maneja
  crossOriginEmbedderPolicy: false,
}));
```

---

### 2.4 Validación de Input (express-validator o Zod)
**Implementar validación en todos los endpoints:**
- `POST /api/users`: validar email, nombre, password (min 6 chars).
- `POST /api/data/fuentes`: validar url_feed (http/https), usuario_id numérico.
- `PATCH /api/data/articulos/:id`: validar categoria en catálogo de 25.
- `POST /api/auth/recover/verify`: validar código 6 dígitos, password min 6.

---

### 2.5 Health Check Endpoints
**Ya implementado:** `GET /api/health` (sin key).
**Añadir:** `GET /api/health/db` (con key) → verifica conexión MySQL.

```javascript
app.get('/api/health/db', async (req, res) => {
  if (req.headers['x-api-key'] !== process.env.API_SECRET_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, db: "disconnected", error: err.message });
  }
});
```

---

### 2.6 Refresh Endpoint (Contrato Exacto)
**El frontend consume:**
```
POST /api/data/refresh { usuario_id, fuente_id? }
→ { fuentes, nuevos, omitidas, actualizadas, fuentes_sin_cambios, reparados, pendientes, detalle[] }
```

**Requisitos:**
- `fuentes`: número de fuentes procesadas.
- `nuevos`: artículos nuevos insertados.
- `omitidas`: artículos duplicados omitidos (NO fuentes).
- `actualizadas`: fuentes actualizadas (puede ser igual a `fuentes`).
- `fuentes_sin_cambios`: fuentes que no tuvieron cambios (NO artículos).
- `reparados`: fuentes reparadas por el proceso de reparación.
- `pendientes`: artículos en "General"/NULL (para cola IA).
- `detalle[]`: array con `{ fuente_id, nuevos, estado }` por fuente.

**IMPORTANTE:** `omitidas` = ARTÍCULOS, `fuentes_sin_cambios` = FUENTES. No intercambiar (causó el bug "130 vs 10").

---

### 2.7 Push Subscriptions Endpoint
**Contrato:**
```
GET /api/push/subscriptions?usuario_id= → [ { endpoint, p256dh, auth } ] o { data: [ ... ] } o { subscriptions: [ ... ] }
POST /api/push/subscriptions → { usuario_id, endpoint, p256dh, auth } → { ok: true }
DELETE /api/push/subscriptions → { usuario_id, endpoint } → { ok: true }
DELETE /api/push/subscriptions?usuario_id= → borra todas
```

---

### 2.8 IA Resumen Endpoint
**Contrato:**
```
POST /api/ia/resumen { usuario_id, titulo, resumen, proveedor? }
→ { puntos: ["...", "...", "...", "..."], diag: null | "sin_clave" | "cuota" | "auth" | "modelo" | "red" | "respuesta" | "corto", cacheado: boolean, proveedor: "gemini" | "groq" }
```

**Requisitos:**
- Caché 24h por texto (clave normalizada: título + resumen).
- `diag: "sin_clave"` si no hay API key configurada en el backend.
- `diag: "corto"` si el resumen tiene < 60 chars.
- `puntos`: 3-5 bullets, cada uno 1 oración, max 40 palabras.
- Idioma: detectar si el texto está en inglés o español.

---

### 2.9 IA Progreso Endpoint
**Contrato:**
```
GET /api/ia/progreso?usuario_id=
→ { pendientes: number, en_curso: boolean, actualizados_en: ISO timestamp | null }
```

---

## Tareas (Prioridad 3 — Planificación Técnica)

### 3.1 Variables de Entorno del Backend

**Obligatorias:**
```bash
# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=servxn_user
DB_PASSWORD=tu_password_mysql
DB_NAME=lector_rss_db

# API
API_SECRET_KEY=tu_api_secret_key_32_chars_minimo  # DEBE coincidir con frontend
PORT=3001
NODE_ENV=production

# IA
IA_PROVEEDOR=gemini
IA_API_KEY=tu_gemini_o_groq_key
GROQ_API_KEY=tu_groq_key  # opcional override
GEMINI_API_KEY=tu_gemini_key  # opcional override
IA_MODELOS=gemini-2.5-flash,gemini-3.5-flash-lite  # opcional

# Cron
CRON_SECRET=tu_cron_secret_hex_64_chars

# Email (SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=465
SMTP_USER=apikey
SMTP_PASS=tu_sendgrid_api_key
SMTP_FROM="RSS Dashboard <noreply@tudominio.com>"

# VAPID (Push)
VAPID_PUBLIC_KEY=tu_vapid_public
VAPID_PRIVATE_KEY=tu_vapid_private
VAPID_SUBJECT=mailto:tu@email.com
```

**Validación en build/start:**
```javascript
// Validar que API_SECRET_KEY tenga >= 32 chars
// Validar que DB_* estén presentes
// Validar que IA_API_KEY o GROQ_API_KEY o GEMINI_API_KEY esté presente
```

---

### 3.2 Circuit Breaker para IA Providers
**Implementar en backend (igual que frontend):**
- Estados: CLOSED → OPEN → HALF_OPEN.
- Threshold: 3 fallos consecutivos.
- Reset: 60s.
- Failover automático: Gemini → Groq y viceversa.

---

### 3.3 Caché de Usuarios (45s TTL)
**Implementar en backend:**
- Caché en memoria para `GET /api/users?email=` y `GET /api/users/:id`.
- TTL: 45s.
- Invalidar en escrituras (POST/PATCH/DELETE).
- Previene martillar la BD en cada callback de sesión.

---

### 3.4 Anti-Enumeración en Recovery
**Ya documentado en CONTEXTO_FRONTEND.md:**
- Códigos 6 dígitos, 15 min, bloqueo a 5 intentos.
- Respuesta genérica: "Si el correo está registrado recibirás un código".
- No revelar si el email existe.

---

### 3.5 Borrado en Cascada
**Al borrar usuario (`DELETE /api/users/:id`):**
1. Borrar push subscriptions del usuario.
2. Borrar artículos del usuario.
3. Borrar fuentes del usuario.
4. Borrar usuario.
5. Todo en transacción (rollback si falla).

---

### 3.6 Bulk Operations Atómicas
**Borrado masivo de fuentes (`DELETE /api/data/fuentes?usuario_id=&ids=`):**
- Todo-o-nada en transacción.
- Si alguna fuente no existe o no pertenece al usuario → 404 con `{ faltan: [ids] }`, sin borrar nada.
- Si todas existen → 200 con `{ eliminadas, articulos_eliminados }`.

**Bulk PATCH (`PATCH /api/data/fuentes`):**
- `{ usuario_id, ids, convert_full_page }`.
- Mismo patrón: todo-o-nada.

---

### 3.7 Refresh Endpoint (Ingesta Real)
**El refresh debe:**
1. Leer fuentes del usuario desde BD.
2. Para cada fuente, hacer fetch del feed RSS (con SSRF guard).
3. Parsear RSS y extraer artículos nuevos.
4. Insertar artículos nuevos en BD (dedup por URL).
5. Clasificar artículos nuevos con IA (backend seeding: `local` + confianza real).
6. Reparar artículos en "General"/NULL (repararGenerales).
7. Devolver resumen con contadores exactos.

**SSRF Guard en backend (igual que frontend):**
- Validar protocolo http/https.
- Resolver DNS y verificar IP pública (no loopback, RFC1918, link-local, CGNAT, multicast, reservadas).
- Seguir redirects manualmente, revalidar cada salto.
- Limitar tamaño del body (8MB max).

---

### 3.8 Clasificación IA en Backend (Seeding)
**Al ingerir artículos:**
- Clasificar con IA (Gemini/Groq) o keyword fallback.
- Persistir `categoria`, `clasificacion_metodo` ('local'/'gemini'/'groq'/'manual'), `clasificacion_confianza`.
- `local` con categoría real → NO reprocesar en frontend.
- `General`/NULL → pendiente para frontend.

---

### 3.9 Push Notifications (VAPID)
**Implementar envío de push:**
- Usar `web-push` con VAPID keys.
- Al refresh con `nuevos > 0`, enviar push al usuario.
- Poda de suscripciones inválidas (404/410).

---

### 3.10 Cron Job (Backend o Frontend)
**El frontend tiene cron en Vercel (`/api/cron/refresh`).**
**Opción A:** Mantener en frontend (actual).
**Opción B:** Mover a backend (cron interno con node-cron).
**Recomendación:** Mantener en frontend (menos complejidad, Vercel maneja el scheduling).

---

## Contrato de Respuestas (Normalización)

### Formato de respuesta estándar:
```json
{
  "data": [...],        // o "users", "fuentes", "articulos", "articles"
  "total": 123,          // para paginación
  "page": 1,
  "limit": 30,
  "totalPages": 5,
  "hasMore": true
}
```

### Errores estándar:
```json
{
  "error": "mensaje legible",
  "code": "codigo_maquina"  // opcional
}
```

### Status codes:
- `200` → OK
- `201` → Created
- `400` → Bad Request (validación)
- `401` → Unauthorized (API key inválida o sesión expirada)
- `403` → Forbidden (sin permiso)
- `404` → Not Found
- `409` → Conflict (duplicado)
- `429` → Too Many Requests (rate limit)
- `500` → Internal Server Error
- `502/503/504` → Backend unavailable

---

## Diseño de Migración (Fases)

### Fase 1: Endpoints Faltantes (Blockers)
1. `POST /api/users` — Crear usuario (OAuth + registro).
2. `GET /api/users?email=` — Filtrado en SQL.
3. `GET /api/users/:id` — Por id.
4. `PATCH /api/users/:id` — Actualizar.
5. `DELETE /api/users/:id` — Borrar (cascada).

### Fase 2: Seguridad y Estabilidad
1. Rate limiting (express-rate-limit).
2. CORS estricto.
3. Helmet headers.
4. Validación de input (Zod/express-validator).
5. Health check endpoints.

### Fase 3: Contratos y Normalización
1. Verificar todos los endpoints contra el contrato §3.
2. Normalizar respuestas (data/total/page/limit/hasMore).
3. Verificar contadores (omitidas vs fuentes_sin_cambios).
4. Verificar bulk operations (atómicas, 404 con faltan).

### Fase 4: IA y Push
1. IA resumen endpoint (caché 24h).
2. IA progreso endpoint.
3. Push subscriptions CRUD.
4. VAPID envío.

### Fase 5: Optimización
1. Caché de usuarios (45s TTL).
2. Circuit breaker IA.
3. SSRF guard en refresh.
4. Borrado en cascada.

---

## Verificación (Solo Lectura al Frontend)

### Sondas al frontend (no mutar datos reales):
```bash
# Health check
curl https://rssdashboard.vercel.app/api/health

# Verificar endpoints (con IDs inexistentes)
curl -H "x-api-key: TU_KEY" https://tu-backend/api/users/999999
curl -H "x-api-key: TU_KEY" https://tu-backend/api/data/fuentes?usuario_id=999999

# Verificar rate limit
for i in $(seq 1 10); do curl -s -o /dev/null -w "%{http_code}\n" https://tu-backend/api/auth/login; done
```

### Build verification:
```bash
npm run lint    # 0 warnings
npm run build   # Compila sin errores
node --check src/**/*.js  # Sintaxis OK
```

---

## Lo No Evaluado (NOT ASSESSED)

- Infraestructura (UFW, Caddy, MySQL tuning).
- Backups y disaster recovery.
- Monitoreo (logs, alertas, APM).
- Escalabilidad (load testing, horizontal scaling).
- Multi-tenancy (si aplica).

---

## Prompt para Próxima Auditoría Backend

```
Audita el backend servxn-api (Node.js + MySQL 8.4) con scope Completo.
Enfoque: contratos API (endpoints faltantes, respuestas normalizadas), seguridad (rate-limit, CORS, helmet, validación), rendimiento (caché, bulk operations, SSRF guard), arquitectura (separación de capas, DDL, transacciones).

Usa skills: awesome-security-audit, awesome-architecture-audit, awesome-performance-audit, awesome-code-review.

Entrega: matriz + detalle + verdict tracks + prompt para próxima auditoría.

Contexto: el frontend lector-rss-next ya está actualizado. El backend debe alinearse con los contratos documentados en CONTEXTO_FRONTEND.md §3.
```

---

## Resumen de Cambios Requeridos

| # | Tarea | Prioridad | Estado |
|---|-------|-----------|--------|
| 1 | `POST /api/users` (crear usuario) | P1 — Blocker | ❌ Falta |
| 2 | `GET /api/users?email=` (filtrado SQL) | P1 — Blocker | ❌ Falta |
| 3 | `GET /api/users/:id` | P1 — Blocker | ❌ Falta |
| 4 | `PATCH /api/users/:id` | P1 — Blocker | ❌ Falta |
| 5 | `DELETE /api/users/:id` (cascada) | P1 — Blocker | ❌ Falta |
| 6 | Rate limiting (express-rate-limit) | P2 — Sprint | ❌ Falta |
| 7 | CORS estricto | P2 — Sprint | ❌ Falta |
| 8 | Helmet headers | P2 — Sprint | ❌ Falta |
| 9 | Validación input (Zod) | P2 — Sprint | ❌ Falta |
| 10 | Health check `/api/health/db` | P2 — Sprint | ❌ Falta |
| 11 | Verificar contratos §3 | P3 — Planificación | ⚠️ Parcial |
| 12 | Caché usuarios (45s TTL) | P3 — Planificación | ❌ Falta |
| 13 | Circuit breaker IA | P3 — Planificación | ❌ Falta |
| 14 | SSRF guard en refresh | P3 — Planificación | ❌ Falta |
| 15 | Borrado en cascada | P3 — Planificación | ❌ Falta |
| 16 | Bulk operations atómicas | P3 — Planificación | ⚠️ Parcial |

---

**Veredicto general:** El backend requiere implementación de **5 endpoints faltantes** (P1), **5 mejoras de seguridad** (P2) y **6 optimizaciones** (P3) para alinearse completamente con el frontend actualizado. Sin P1, el login OAuth falla (error 404 → AccessDenied).