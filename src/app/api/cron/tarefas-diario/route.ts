import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado, respostaCronNaoAutorizado } from "@/lib/cron";
import { enviarResumosDiarios } from "@/modules/operacao/emails";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return respostaCronNaoAutorizado();
  try {
    return NextResponse.json(await enviarResumosDiarios());
  } catch (error) {
    console.error("[CRON_TAREFAS_DIARIO] Falha:", error);
    return NextResponse.json({ error: "Falha ao montar os resumos de tarefas" }, { status: 500 });
  }
}
