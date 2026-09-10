// src/app/api/perfil/route.js
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const LIMITE_IMAGEN_CHARS = 60000;

let perfilSchemaPromise;

async function ensurePerfilSchema() {
  if (!perfilSchemaPromise) {
    perfilSchemaPromise = (async () => {
      const [columns] = await db.query(
        `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'usuarios'
           AND COLUMN_NAME = 'imagen_url'`
      );
      if (columns[0] && columns[0].DATA_TYPE !== "text") {
        await db.query("ALTER TABLE usuarios MODIFY COLUMN imagen_url TEXT NULL");
      }
    })().catch((error) => {
      perfilSchemaPromise = undefined;
      throw error;
    });
  }
  return perfilSchemaPromise;
}

function validarImagen(valor) {
  if (valor === null || valor === undefined || valor === "") return { valida: true, valor: null };
  if (typeof valor !== "string" || valor.length > LIMITE_IMAGEN_CHARS) {
    return { valida: false };
  }
  const esUrl = /^https?:\/\/.+/i.test(valor.trim());
  const esDataUrl = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(valor.trim());
  if (!esUrl && !esDataUrl) return { valida: false };
  return { valida: true, valor: valor.trim() };
}

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    await ensurePerfilSchema();

    const [rows] = await db.query(
      "SELECT id, nombre, email, imagen_url, proveedor, creado_en FROM usuarios WHERE id = ?",
      [userId]
    );
    if (!rows[0]) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json(rows[0], {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Error en GET /api/perfil:", error);
    return NextResponse.json({ error: "Error al obtener el perfil" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    await ensurePerfilSchema();

    const body = await req.json().catch(() => ({}));
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre || nombre.length > 100) {
      return NextResponse.json({ error: "El nombre es obligatorio (máximo 100 caracteres)" }, { status: 400 });
    }

    const imagen = validarImagen(body.imagen_url);
    if (!imagen.valida) {
      return NextResponse.json({ error: "La imagen debe ser una URL válida o un archivo ligero" }, { status: 400 });
    }

    await db.query("UPDATE usuarios SET nombre = ?, imagen_url = ? WHERE id = ?", [nombre, imagen.valor, userId]);

    const [rows] = await db.query(
      "SELECT id, nombre, email, imagen_url, proveedor, creado_en FROM usuarios WHERE id = ?",
      [userId]
    );
    return NextResponse.json({ message: "Perfil actualizado correctamente", perfil: rows[0] });
  } catch (error) {
    console.error("Error en PUT /api/perfil:", error);
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 });
  }
}
