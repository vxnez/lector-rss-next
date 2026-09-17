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
  let conexion;
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Borrado permanente ATÓMICO: una sola transacción que elimina la cuenta
    // y todos sus registros asociados. El borrado es explícito (no depende
    // solo del ON DELETE CASCADE) para que ni en BDs antiguas sin FK ni en
    // tablas sin FK (recuperacion_codigos, keyed por email) queden huérfanos
    // que un re-registro con el mismo correo pudiera heredar.
    conexion = await db.getConnection();
    await conexion.beginTransaction();

    const [[cuenta]] = await conexion.query(
      "SELECT id, email FROM usuarios WHERE id = ? FOR UPDATE",
      [userId]
    );
    if (!cuenta) {
      await conexion.rollback();
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // 1) Notificaciones push del usuario (UNIQUE global por endpoint: una
    //    fila huérfana revincularía el endpoint al re-registro vía upsert).
    await conexion.query("DELETE FROM push_subscriptions WHERE usuario_id = ?", [userId]);
    // 2) Artículos de sus fuentes (vía JOIN, sin depender de la cascada).
    await conexion.query(
      `DELETE a FROM articulos_publicados a
        INNER JOIN fuentes_rss f ON a.fuente_id = f.id
        WHERE f.usuario_id = ?`,
      [userId]
    );
    // 3) Fuentes RSS de la cuenta.
    await conexion.query("DELETE FROM fuentes_rss WHERE usuario_id = ?", [userId]);
    // 4) Códigos de recuperación (keyed por email, sin FK): se borran aquí
    //    para que un re-registro no herede códigos válidos de la cuenta vieja.
    if (cuenta.email) {
      try {
        await conexion.query("DELETE FROM recuperacion_codigos WHERE email = ?", [cuenta.email]);
      } catch {
        // Tabla inexistente en BDs antiguas: no bloquea el borrado.
      }
    }
    // 5) La cuenta. La cascada FK (fuentes/push) queda como red de seguridad.
    await conexion.query("DELETE FROM usuarios WHERE id = ?", [userId]);

    await conexion.commit();
    return NextResponse.json({ message: "Cuenta y datos eliminados" });
  } catch (error) {
    try {
      await conexion?.rollback();
    } catch {
      // El rollback no debe ocultar el error original.
    }
    console.error("Error al eliminar datos:", error);
    return NextResponse.json({ error: "Error al eliminar datos" }, { status: 500 });
  } finally {
    try {
      conexion?.release();
    } catch {
      // Conexión ya liberada o inválida.
    }
  }
}
