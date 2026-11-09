import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { processarEventoEmail, type EventoEmailRecebido } from "@/modules/email/eventos";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const segredo = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!segredo) {
    console.error("[EMAIL_WEBHOOK] RESEND_WEBHOOK_SECRET ausente; evento recusado.");
    return NextResponse.json({ error: "Webhook de e-mail sem segredo configurado" }, { status: 503 });
  }

  const corpo = await request.text();
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 401 });
  }

  let evento: EventoEmailRecebido;
  try {
    const verificador = new Resend(process.env.RESEND_API_KEY?.trim() || "re_verificacao");
    evento = verificador.webhooks.verify({
      payload: corpo,
      headers: { id, timestamp, signature },
      webhookSecret: segredo,
    }) as EventoEmailRecebido;
  } catch {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  try {
    const resultado = await processarEventoEmail(evento);
    return NextResponse.json({ recebido: true, ...resultado });
  } catch (error) {
    console.error("[EMAIL_WEBHOOK] Falha ao processar evento:", error);
    return NextResponse.json({ error: "Falha ao processar o evento" }, { status: 500 });
  }
}
