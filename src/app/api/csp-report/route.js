// src/app/api/csp-report/route.js — Endpoint para recibir reportes CSP.
// Los navegadores envían POST con Content-Type: application/csp-report
// Solo logging: no autenticación requerida (es para reportes de navegador).
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let report = null;

    if (contentType.includes("application/csp-report")) {
      // Formato legacy CSP report
      report = await req.json().catch(() => null);
    } else if (contentType.includes("application/json")) {
      // Formato Reporting API v1 (Reporting-Endpoints)
      const body = await req.json().catch(() => null);
      if (body && Array.isArray(body)) {
        report = body[0]?.body || body[0];
      }
    }

    if (report) {
      // Log estructurado para análisis en Vercel Logs
      console.warn("[CSP-REPORT]", JSON.stringify({
        "document-uri": report["document-uri"] || report["documentUri"],
        referrer: report.referrer,
        "violated-directive": report["violated-directive"] || report["violatedDirective"],
        "effective-directive": report["effective-directive"] || report["effectiveDirective"],
        "original-policy": report["original-policy"] || report["originalPolicy"],
        "blocked-uri": report["blocked-uri"] || report["blockedUri"],
        "line-number": report["line-number"] || report["lineNumber"],
        "column-number": report["column-number"] || report["columnNumber"],
        "source-file": report["source-file"] || report["sourceFile"],
        "script-sample": report["script-sample"] || report["scriptSample"],
        "disposition": report.disposition || "enforce",
      }));
    }
  } catch (err) {
    console.error("[CSP-REPORT] Error procesando reporte:", err);
  }

  // Siempre 204 No Content: el navegador no espera respuesta útil
  return new NextResponse(null, { status: 204 });
}

// GET para health check del endpoint
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "csp-report" });
}