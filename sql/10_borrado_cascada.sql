-- =============================================================
-- 10_borrado_cascada.sql — Verificación del borrado en cascada
-- Función: garantizar que eliminar un usuario no deje registros
-- huérfanos que un re-registro con el mismo correo pudiera heredar
-- (fuentes, artículos, push). El endpoint DELETE /api/datos ya borra
-- explícito en transacción; estas FK quedan como red de seguridad.
-- Si una restricción ya existe, MySQL devuelve error: es seguro
-- ignorar ese error puntual y seguir (ver 06_ensure_schema.sql).
-- Tablas: fuentes_rss, articulos_publicados, push_subscriptions
-- =============================================================

-- 1) Fuentes del usuario: al borrar la cuenta se borran sus suscripciones.
-- Si la FK ya existe con otro nombre, crearla con el canónico tras
-- eliminar la previa (descomentar solo en ese caso):
-- ALTER TABLE fuentes_rss DROP FOREIGN KEY fk_fuentes_usuario;
ALTER TABLE fuentes_rss
  ADD CONSTRAINT fk_fuentes_usuario FOREIGN KEY (usuario_id)
  REFERENCES usuarios (id) ON DELETE CASCADE;

-- 2) Artículos de cada fuente: al borrar la fuente se borran sus noticias.
-- ALTER TABLE articulos_publicados DROP FOREIGN KEY fk_articulos_fuente;
ALTER TABLE articulos_publicados
  ADD CONSTRAINT fk_articulos_fuente FOREIGN KEY (fuente_id)
  REFERENCES fuentes_rss (id) ON DELETE CASCADE;

-- 3) Suscripciones push del usuario: al borrar la cuenta se revocan sus
-- dispositivos (el endpoint es UNIQUE global: una fila huérfana
-- revincularía el endpoint al re-registro vía upsert).
-- ALTER TABLE push_subscriptions DROP FOREIGN KEY fk_push_usuario;
ALTER TABLE push_subscriptions
  ADD CONSTRAINT fk_push_usuario FOREIGN KEY (usuario_id)
  REFERENCES usuarios (id) ON DELETE CASCADE;

-- 4) Códigos de recuperación (keyed por email, sin FK posible): no hay
-- restricción que crear; el borrado va en la transacción de
-- DELETE /api/datos junto a la cuenta. Sin filas huérfanas.
