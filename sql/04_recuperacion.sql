-- =============================================================
-- 04_recuperacion.sql — Códigos de recuperación de contraseña
-- Función: códigos temporales de 6 dígitos (guardados con hash)
-- para el flujo solicitar -> verificar -> restablecer.
-- Cada código expira a los 15 minutos y se bloquea tras 5
-- intentos fallidos. Se borran al usarse o al pedir uno nuevo.
-- Tablas: recuperacion_codigos
-- =============================================================

CREATE TABLE IF NOT EXISTS recuperacion_codigos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  codigo_hash VARCHAR(255) NOT NULL COMMENT 'Hash bcrypt del código de 6 dígitos',
  expira_en   DATETIME NOT NULL,
  intentos    INT NOT NULL DEFAULT 0,
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recuperacion_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
