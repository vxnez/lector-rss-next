// src/app/api/bienvenida/route.js
// Marca la bienvenida/onboarding como vista para la cuenta actual.
// El cliente la llama al completar la encuesta; hasta entonces la sesión
// expone bienvenidaVista = 0 y la página muestra la bienvenida aunque el
// localStorage por email ya existiera (p. ej. primer login con Google/GitHub
// en una cuenta vinculada). Los invitados no tienen sesión real: 401.
import { auth } from "@/auth";
import { db, ensureBienvenidaSchema } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    try {
      await ensureBienvenidaSchema();
    } catch {
      // Si la columna no existe, no hay nada que marcar.
      return NextResponse.json({ message: "Sin columna de bienvenida" });
    }
    try {
      await db.query("UPDATE usuarios SET bienvenida_vista = 1 WHERE id = ?", [userId]);
    } catch (error) {
      if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
      return NextResponse.json({ message: "Sin columna de bienvenida" });
    }
    return NextResponse.json({ message: "Bienvenida marcada como vista" });
  } catch (error) {
    console.error("Error en POST /api/bienvenida:", error);
    return NextResponse.json({ error: "Error al marcar la bienvenida" }, { status: 500 });
  }
}
