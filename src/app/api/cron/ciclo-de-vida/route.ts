import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado, respostaCronNaoAutorizado } from "@/lib/cron";
import { processarCicloDeVida } from "@/modules/email/cicloDeVida";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return respostaCronNaoAutorizado();
  try {
    return NextResponse.json(await processarCicloDeVida());
  } catch (error) {
    console.error("[CRON_CICLO_DE_VIDA] Falha:", error);
    return NextResponse.json({ error: "Falha no ciclo de vida" }, { status: 500 });
  }
}
