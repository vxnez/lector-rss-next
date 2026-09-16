-- =============================================================
-- 01_usuarios.sql — Identidad y autenticación
-- Función: cuentas de usuario (credenciales, OAuth e invitados
-- temporales) con su hash de contraseña y datos de perfil.
-- Tablas: usuarios
-- =============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(150) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL COMMENT 'NULL en cuentas OAuth (Google/GitHub)',
  imagen_url    TEXT NULL,
  proveedor     VARCHAR(50) NOT NULL DEFAULT 'credentials' COMMENT 'CSV de metodos vinculados: credentials | google | github | invitado (p. ej. credentials,google)',
  genero        VARCHAR(20) NULL,
  bienvenida_vista TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0 = mostrar bienvenida (cuenta nueva o proveedor OAuth recién vinculado), 1 = ya vista',
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
