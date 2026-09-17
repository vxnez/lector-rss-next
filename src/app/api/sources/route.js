// src/app/api/sources/route.js
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolverUsuarioId } from "@/lib/invitado";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    let rows;
    try {
      [rows] = await db.query(
        `SELECT
          f.id,
          f.titulo,
          f.url_feed,
          f.categoria,
          f.creado_en,
          f.convert_full_page,
          COUNT(a.id) AS articulos_count,
          MAX(a.fecha_publicacion) AS ultima_actualizacion,
          'activa' AS estado
        FROM fuentes_rss f
        LEFT JOIN articulos_publicados a ON a.fuente_id = f.id AND (a.descartado = 0 OR a.descartado IS NULL)
        WHERE f.usuario_id = ?
        GROUP BY f.id, f.titulo, f.url_feed, f.categoria, f.creado_en, f.convert_full_page
        ORDER BY f.id DESC`,
        [userId]
      );
    } catch (error) {
      // BD sin migrar (sin convert_full_page): listado sin el flag.
      if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
      [rows] = await db.query(
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
    }

    const normalizadas = (rows || []).map((f) => ({
      ...f,
      convertFullPage: Number(f.convert_full_page) === 1,
    }));

    return NextResponse.json(normalizadas, {
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
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

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
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id, titulo, url_feed, categoria, convertFullPage, convert_full_page } = await req.json();

    // Interruptor por fuente: acepta camelCase (frontend) o snake_case.
    // undefined = no tocar (ediciones antiguas), true/false = persistir.
    const flagRaw = convertFullPage !== undefined ? convertFullPage : convert_full_page;
    const flag = flagRaw === undefined || flagRaw === null ? undefined : (flagRaw === true || flagRaw === 1 || flagRaw === "1" ? 1 : 0);

    // Actualización parcial solo del interruptor (toggle rápido sin editar título/URL).
    if ((!titulo || !url_feed) && flag !== undefined && id) {
      try {
        const [parcial] = await db.query(
          "UPDATE fuentes_rss SET convert_full_page = ? WHERE id = ? AND usuario_id = ?",
          [flag, id, userId]
        );
        if (parcial.affectedRows === 0) {
          return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
        }
        return NextResponse.json({ message: "Fuente actualizada", convertFullPage: flag === 1 });
      } catch (error) {
        if (error?.code === "ER_BAD_FIELD_ERROR") {
          try {
            await db.query("ALTER TABLE fuentes_rss ADD COLUMN convert_full_page TINYINT(1) NOT NULL DEFAULT 0");
            const [reintento] = await db.query(
              "UPDATE fuentes_rss SET convert_full_page = ? WHERE id = ? AND usuario_id = ?",
              [flag, id, userId]
            );
            if (reintento.affectedRows === 0) {
              return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
            }
            return NextResponse.json({ message: "Fuente actualizada", convertFullPage: flag === 1 });
          } catch {
            return NextResponse.json({ error: "Error al actualizar fuente" }, { status: 500 });
          }
        }
        throw error;
      }
    }

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

    // Persiste el interruptor solo si el cliente lo envió (edición parcial).
    // Tolerante a BDs sin la columna: el resto de la edición ya quedó guardada.
    if (flag !== undefined) {
      try {
        await db.query(
          "UPDATE fuentes_rss SET convert_full_page = ? WHERE id = ? AND usuario_id = ?",
          [flag, id, userId]
        );
      } catch (error) {
        if (error?.code === "ER_BAD_FIELD_ERROR") {
          try {
            await db.query("ALTER TABLE fuentes_rss ADD COLUMN convert_full_page TINYINT(1) NOT NULL DEFAULT 0");
            await db.query(
              "UPDATE fuentes_rss SET convert_full_page = ? WHERE id = ? AND usuario_id = ?",
              [flag, id, userId]
            );
          } catch {
            // Sin columna: no bloquea la edición principal.
          }
        } else {
          throw error;
        }
      }
    }

    // Con el flag activo y una URL editada que apunta a una página (no a un
    // feed), se guarda como pagina_origen para el crawler: permite rescatar
    // fuentes antiguas pegando la URL de sección (p. ej. /developer-skills/)
    // en Editar y refrescar con página completa.
    if (flag === 1 && !/\/(feed|rss|atom)(\/|$)|\.xml(\?|#|$)/i.test(sanitizedUrl)) {
      try {
        await db.query(
          "UPDATE fuentes_rss SET pagina_origen = ? WHERE id = ? AND usuario_id = ?",
          [sanitizedUrl, id, userId]
        );
      } catch (error) {
        if (error?.code === "ER_BAD_FIELD_ERROR") {
          try {
            await db.query("ALTER TABLE fuentes_rss ADD COLUMN pagina_origen VARCHAR(1000) NULL");
            await db.query(
              "UPDATE fuentes_rss SET pagina_origen = ? WHERE id = ? AND usuario_id = ?",
              [sanitizedUrl, id, userId]
            );
          } catch {
            // Sin columna: no bloquea la edición principal.
          }
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({ message: "Fuente actualizada", convertFullPage: flag === undefined ? undefined : flag === 1 });
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
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    // Borrado en lote: ?ids=1,2,3 (el ?id= simple se conserva por compatibilidad).
    const idsParam = searchParams.get("ids");
    const ids = (idsParam ? idsParam.split(",") : id ? [id] : [])
      .map((valor) => Number(String(valor).trim()))
      .filter((numero) => Number.isInteger(numero) && numero > 0);

    if (ids.length === 0) {
      return NextResponse.json({ error: "ID de fuente requerido" }, { status: 400 });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    await connection.query(
      `DELETE a FROM articulos_publicados a
       INNER JOIN fuentes_rss f ON a.fuente_id = f.id
       WHERE a.fuente_id IN (${ids.map(() => "?").join(",")}) AND f.usuario_id = ?`,
      [...ids, userId]
    );

    const [result] = await connection.query(
      `DELETE FROM fuentes_rss WHERE id IN (${ids.map(() => "?").join(",")}) AND usuario_id = ?`,
      [...ids, userId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
    }

    await connection.commit();
    return NextResponse.json({ message: "Fuente y artículos eliminados correctamente", eliminadas: result.affectedRows });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error en DELETE /api/sources:", error);
    return NextResponse.json({ error: "Error al eliminar fuente" }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}