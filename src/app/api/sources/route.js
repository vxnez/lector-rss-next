// src/app/api/sources/route.js
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolverUsuarioId } from "@/lib/invitado";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);

    const [rows] = await db.query(
      `SELECT
         f.id,
         f.titulo,
         f.url_feed,
         f.categoria,
         f.creado_en,
         COUNT(a.id) AS articulos_count,
         MAX(a.fecha_publicacion) AS ultima_actualizacion,
         'activa' AS estado
       FROM fuentes_rss f
       LEFT JOIN articulos_publicados a ON a.fuente_id = f.id AND (a.descartado = 0 OR a.descartado IS NULL)
       WHERE f.usuario_id = ?
       GROUP BY f.id, f.titulo, f.url_feed, f.categoria, f.creado_en
       ORDER BY f.id DESC`,
      [userId]
    );

    return NextResponse.json(rows, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Error en GET /api/sources:", error);
    return NextResponse.json({ error: "Error al obtener fuentes" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);

    const { titulo, url_feed, categoria } = await req.json();

    if (!titulo || !url_feed) {
      return NextResponse.json({ error: "Faltan datos obligatorios (título y url_feed)" }, { status: 400 });
    }

    let sanitizedUrl;
    try {
      const parsedUrl = new URL(url_feed.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: "Protocolo no válido" }, { status: 400 });
      }
      sanitizedUrl = parsedUrl.toString();
    } catch (e) {
      return NextResponse.json({ error: "URL mal formada" }, { status: 400 });
    }

    const [result] = await db.query(
      "INSERT INTO fuentes_rss (usuario_id, titulo, url_feed, categoria, creado_en) VALUES (?, ?, ?, ?, NOW())",
      [userId, titulo.trim(), sanitizedUrl, (categoria || "General").trim()]
    );

    return NextResponse.json({ message: "Fuente agregada correctamente", id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/sources:", error);
    return NextResponse.json({ error: "Error al agregar fuente" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);

    const { id, titulo, url_feed, categoria } = await req.json();

    if (!id || !titulo || !url_feed) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    let sanitizedUrl;
    try {
      const parsedUrl = new URL(url_feed.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return NextResponse.json({ error: "Protocolo no válido" }, { status: 400 });
      }
      sanitizedUrl = parsedUrl.toString();
    } catch (e) {
      return NextResponse.json({ error: "URL mal formada" }, { status: 400 });
    }

    const [result] = await db.query(
      "UPDATE fuentes_rss SET titulo = ?, url_feed = ?, categoria = ? WHERE id = ? AND usuario_id = ?",
      [titulo.trim(), sanitizedUrl, (categoria || "General").trim(), id, userId]
    );

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
    }

    return NextResponse.json({ message: "Fuente actualizada" });
  } catch (error) {
    console.error("Error en PUT /api/sources:", error);
    return NextResponse.json({ error: "Error al actualizar fuente" }, { status: 500 });
  }
}

export async function DELETE(req) {
  let connection;
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID de fuente requerido" }, { status: 400 });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    await connection.query(
      `DELETE a FROM articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       WHERE a.fuente_id = ? AND f.usuario_id = ?`,
      [id, userId]
    );

    const [result] = await connection.query(
      "DELETE FROM fuentes_rss WHERE id = ? AND usuario_id = ?",
      [id, userId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
    }

    await connection.commit();
    return NextResponse.json({ message: "Fuente y artículos eliminados correctamente" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error en DELETE /api/sources:", error);
    return NextResponse.json({ error: "Error al eliminar fuente" }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}