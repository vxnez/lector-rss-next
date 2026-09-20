// src/app/api/auth/register/route.js — Alta vía API interna (sin MySQL directo).
import { createUser, getUserByEmail } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { nombre, email, password } = await req.json();

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 6 caracteres" },
        { status: 400 }
      );
    }

    const existente = await getUserByEmail(email, { force: true }).catch(() => null);
    if (existente) {
      return NextResponse.json({ error: "El correo ya está registrado" }, { status: 400 });
    }

    await createUser({ nombre, email, password });

    return NextResponse.json({ message: "Usuario creado exitosamente" }, { status: 201 });
  } catch (error) {
    console.error("Error en registro vía API:", error?.message || error);
    const status = Number(error?.status) || 500;
    if (status === 400 || status === 409) {
      return NextResponse.json({ error: error.message || "El correo ya está registrado" }, { status });
    }
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
