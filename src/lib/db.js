// src/lib/db.js
import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  ssl: {
    rejectUnauthorized: false
  }
});

// Flag de bienvenida/onboarding por usuario (0 = pendiente, 1 = vista).
// Las BDs antiguas no tienen la columna: se crea bajo demanda con el mismo
// patrón de ensure* del resto del proyecto (promesa cacheada, un solo intento
// por vida del servidor). Las filas que ya existían se marcan como vistas
// para no molestar a usuarios antiguos; solo las cuentas creadas después
// (DEFAULT 0) o revinculadas con un proveedor nuevo la tienen pendiente.
let bienvenidaSchemaPromise;

export async function ensureBienvenidaSchema() {
  if (!bienvenidaSchemaPromise) {
    bienvenidaSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'usuarios'
           AND COLUMN_NAME = 'bienvenida_vista'`
      );
      if (columns.length === 0) {
        await db.query(
          "ALTER TABLE usuarios ADD COLUMN bienvenida_vista TINYINT(1) NOT NULL DEFAULT 0"
        );
        // Solo cuentas preexistentes (no las recién creadas en este momento).
        await db.query(
          "UPDATE usuarios SET bienvenida_vista = 1 WHERE creado_en < DATE_SUB(NOW(), INTERVAL 10 MINUTE)"
        );
      }
    })().catch((error) => {
      bienvenidaSchemaPromise = undefined;
      throw error;
    });
  }
  return bienvenidaSchemaPromise;
}