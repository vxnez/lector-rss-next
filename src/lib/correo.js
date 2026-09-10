// src/lib/correo.js
// Envío de correos por SMTP (configurado para Gmail).
// Si faltan las variables SMTP_*, `smtpConfigurado` es false y el llamador
// puede usar el modo demostración (mostrar el código en pantalla).
import nodemailer from "nodemailer";

export function smtpConfigurado() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let transporter = null;

function obtenerTransporter() {
  if (transporter) return transporter;
  const puerto = Number(process.env.SMTP_PORT || "465");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: puerto,
    secure: puerto === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    },
  });
  return transporter;
}

export async function enviarCodigoRecuperacion(email, codigo, minutos = 15) {
  const remitente = process.env.SMTP_FROM || process.env.SMTP_USER;
  await obtenerTransporter().sendMail({
    from: remitente,
    to: email,
    subject: "Código de recuperación de contraseña",
    text: `Tu código de recuperación es: ${codigo}\nVálido por ${minutos} minutos.\nSi no lo solicitaste, ignora este correo.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0d1420; color: #e7edf5; border-radius: 12px;">
        <h2 style="margin: 0 0 8px;">Recuperación de contraseña</h2>
        <p style="color: #91a0b5; font-size: 14px;">Usa este código para restablecer tu contraseña. Válido por ${minutos} minutos.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #27a9e8; text-align: center; margin: 24px 0;">${codigo}</p>
        <p style="color: #91a0b5; font-size: 12px;">Si no solicitaste este código, ignora este correo.</p>
      </div>
    `,
  });
}
