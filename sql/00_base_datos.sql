-- =============================================================
-- 00_base_datos.sql — Base de datos del lector RSS
-- Función: crear la base de datos con el charset correcto.
-- Uso: mysql -h <host> -u <usuario> -p < 00_base_datos.sql
-- =============================================================
CREATE DATABASE IF NOT EXISTS lector_rss
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lector_rss;
