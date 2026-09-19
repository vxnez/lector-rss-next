// src/app/api/perfil/route.js — Perfil vía API interna (sin MySQL directo).
import { auth } from "@/auth";
import { getUser, patchUser } from "@/lib/api";
import { NextResponse } from "next/server";

const LIMITE_IMAGEN_CHARS = 60000;
const GENEROS_VALIDOS = ["hombre", "mujer", "no_mencionarlo"];

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

function normalizarPerfil(data) {
  return data?.user || data?.usuario || data?.perfil || data;
}

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const perfil = normalizarPerfil(await getUser(userId));
    if (!perfil?.id && !perfil?.email) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json(perfil, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Error en GET /api/perfil vía API:", error?.message || error);
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

    const body = await req.json().catch(() => ({}));
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
    if (!nombre || nombre.length > 100) {
      return NextResponse.json({ error: "El nombre es obligatorio (máximo 100 caracteres)" }, { status: 400 });
    }

    const imagen = validarImagen(body.imagen_url);
    if (!imagen.valida) {
      return NextResponse.json({ error: "La imagen debe ser una URL válida o un archivo ligero" }, { status: 400 });
    }

    let genero = null;
    if (body.genero !== undefined) {
      if (!GENEROS_VALIDOS.includes(body.genero)) {
        return NextResponse.json({ error: "Género no válido" }, { status: 400 });
      }
      genero = body.genero;
    }

    const actualizado = normalizarPerfil(
      await patchUser(userId, { nombre, imagen_url: imagen.valor, genero })
    );
    return NextResponse.json({ message: "Perfil actualizado correctamente", perfil: actualizado });
  } catch (error) {
    console.error("Error en PUT /api/perfil vía API:", error?.message || error);
    return NextResponse.json({ error: "Error al actualizar el perfil" }, { status: 500 });
  }
}
