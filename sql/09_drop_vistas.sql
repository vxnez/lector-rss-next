-- =============================================================
-- 09_drop_vistas.sql — Retira la feature de vistas guardadas
-- Elimina la tabla vistas_guardadas (creada por el antiguo
-- 08_vistas.sql) en BDs que ya la tengan. Sin efecto si no existe.
-- =============================================================

DROP TABLE IF EXISTS vistas_guardadas;
