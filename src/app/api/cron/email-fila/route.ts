import { NextRequest, NextResponse } from "next/server";
import { processarFilaEmails } from "@/modules/email/fila";
import { processarCampanhas } from "@/modules/email/campanhas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const lotesDeCampanha = await processarCampanhas(new Date(), 15_000);
    const resultado = await processarFilaEmails({ limite: 100, orcamentoMs: 30_000 });
    return NextResponse.json({ ...resultado, lotesDeCampanha });
  } catch (error) {
    console.error("[CRON_EMAIL_FILA] Falha:", error);
    return NextResponse.json({ error: "Falha ao processar a fila de e-mails" }, { status: 500 });
  }
}
