// src/app/api/bienvenida/route.js
// Marca la bienvenida como vista vía API interna (PATCH /api/users/:id).
// Los invitados no tienen sesión real: 401.
import { auth } from "@/auth";
import { patchUser } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    try {
      await patchUser(userId, { bienvenida_vista: 1 });
    } catch (error) {
      // Backend sin la columna/campo: no bloquea al cliente.
      console.warn("Bienvenida no persistida en backend:", error?.message || error);
      return NextResponse.json({ message: "Sin columna de bienvenida" });
    }
    return NextResponse.json({ message: "Bienvenida marcada como vista" });
  } catch (error) {
    console.error("Error en POST /api/bienvenida vía API:", error?.message || error);
    return NextResponse.json({ error: "Error al marcar la bienvenida" }, { status: 500 });
  }
}
