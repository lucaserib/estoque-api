import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado, respostaCronNaoAutorizado } from "@/lib/cron";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import { aplicarReajustesVencidos } from "@/modules/comercial/reajuste";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return respostaCronNaoAutorizado();
  if (!isMercadoPagoConfigured()) return NextResponse.json({ ignorado: "Mercado Pago não configurado" });
  try {
    return NextResponse.json(await aplicarReajustesVencidos());
  } catch (error) {
    console.error("[CRON_REAJUSTES] Falha:", error);
    return NextResponse.json({ error: "Falha ao aplicar reajustes" }, { status: 500 });
  }
}
