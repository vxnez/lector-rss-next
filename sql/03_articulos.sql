-- =============================================================
-- 03_articulos.sql — Artículos publicados
-- Función: noticias descargadas de cada fuente, con su categoría
-- (manual o por IA), estado de lectura/guardado y descarte lógico.
-- La unicidad es por par (fuente, URL): la misma noticia puede
-- existir en varias fuentes sin chocar.
-- Tablas: articulos_publicados
-- =============================================================

CREATE TABLE IF NOT EXISTS articulos_publicados (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  fuente_id               INT NOT NULL,
  titulo                  VARCHAR(500) NOT NULL,
  resumen                 TEXT NULL,
  url_original            VARCHAR(500) NOT NULL,
  fecha_publicacion       DATETIME NOT NULL,
  categoria               VARCHAR(100) NOT NULL DEFAULT 'General',
  clasificacion_metodo    VARCHAR(20) NOT NULL DEFAULT 'sin-ia' COMMENT 'sin-ia | gemini | manual',
  clasificacion_confianza DECIMAL(4,3) NOT NULL DEFAULT 0.500,
  imagen_url              VARCHAR(500) NULL,
  leido                   TINYINT(1) NOT NULL DEFAULT 0,
  guardado                TINYINT(1) NOT NULL DEFAULT 0,
  descartado              TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Borrado lógico (se puede restaurar)',
  creado_en               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_articulos_fuente FOREIGN KEY (fuente_id)
    REFERENCES fuentes_rss (id) ON DELETE CASCADE,
  UNIQUE KEY unique_fuente_url (fuente_id, url_original)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Nota: la FK crea automáticamente el índice sobre fuente_id.
