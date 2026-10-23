// src/app/api/auth/register/route.js — Alta vía API interna (sin MySQL directo).
import { createUser, getUserByEmail } from "@/lib/api";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp, createRateLimitHeaders } from "@/lib/rateLimit";

export async function POST(req) {
  // Rate limiting por IP: 5 req/min
  const ip = getClientIp(req);
  const rl = rateLimit(ip, { max: 5, windowMs: 60_000 });
  const headers = createRateLimitHeaders(rl);

  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos. Intente de nuevo en un minuto." },
      { status: 429, headers }
    );
  }

  try {
    const { nombre, email, password } = await req.json();

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400, headers });
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400, headers }
      );
    }

    const existente = await getUserByEmail(email, { force: true }).catch(() => null);
    if (existente) {
      return NextResponse.json({ error: "El correo ya está registrado" }, { status: 400, headers });
    }

    await createUser({ nombre, email, password });

    return NextResponse.json({ message: "Usuario creado exitosamente" }, { status: 201, headers });
  } catch (error) {
    console.error("Error en registro vía API:", error?.message || error);
    const status = Number(error?.status) || 500;
    if (status === 400 || status === 409) {
      return NextResponse.json({ error: error.message || "El correo ya está registrado" }, { status, headers });
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500, headers });
  }
}
