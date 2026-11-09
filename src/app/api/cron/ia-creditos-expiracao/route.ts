import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado, respostaCronNaoAutorizado } from "@/lib/cron";
import { expirarLotesVencidos } from "@/modules/ia/creditos";
import { expirarComprasPendentes } from "@/modules/ia/compraCreditos";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return respostaCronNaoAutorizado();
  try {
    const [expiracao, comprasExpiradas] = await Promise.all([expirarLotesVencidos(), expirarComprasPendentes()]);
    return NextResponse.json({ ...expiracao, comprasExpiradas });
  } catch (error) {
    console.error("[CRON_IA_CREDITOS] Falha:", error);
    return NextResponse.json({ error: "Falha ao expirar créditos" }, { status: 500 });
  }
}
