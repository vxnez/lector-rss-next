-- =============================================================
-- 08_bienvenida.sql — Flag de bienvenida/onboarding por usuario
-- Función: que el primer login con Google/GitHub (cuenta nueva o
-- proveedor recién vinculado) muestre la bienvenida aunque el
-- localStorage por email ya existiera en ese navegador.
-- Si la columna ya existe, MySQL devuelve error: es seguro ignorar
-- ese error puntual (ver 06_ensure_schema.sql).
-- Tablas: usuarios
-- =============================================================

ALTER TABLE usuarios
  ADD COLUMN bienvenida_vista TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = mostrar bienvenida (cuenta nueva o proveedor OAuth recién vinculado), 1 = ya vista';

-- Las cuentas preexistentes ya pasaron su momento de bienvenida.
UPDATE usuarios SET bienvenida_vista = 1;
