import { NextRequest, NextResponse } from "next/server";
import { limparConversasAntigas } from "@/modules/ia/conversas";
import { retencaoDias } from "@/modules/ia/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const apagadas = await limparConversasAntigas();
    console.info("[CRON_IA_LIMPEZA] Conversas antigas apagadas", { apagadas, retencaoDias: retencaoDias() });
    return NextResponse.json({ apagadas, retencaoDias: retencaoDias() });
  } catch (error) {
    console.error("[CRON_IA_LIMPEZA] Falha", { erro: error instanceof Error ? error.name : "desconhecido" });
    return NextResponse.json({ error: "Falha ao limpar conversas" }, { status: 500 });
  }
}
