// src/app/api/datos/route.js — Exportar y eliminar datos propios vía API interna.
// Solo sesión real (como /api/perfil); invitados usan salir (efímero).
import { auth } from "@/auth";
import { api, deleteFuente, deleteFuentesBulk, deleteUser, getArticulos, getFuentes, getUser, invalidarUsuarioCache } from "@/lib/api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const [usuario, fuentes, articulosRes] = await Promise.all([
      getUser(userId),
      getFuentes(userId).catch(() => []),
      getArticulos({ usuario_id: userId, limit: 100000, offset: 0 }).catch(() => []),
    ]);
    const usuarioNorm = usuario?.user || usuario?.usuario || usuario;
    if (!usuarioNorm?.id && !usuarioNorm?.email) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    const articulos = Array.isArray(articulosRes)
      ? articulosRes
      : articulosRes?.articulos || articulosRes?.articles || articulosRes?.data || [];
    return NextResponse.json({
      exportado_en: new Date().toISOString(),
      usuario: usuarioNorm,
      fuentes: fuentes || [],
      articulos: articulos || [],
    });
  } catch (error) {
    console.error("Error al exportar datos vía API:", error?.message || error);
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
    // Limpieza previa best-effort: si el backend no tiene ON DELETE CASCADE,
    // el DELETE directo de usuarios falla por FK (fuentes/push). Se borran
    // primero las fuentes (y con ellas sus artículos) y los dispositivos.
    try {
      const fuentes = await getFuentes(userId).catch(() => []);
      const lista = Array.isArray(fuentes) ? fuentes : fuentes?.fuentes || fuentes?.data || [];
      const fids = (lista || [])
        .map((f) => f?.id ?? f?.fuente_id)
        .filter((fid) => fid !== undefined && fid !== null);
      if (fids.length > 0) {
        try {
          await deleteFuentesBulk(fids, userId);
        } catch (error) {
          // Sin bulk en el backend (404/405/501): repliegue por fuente.
          const status = Number(error?.status);
          if (![404, 405, 501].includes(status)) throw error;
          for (const fid of fids) {
            try {
              await deleteFuente(fid, userId);
            } catch (errUno) {
              if (Number(errUno?.status) !== 404) {
                console.warn("No se pudo borrar fuente previa a eliminar cuenta:", fid, errUno?.message || errUno);
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn("No se pudieron borrar fuentes previas a eliminar cuenta:", error?.message || error);
    }
    try {
      await api(`/api/push/subscriptions?usuario_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      }).catch(() => null);
    } catch {
      // Best-effort: el backend puede no tener endpoint de push.
    }
    // Borrado delegado al backend (elimina cuenta + asociados).
    await deleteUser(userId);
    // Sin esta invalidación, la caché (email->usuario) seguiría devolviendo al
    // borrado 45s: re-registrar con el mismo correo abriría la app con un id
    // fantasma y sin fila nueva en la BD.
    invalidarUsuarioCache(userId, session?.user?.email);
    return NextResponse.json({ message: "Cuenta y datos eliminados" });
  } catch (error) {
    console.error("Error al eliminar datos vía API:", error?.status ? `status=${error.status}` : "", error?.message || error, error?.data ? JSON.stringify(error.data).slice(0, 500) : "");
    const status = Number(error?.status) || 500;
    if (status === 404) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: "No autorizado por la API interna" }, { status: status });
    }
    const detalle = error?.data?.error || error?.data?.message || error?.message;
    return NextResponse.json({ error: "Error al eliminar datos", detalle: typeof detalle === "string" ? detalle.slice(0, 300) : undefined }, { status: 500 });
  }
}
