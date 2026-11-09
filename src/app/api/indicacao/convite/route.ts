import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { ipDe } from "@/modules/conta/auditoria";
import { consultarConvite } from "@/modules/indicacao/convite";

export async function GET(request: NextRequest) {
  try {
    const limite = await checkRateLimit("convite-indicacao", ipDe(request.headers) ?? "sem-ip", 30, 60);
    if (!limite.allowed) return rateLimitResponse(limite);
    const convite = await consultarConvite(request.nextUrl.searchParams.get("codigo"));
    return NextResponse.json(convite, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[INDICACAO] Falha ao consultar o convite:", error);
    return NextResponse.json({ valido: false }, { status: 500 });
  }
}
