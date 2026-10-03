import { NextRequest, NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  processarEventoWebhookBling,
  BlingWebhookEnvelope,
} from "@/services/blingWebhookProcessor";
import { verificarAssinaturaBling } from "@/lib/blingWebhookSignature";

export async function POST(request: NextRequest) {
  const corpoCru = await request.text();
  const assinatura = request.headers.get("X-Bling-Signature-256");

  if (!verificarAssinaturaBling(corpoCru, assinatura, process.env.BLING_CLIENT_SECRET)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let payload: BlingWebhookEnvelope;
  try {
    payload = JSON.parse(corpoCru);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!payload.eventId || !payload.event) {
    return NextResponse.json({ error: "Payload sem eventId/event" }, { status: 400 });
  }

  const existente = await prisma.blingWebhookEvent.findUnique({
    where: { eventId: payload.eventId },
    select: { id: true },
  });

  if (existente) {
    return NextResponse.json({ recebido: true, duplicado: true });
  }

  const registro = await prisma.blingWebhookEvent.create({
    data: {
      eventId: payload.eventId,
      event: payload.event,
      companyId: payload.companyId ?? null,
      payload: payload as unknown as object,
    },
  });

  after(async () => {
    await processarEventoWebhookBling(registro.id);
  });

  return NextResponse.json({ recebido: true });
}
