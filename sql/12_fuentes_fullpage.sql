-- =============================================================
-- 12_fuentes_fullpage.sql — Interruptor "convertir página completa" por fuente
-- Función: permitir que cada fuente RSS tenga un flag booleano
-- convert_full_page (0/1) para que el refresco invoque el motor de
-- paginación/crawler completo (convertirPaginaAFeed) bajo demanda,
-- en lugar de la extracción estándar limitada a la primera página.
-- Si la columna ya existe, MySQL devuelve error: es seguro ignorar
-- ese error puntual (ver 06_ensure_schema.sql).
-- Tablas: fuentes_rss
-- =============================================================

ALTER TABLE fuentes_rss
  ADD COLUMN convert_full_page TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = refrescar con crawler multipágina completo, 0 = extracción estándar';
