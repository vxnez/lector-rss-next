-- =============================================================
-- 11_fuentes_convertidas.sql — Origen de la fuente (nativa o web→RSS)
-- Función: marcar las fuentes creadas por el motor de conversión
-- web → RSS (estilo RSS.app) para refrescarlas re-scrapeando la
-- página en vez de parsear un feed nativo. Comparten el mismo caché
-- condicional (etag / last_modified / ultima_revision).
-- Si la columna ya existe, MySQL devuelve error: es seguro ignorar
-- ese error puntual (ver 06_ensure_schema.sql).
-- Tablas: fuentes_rss
-- =============================================================

ALTER TABLE fuentes_rss
  ADD COLUMN origen VARCHAR(16) NOT NULL DEFAULT 'rss' COMMENT 'rss = feed nativo, web = página convertida por el motor web-RSS';
