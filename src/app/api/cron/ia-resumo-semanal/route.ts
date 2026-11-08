import { NextRequest, NextResponse } from "next/server";
import { executarResumoSemanal } from "@/modules/ia/resumoSemanal";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const resultado = await executarResumoSemanal();
    console.info("[CRON_IA_RESUMO_SEMANAL]", resultado);
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("[CRON_IA_RESUMO_SEMANAL] Falha", { erro: error instanceof Error ? error.name : "desconhecido" });
    return NextResponse.json({ error: "Falha no resumo semanal" }, { status: 500 });
  }
}
