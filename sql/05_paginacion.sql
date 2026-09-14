-- =============================================================
-- 05_paginacion.sql — Índices para feed paginado
-- Función: acelerar GET /api/rss?limit=&offset= (ORDER BY
-- fecha_publicacion DESC, id DESC filtrando descartados).
-- Tablas: articulos_publicados
-- =============================================================

-- Si el índice ya existe, MySQL devuelve error: es seguro ignorarlo.
CREATE INDEX idx_articulos_feed
  ON articulos_publicados (descartado, fecha_publicacion DESC, id DESC);

CREATE INDEX idx_articulos_fuente_fecha
  ON articulos_publicados (fuente_id, fecha_publicacion DESC, id DESC);
