import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { BlingReconnectError, BlingTransientError } from "@/services/blingService";
import { processarEventoWebhookBling } from "@/services/blingWebhookProcessor";
import { sincronizarContasFinanceirasBling } from "@/modules/financeiro/canais/erp/bling/contasFinanceiras";
import { contasSuspensasHaMaisDe } from "@/modules/conta/situacao";

export const maxDuration = 60;

const MAX_EVENTOS_POR_EXECUCAO = 200;
const DIAS_TOLERANCIA_SUSPENSA = 3;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const eventosPendentes = await prisma.blingWebhookEvent.findMany({
    where: { processado: false },
    orderBy: { recebidoEm: "asc" },
    take: MAX_EVENTOS_POR_EXECUCAO,
    select: { id: true },
  });

  const prazo = Date.now() + 35_000;
  let eventosReprocessados = 0;
  for (const evento of eventosPendentes) {
    if (Date.now() > prazo) break;
    await processarEventoWebhookBling(evento.id);
    eventosReprocessados++;
  }

  const contasBling = await prisma.blingAccount.findMany({
    where: { isActive: true },
    select: { id: true, userId: true },
  });
  const suspensas = await contasSuspensasHaMaisDe(contasBling.map((c) => c.userId), DIAS_TOLERANCIA_SUSPENSA);
  const contasAtivas = contasBling.filter((c) => !suspensas.has(c.userId));

  let contasSincronizadas = 0;
  let errosSincronizacao = 0;

  for (const conta of contasAtivas) {
    try {
      await sincronizarContasFinanceirasBling(conta.userId, conta.id);
      contasSincronizadas++;
    } catch (error) {
      errosSincronizacao++;
      if (error instanceof BlingReconnectError || error instanceof BlingTransientError) {
        console.error(`[CRON_BLING_SYNC] Conta ${conta.id} indisponível, tentando na próxima execução:`, error);
      } else {
        console.error(`[CRON_BLING_SYNC] Erro ao sincronizar contas financeiras da conta ${conta.id}:`, error);
        Sentry.captureException(error, { tags: { cron: "bling-sync", contaId: conta.id } });
      }
    }
  }

  return NextResponse.json({
    eventosReprocessados,
    contasElegiveis: contasAtivas.length,
    contasSuspensas: suspensas.size,
    contasSincronizadas,
    errosSincronizacao,
  });
}
