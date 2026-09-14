// src/app/compartir/route.js — Destino del Web Share Target (manifest).
// Recibe ?title=&text=&url= y redirige al dashboard con ?compartir=,
// que abre el modal "Agregar feed" con la URL prellenada.
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const candidato =
    (searchParams.get("url") || "").trim() ||
    (searchParams.get("text") || "").trim() ||
    (searchParams.get("title") || "").trim();

  const destino = new URL("/", req.url);
  if (candidato) destino.searchParams.set("compartir", candidato);
  return NextResponse.redirect(destino);
}
