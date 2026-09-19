// src/app/api/sources/route.js — Proxy a la API interna (sin MySQL directo).
import { auth } from "@/auth";
import { createFuente, deleteFuente, getFuentes, patchFuente } from "@/lib/api";
import { resolverUsuarioId } from "@/lib/invitado";
import { NextResponse } from "next/server";

function normalizarFuentes(data) {
  const lista = Array.isArray(data) ? data : data?.fuentes || data?.data || [];
  return (lista || []).map((f) => ({
    ...f,
    convertFullPage: Number(f.convert_full_page) === 1 || f.convertFullPage === true,
  }));
}

export async function GET(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const fuentes = await getFuentes(userId);
    return NextResponse.json(normalizarFuentes(fuentes), {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Error en GET /api/sources vía API:", error?.message || error);
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
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return NextResponse.json({ error: "Protocolo no válido" }, { status: 400 });
      }
      sanitizedUrl = parsedUrl.toString();
    } catch {
      return NextResponse.json({ error: "URL mal formada" }, { status: 400 });
    }

    const creado = await createFuente({
      usuario_id: userId,
      titulo: titulo.trim(),
      url_feed: sanitizedUrl,
      categoria: (categoria || "General").trim(),
    });
    const id = creado?.id || creado?.fuente?.id || creado?.data?.id || creado?.insertId || null;
    return NextResponse.json({ message: "Fuente agregada correctamente", id }, { status: 201 });
  } catch (error) {
    console.error("Error en POST /api/sources vía API:", error?.message || error);
    const status = Number(error?.status) || 500;
    if (status === 400 || status === 409) {
      return NextResponse.json({ error: error.message || "Error al agregar fuente" }, { status });
    }
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

    if (!id) {
      return NextResponse.json({ error: "Faltan datos obligatorios" }, { status: 400 });
    }

    const flagRaw = convertFullPage !== undefined ? convertFullPage : convert_full_page;
    const flag =
      flagRaw === undefined || flagRaw === null
        ? undefined
        : flagRaw === true || flagRaw === 1 || flagRaw === "1"
          ? 1
          : 0;

    const patch = { usuario_id: userId };
    if (titulo) patch.titulo = String(titulo).trim();
    if (url_feed) {
      try {
        const parsedUrl = new URL(String(url_feed).trim());
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          return NextResponse.json({ error: "Protocolo no válido" }, { status: 400 });
        }
        patch.url_feed = parsedUrl.toString();
      } catch {
        return NextResponse.json({ error: "URL mal formada" }, { status: 400 });
      }
    }
    if (categoria !== undefined) patch.categoria = String(categoria || "General").trim();
    if (flag !== undefined) {
      patch.convert_full_page = flag;
      patch.convertFullPage = flag === 1;
    }

    try {
      await patchFuente(id, patch);
    } catch (error) {
      const status = Number(error?.status) || 500;
      if (status === 404) {
        return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
      }
      // Backend sin PATCH de fuentes: edición no soportada.
      if (status === 404 || status === 405 || status === 501) {
        return NextResponse.json({ error: "Edición no soportada por el backend" }, { status: 501 });
      }
      throw error;
    }

    return NextResponse.json({
      message: "Fuente actualizada",
      ...(flag !== undefined ? { convertFullPage: flag === 1 } : {}),
    });
  } catch (error) {
    console.error("Error en PUT /api/sources vía API:", error?.message || error);
    return NextResponse.json({ error: "Error al actualizar fuente" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const idsParam = searchParams.get("ids");
    const ids = (idsParam ? idsParam.split(",") : id ? [id] : [])
      .map((valor) => Number(String(valor).trim()))
      .filter((numero) => Number.isInteger(numero) && numero > 0);

    if (ids.length === 0) {
      return NextResponse.json({ error: "ID de fuente requerido" }, { status: 400 });
    }

    let eliminadas = 0;
    for (const fid of ids) {
      try {
        await deleteFuente(fid, userId);
        eliminadas++;
      } catch (error) {
        if (Number(error?.status) === 404) continue;
        throw error;
      }
    }

    if (eliminadas === 0) {
      return NextResponse.json({ error: "Fuente no encontrada o no autorizada" }, { status: 404 });
    }

    return NextResponse.json({ message: "Fuente y artículos eliminados correctamente", eliminadas });
  } catch (error) {
    console.error("Error en DELETE /api/sources vía API:", error?.message || error);
    return NextResponse.json({ error: "Error al eliminar fuente" }, { status: 500 });
  }
}
