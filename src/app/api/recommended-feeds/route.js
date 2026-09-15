// src/app/api/recommended-feeds/route.js — Feeds recomendados pre-verificados por categoría.
import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const categoriasParam = searchParams.get("categorias");
    const categorias = categoriasParam ? categoriasParam.split(",").map(c => c.trim()) : null;

    const filePath = path.join(process.cwd(), "src/data/recommended-feeds.json");
    const fileContent = await readFile(filePath, "utf-8");
    const data = JSON.parse(fileContent);

    let feeds = data.categorias;

    if (categorias && categorias.length > 0) {
      const filtrados = {};
      for (const cat of categorias) {
        if (feeds[cat]) {
          filtrados[cat] = feeds[cat];
        }
      }
      feeds = filtrados;
    }

    const totalFeeds = Object.values(feeds).reduce((acc, arr) => acc + arr.length, 0);

    return NextResponse.json({
      categorias: feeds,
      total: totalFeeds,
      metadata: data.metadata
    }, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("Error en GET /api/recommended-feeds:", error);
    return NextResponse.json({ 
      error: "Error al obtener feeds recomendados",
      categorias: {}, 
      total: 0 
    }, { status: 500 });
  }
}