-- =============================================================
-- 07_push.sql — Suscripciones Web Push por usuario
-- Función: endpoints de notificación (VAPID) para avisar de
-- noticias nuevas tras cada refresco o cron.
-- Tablas: push_subscriptions
-- =============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL COMMENT 'Dueño de la suscripción (incluye invitados)',
  endpoint    VARCHAR(1000) NOT NULL,
  p256dh      VARCHAR(255) NOT NULL,
  auth        VARCHAR(255) NOT NULL,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_push_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE,
  UNIQUE KEY unique_endpoint (endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
