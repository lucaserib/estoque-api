import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado, respostaCronNaoAutorizado } from "@/lib/cron";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import { processarRecompensasDeAssinatura } from "@/modules/indicacao/recompensa";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return respostaCronNaoAutorizado();
  if (!isMercadoPagoConfigured()) return NextResponse.json({ ignorado: "Mercado Pago não configurado" });
  try {
    return NextResponse.json(await processarRecompensasDeAssinatura());
  } catch (error) {
    console.error("[CRON_RECOMPENSAS] Falha:", error);
    return NextResponse.json({ error: "Falha ao aplicar recompensas" }, { status: 500 });
  }
}
