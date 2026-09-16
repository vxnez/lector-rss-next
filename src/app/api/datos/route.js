// src/app/api/datos/route.js — Privacidad: exportar y eliminar los datos propios.
// Solo sesión real (como /api/perfil); invitados usan salir (efímero).
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [[usuario]] = await db.query(
      "SELECT id, nombre, email, proveedor, genero, creado_en FROM usuarios WHERE id = ?",
      [userId]
    );
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const [fuentes] = await db.query(
      "SELECT id, titulo, url_feed, categoria, creado_en FROM fuentes_rss WHERE usuario_id = ? ORDER BY id",
      [userId]
    );
    const [articulos] = await db.query(
      `SELECT a.id, a.fuente_id, a.titulo, a.resumen, a.url_original, a.fecha_publicacion,
              a.categoria, a.leido, a.guardado
       FROM articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       WHERE f.usuario_id = ?
       ORDER BY a.id`,
      [userId]
    );
    return NextResponse.json({
      exportado_en: new Date().toISOString(),
      usuario,
      fuentes,
      articulos,
    });
  } catch (error) {
    console.error("Error al exportar datos:", error);
    return NextResponse.json({ error: "Error al exportar datos" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Cascada por FK: fuentes, artículos, suscripciones push y perfil.
    // Los códigos de recuperación apuntan por email (sin FK): se borran
    // aparte para no dejar ningún rastro de la cuenta.
    const [[cuenta]] = await db.query("SELECT email FROM usuarios WHERE id = ?", [userId]);
    if (cuenta?.email) {
      await db.query("DELETE FROM recuperacion_codigos WHERE email = ?", [cuenta.email]).catch(() => {
        // Tabla inexistente en BDs antiguas: no bloquea el borrado.
      });
    }
    await db.query("DELETE FROM usuarios WHERE id = ?", [userId]);
    return NextResponse.json({ message: "Cuenta y datos eliminados" });
  } catch (error) {
    console.error("Error al eliminar datos:", error);
    return NextResponse.json({ error: "Error al eliminar datos" }, { status: 500 });
  }
}
