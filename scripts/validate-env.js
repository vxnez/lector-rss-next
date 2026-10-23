// scripts/validate-env.js — Validación estricta de variables de entorno en build time.
// Falla el build si faltan variables críticas para producción.
const REQUIRED_PROD = [
  "API_URL",
  "API_SECRET_KEY",
  "AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_ID",
  "GITHUB_SECRET",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "IA_API_KEY",
  "IA_PROVEEDOR",
];

const OPTIONAL = [
  "CRON_SECRET",
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "IA_MODELOS",
];

function validate() {
  const missing = [];
  const isProd = process.env.NODE_ENV === "production";

  for (const key of REQUIRED_PROD) {
    const val = process.env[key];
    if (!val || val.trim() === "") {
      if (isProd || key === "AUTH_SECRET" || key === "API_SECRET_KEY" || key === "API_URL") {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    console.error("❌ Variables de entorno requeridas faltantes:");
    for (const key of missing) {
      console.error(`   - ${key}`);
    }
    console.error("\nConfigúralas en Vercel (Project Settings → Environment Variables) o en .env.local");
    process.exit(1);
  }

  // Validaciones de formato
  const authSecret = process.env.AUTH_SECRET;
  if (authSecret && authSecret.length < 32) {
    console.warn("⚠️ AUTH_SECRET debería tener al menos 32 caracteres para seguridad adecuada");
  }

  const apiSecret = process.env.API_SECRET_KEY;
  if (apiSecret && (apiSecret.startsWith('"') || apiSecret.startsWith("'"))) {
    console.warn("⚠️ API_SECRET_KEY parece tener comillas envolventes; api.js las quita pero verifica en Vercel");
  }

  console.log("✅ Validación de variables de entorno OK");
}

validate();