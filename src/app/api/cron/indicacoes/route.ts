import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado, respostaCronNaoAutorizado } from "@/lib/cron";
import { processarIndicacoes } from "@/modules/indicacao/fluxo";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return respostaCronNaoAutorizado();
  try {
    return NextResponse.json(await processarIndicacoes());
  } catch (error) {
    console.error("[CRON_INDICACOES] Falha:", error);
    return NextResponse.json({ error: "Falha ao processar indicações" }, { status: 500 });
  }
}
