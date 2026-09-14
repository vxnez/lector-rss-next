-- =============================================================
-- 08_vistas.sql — Vistas guardadas (combinaciones de filtros)
-- Función: cada usuario guarda sus combinaciones favoritas de
-- pestaña + orden + categorías + fuentes + búsqueda como JSON.
-- Tablas: vistas_guardadas
-- =============================================================

CREATE TABLE IF NOT EXISTS vistas_guardadas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL COMMENT 'Dueño de la vista (incluye invitados)',
  nombre      VARCHAR(100) NOT NULL,
  config      JSON NOT NULL COMMENT '{tab, orden, categorias[], fuentes[], q}',
  creado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vistas_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuarios (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
