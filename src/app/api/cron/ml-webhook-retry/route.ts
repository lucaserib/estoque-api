import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

const MAX_EVENTOS_POR_EXECUCAO = 200;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const eventosPendentes = await prisma.mercadoLivreWebhook.findMany({
    where: { processed: false },
    orderBy: { receivedAt: "asc" },
    take: MAX_EVENTOS_POR_EXECUCAO,
    select: { id: true },
  });

  let reprocessados = 0;
  for (const evento of eventosPendentes) {
    await MercadoLivreService.processWebhookEvent(evento.id);
    reprocessados++;
  }

  return NextResponse.json({
    eventosEncontrados: eventosPendentes.length,
    eventosReprocessados: reprocessados,
  });
}
