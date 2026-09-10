-- =============================================================
-- 02_fuentes_rss.sql — Fuentes RSS por usuario
-- Función: suscripciones RSS de cada cuenta, con validadores de
-- caché HTTP (etag / last_modified) para no re-descargar feeds
-- sin cambios.
-- Tablas: fuentes_rss
-- =============================================================

CREATE TABLE IF NOT EXISTS fuentes_rss (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id      INT NOT NULL COMMENT 'Dueño de la suscripción (incluye invitados)',
  titulo          VARCHAR(255) NOT NULL,
  url_feed        VARCHAR(1000) NOT NULL,
  categoria       VARCHAR(100) NOT NULL DEFAULT 'General',
  etag            VARCHAR(255) NULL COMMENT 'Validador de caché HTTP del feed',
  last_modified   VARCHAR(255) NULL COMMENT 'Validador de caché HTTP del feed',
  ultima_revision DATETIME NULL COMMENT 'Última vez que se revisó el feed',
  creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fuentes_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Nota: la FK crea automáticamente el índice sobre usuario_id.
