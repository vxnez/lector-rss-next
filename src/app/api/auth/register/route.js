// src/app/api/auth/register/route.js
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { nombre, email, password } = await req.json();

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    // Verificar si el usuario ya existe
    const [existingUsers] = await db.query("SELECT id FROM usuarios WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
      return NextResponse.json({ error: "El correo ya está registrado" }, { status: 400 });
    }

    // Encriptar contraseña e insertar en MySQL Aiven
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO usuarios (nombre, email, password_hash, proveedor) VALUES (?, ?, ?, 'credentials')",
      [nombre, email, hashedPassword]
    );

    return NextResponse.json({ message: "Usuario creado exitosamente" }, { status: 201 });
  } catch (error) {
    console.error("Error en registro:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}