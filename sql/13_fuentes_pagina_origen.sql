-- =============================================================
-- 13_fuentes_pagina_origen.sql — URL de página original por fuente
-- Función: conservar la URL que el usuario pegó al dar de alta la fuente
-- (p. ej. https://github.blog/developer-skills/) para que el interruptor
-- convert_full_page pueda crawlear la página HTML aunque url_feed apunte
-- al feed XML descubierto (p. ej. https://github.blog/feed/).
-- Sin esta columna, activar el flag en una fuente ya registrada intentaba
-- convertir el XML del feed como si fuera HTML y devolvía "sin cambios".
-- Si la columna ya existe, MySQL devuelve error: es seguro ignorar
-- ese error puntual (ver 06_ensure_schema.sql).
-- Tablas: fuentes_rss
-- =============================================================

ALTER TABLE fuentes_rss
  ADD COLUMN pagina_origen VARCHAR(1000) NULL COMMENT 'URL de página ingresada por el usuario (para crawler full-page)';
