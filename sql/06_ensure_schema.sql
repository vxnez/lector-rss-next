-- =============================================================
-- 06_ensure_schema.sql — Migración canónica (antes DDL en hot path)
-- Función: llevar BDs antiguas al esquema actual sin depender de los
-- ensure* de src/app/api/rss/route.js (que solo quedan como red de
-- seguridad en cold start y están cacheados por promesa).
-- Si una columna/índice ya existe, MySQL devuelve error: es seguro
-- ignorar ese error puntual y seguir con la siguiente sentencia.
-- Tablas: articulos_publicados, fuentes_rss
-- =============================================================

-- 1) Columnas de clasificación e imagen (ensureClassificationSchema)
ALTER TABLE articulos_publicados
  ADD COLUMN clasificacion_metodo VARCHAR(20) NOT NULL DEFAULT 'sin-ia';
ALTER TABLE articulos_publicados
  ADD COLUMN clasificacion_confianza DECIMAL(4,3) NOT NULL DEFAULT 0.500;
ALTER TABLE articulos_publicados
  ADD COLUMN imagen_url VARCHAR(500) NULL;

-- 2) Validadores de caché HTTP por fuente (ensureFuentesCacheSchema)
ALTER TABLE fuentes_rss
  ADD COLUMN etag VARCHAR(255) NULL;
ALTER TABLE fuentes_rss
  ADD COLUMN last_modified VARCHAR(255) NULL;
ALTER TABLE fuentes_rss
  ADD COLUMN ultima_revision DATETIME NULL;

-- 3) Unicidad por par (fuente, URL) (ensureArticulosUnicidad)
-- Si existe el índice global antiguo, eliminarlo primero:
-- ALTER TABLE articulos_publicados DROP INDEX unique_url;
ALTER TABLE articulos_publicados
  ADD UNIQUE KEY unique_fuente_url (fuente_id, url_original);

-- 4) Índices del feed paginado (ver 05_paginacion.sql)
CREATE INDEX idx_articulos_feed
  ON articulos_publicados (descartado, fecha_publicacion DESC, id DESC);
CREATE INDEX idx_articulos_fuente_fecha
  ON articulos_publicados (fuente_id, fecha_publicacion DESC, id DESC);
