// src/app/api/vistas/route.js — Vistas guardadas (filtros favoritos por usuario).
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolverUsuarioId } from "@/lib/invitado";
import { NextResponse } from "next/server";

const TABS_VALIDOS = ["todas", "guardadas", "leidas"];
const ORDENES_VALIDOS = ["recientes", "az", "za"];

function sanearConfig(config = {}) {
  const tab = TABS_VALIDOS.includes(config.tab) ? config.tab : "todas";
  const orden = ORDENES_VALIDOS.includes(config.orden) ? config.orden : "recientes";
  const lista = (v) =>
    (Array.isArray(v) ? v : [])
      .map((s) => String(s).trim())
      .filter(Boolean)
      .slice(0, 50);
  return {
    tab,
    orden,
    categorias: lista(config.categorias),
    fuentes: lista(config.fuentes),
    q: String(config.q || "").trim().slice(0, 200),
  };
}

export async function GET(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    const [rows] = await db.query(
      "SELECT id, nombre, config, creado_en FROM vistas_guardadas WHERE usuario_id = ? ORDER BY id DESC",
      [userId]
    );
    return NextResponse.json(
      rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        config: typeof r.config === "string" ? JSON.parse(r.config) : r.config,
      }))
    );
  } catch (error) {
    console.error("Error al obtener vistas:", error);
    return NextResponse.json({ error: "Error al obtener vistas" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    const { nombre, config } = await req.json().catch(() => ({}));

    const nombreLimpio = String(nombre || "").trim().slice(0, 100);
    if (!nombreLimpio) {
      return NextResponse.json({ error: "La vista necesita un nombre" }, { status: 400 });
    }

    const [result] = await db.query(
      "INSERT INTO vistas_guardadas (usuario_id, nombre, config) VALUES (?, ?, ?)",
      [userId, nombreLimpio, JSON.stringify(sanearConfig(config))]
    );
    return NextResponse.json({ message: "Vista guardada", id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Error al guardar vista:", error);
    return NextResponse.json({ error: "Error al guardar vista" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await auth();
    const userId = await resolverUsuarioId(req, session);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const [result] = await db.query(
      "DELETE FROM vistas_guardadas WHERE id = ? AND usuario_id = ?",
      [id, userId]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: "Vista no encontrada o no autorizada" }, { status: 404 });
    }
    return NextResponse.json({ message: "Vista eliminada" });
  } catch (error) {
    console.error("Error al eliminar vista:", error);
    return NextResponse.json({ error: "Error al eliminar vista" }, { status: 500 });
  }
}
