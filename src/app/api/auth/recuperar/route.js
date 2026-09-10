// src/app/api/auth/recuperar/route.js
// Flujo de recuperación de contraseña en 3 pasos:
// solicitar (genera código de 6 dígitos) -> verificar (valida el código) -> restablecer (nueva contraseña).
// La tabla se crea de forma idempotente para no requerir migraciones manuales.
import { db } from "@/lib/db";
import { enviarCodigoRecuperacion, smtpConfigurado } from "@/lib/correo";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";

const EXPIRACION_MINUTOS = 15;
const MAX_INTENTOS = 5;

async function asegurarTabla() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS recuperacion_codigos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      codigo_hash VARCHAR(255) NOT NULL,
      expira_en DATETIME NOT NULL,
      intentos INT NOT NULL DEFAULT 0,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_recuperacion_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

function generarCodigo() {
  return String(crypto.randomInt(100000, 1000000));
}

async function obtenerCodigoVigente(email) {
  const [rows] = await db.query(
    "SELECT * FROM recuperacion_codigos WHERE email = ? AND expira_en > NOW() ORDER BY creado_en DESC LIMIT 1",
    [email]
  );
  return rows[0] || null;
}

export async function POST(req) {
  try {
    const { action, email, codigo, password } = await req.json();
    await asegurarTabla();

    if (action === "solicitar") {
      const correo = String(email || "").trim();
      if (!correo) {
        return NextResponse.json({ error: "El correo electrónico es obligatorio." }, { status: 400 });
      }
      const [usuarios] = await db.query("SELECT id, password_hash FROM usuarios WHERE email = ?", [correo]);
      const usuario = usuarios[0];
      // Respuesta genérica si no existe o es cuenta OAuth sin contraseña.
      if (!usuario || !usuario.password_hash) {
        return NextResponse.json({
          ok: true,
          mensaje: "Si el correo está registrado recibirás un código de recuperación.",
        });
      }
      await db.query("DELETE FROM recuperacion_codigos WHERE email = ?", [correo]);
      const codigoPlano = generarCodigo();
      const codigoHash = await bcrypt.hash(codigoPlano, 10);
      await db.query(
        "INSERT INTO recuperacion_codigos (email, codigo_hash, expira_en) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))",
        [correo, codigoHash, EXPIRACION_MINUTOS]
      );
      // Sin SMTP configurado: modo demostración (se devuelve el código).
      if (!smtpConfigurado()) {
        console.warn("SMTP sin configurar: el código de recuperación se devuelve en modo demostración.");
        return NextResponse.json({
          ok: true,
          codigo: codigoPlano,
          expiraMinutos: EXPIRACION_MINUTOS,
          mensaje: "Código de recuperación generado.",
        });
      }
      try {
        await enviarCodigoRecuperacion(correo, codigoPlano, EXPIRACION_MINUTOS);
      } catch (error) {
        console.error("Error al enviar el correo de recuperación:", error);
        await db.query("DELETE FROM recuperacion_codigos WHERE email = ?", [correo]);
        return NextResponse.json(
          { error: "No se pudo enviar el correo. Inténtalo de nuevo." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        ok: true,
        expiraMinutos: EXPIRACION_MINUTOS,
        mensaje: `Hemos enviado un código de recuperación a ${correo}. Revisa tu bandeja (y el spam).`,
      });
    }

    if (action === "verificar") {
      const correo = String(email || "").trim();
      const codigoPlano = String(codigo || "").trim();
      if (!correo || !codigoPlano) {
        return NextResponse.json({ error: "El correo y el código son obligatorios." }, { status: 400 });
      }
      const registro = await obtenerCodigoVigente(correo);
      if (!registro) {
        return NextResponse.json(
          { error: "El código es inválido o ha expirado. Solicita uno nuevo." },
          { status: 400 }
        );
      }
      if (Number(registro.intentos) >= MAX_INTENTOS) {
        await db.query("DELETE FROM recuperacion_codigos WHERE email = ?", [correo]);
        return NextResponse.json(
          { error: "Demasiados intentos. Solicita un código nuevo." },
          { status: 429 }
        );
      }
      const coincide = await bcrypt.compare(codigoPlano, registro.codigo_hash);
      if (!coincide) {
        await db.query("UPDATE recuperacion_codigos SET intentos = intentos + 1 WHERE id = ?", [registro.id]);
        return NextResponse.json({ error: "El código ingresado no es correcto." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, mensaje: "Código verificado correctamente." });
    }

    if (action === "restablecer") {
      const correo = String(email || "").trim();
      const codigoPlano = String(codigo || "").trim();
      const nueva = String(password || "");
      if (!correo || !codigoPlano || !nueva) {
        return NextResponse.json({ error: "Todos los campos son obligatorios." }, { status: 400 });
      }
      if (nueva.length < 6) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 6 caracteres." },
          { status: 400 }
        );
      }
      const registro = await obtenerCodigoVigente(correo);
      if (!registro) {
        return NextResponse.json(
          { error: "El código es inválido o ha expirado. Solicita uno nuevo." },
          { status: 400 }
        );
      }
      const coincide = await bcrypt.compare(codigoPlano, registro.codigo_hash);
      if (!coincide) {
        return NextResponse.json({ error: "El código ingresado no es correcto." }, { status: 400 });
      }
      const hash = await bcrypt.hash(nueva, 10);
      await db.query("UPDATE usuarios SET password_hash = ? WHERE email = ?", [hash, correo]);
      await db.query("DELETE FROM recuperacion_codigos WHERE email = ?", [correo]);
      return NextResponse.json({ ok: true, mensaje: "Contraseña restablecida correctamente." });
    }

    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    console.error("Error en recuperación de contraseña:", error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
