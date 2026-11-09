import { NextRequest, NextResponse } from "next/server";
import { limparConversasAntigas } from "@/modules/ia/conversas";
import { retencaoDias } from "@/modules/ia/config";
import { limparContadoresVencidos } from "@/lib/rateLimit";
import { limparTokensVencidos } from "@/modules/usuarios/tokens";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const apagadas = await limparConversasAntigas();
    const [contadoresApagados, tokensApagados] = await Promise.all([
      limparContadoresVencidos().catch(() => 0),
      limparTokensVencidos().catch(() => 0),
    ]);
    console.info("[CRON_IA_LIMPEZA] Limpeza concluída", { apagadas, retencaoDias: retencaoDias(), contadoresApagados, tokensApagados });
    return NextResponse.json({ apagadas, retencaoDias: retencaoDias(), contadoresApagados, tokensApagados });
  } catch (error) {
    console.error("[CRON_IA_LIMPEZA] Falha", { erro: error instanceof Error ? error.name : "desconhecido" });
    return NextResponse.json({ error: "Falha ao limpar conversas" }, { status: 500 });
  }
}
