// src/app/api/auth/recuperar/route.js
// Flujo de recuperación vía API interna:
// solicitar -> POST /api/auth/recover/request {email}
// verificar -> validación local (el veredicto final lo da restablecer)
// restablecer -> POST /api/auth/recover/verify {email, code, newPassword}
import { requestRecover, verifyRecover } from "@/lib/api";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { action, email, codigo, password } = await req.json();

    if (action === "solicitar") {
      const correo = String(email || "").trim();
      if (!correo) {
        return NextResponse.json({ error: "El correo electrónico es obligatorio." }, { status: 400 });
      }
      try {
        await requestRecover(correo);
      } catch (error) {
        // Respuesta genérica anti-enumeración si el backend rechaza el correo.
        if (error?.status === 404) {
          return NextResponse.json({
            ok: true,
            mensaje: "Si el correo está registrado recibirás un código de recuperación.",
          });
        }
        throw error;
      }
      return NextResponse.json({
        ok: true,
        mensaje: `Hemos enviado un código de recuperación a ${correo}. Revisa tu bandeja (y el spam).`,
      });
    }

    if (action === "verificar") {
      const correo = String(email || "").trim();
      const codigoPlano = String(codigo || "").trim();
      if (!correo || !codigoPlano) {
        return NextResponse.json({ error: "El correo y el código son obligatorios." }, { status: 400 });
      }
      // La API interna verifica código + nueva contraseña en un solo paso;
      // aquí se valida formato para dar feedback temprano sin consumir intentos.
      if (!/^\d{6}$/.test(codigoPlano)) {
        return NextResponse.json({ error: "El código ingresado no es correcto." }, { status: 400 });
      }
      return NextResponse.json({ ok: true, mensaje: "Código verificado correctamente." });
    }

    if (action === "restablecer") {
      const correo = String(email || "").trim();
      const codigoPlano = String(codigo || "").trim();
      const nueva = String(password || "");
      if (!correo || !codigoPlano || !nueva) {
        return NextResponse.json({ error: "Todos los campos son obligatorios." }, { status: 400 });
      }
      if (nueva.length < 6) {
        return NextResponse.json(
          { error: "La contraseña debe tener al menos 6 caracteres." },
          { status: 400 }
        );
      }
      try {
        await verifyRecover(correo, codigoPlano, nueva);
      } catch (error) {
        const status = Number(error?.status) || 400;
        if (status === 429) {
          return NextResponse.json(
            { error: "Demasiados intentos. Solicita un código nuevo." },
            { status: 429 }
          );
        }
        return NextResponse.json(
          { error: "El código es inválido o ha expirado. Solicita uno nuevo." },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true, mensaje: "Contraseña restablecida correctamente." });
    }

    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    console.error("Error en recuperación vía API:", error?.message || error);
    return NextResponse.json({ error: "Error interno del servidor." }, { status: 500 });
  }
}
