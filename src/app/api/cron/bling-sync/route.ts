import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlingReconnectError, BlingTransientError } from "@/services/blingService";
import { processarEventoWebhookBling } from "@/services/blingWebhookProcessor";
import { sincronizarContasFinanceirasBling } from "@/modules/financeiro/canais/erp/bling/contasFinanceiras";

export const maxDuration = 60;

const MAX_EVENTOS_POR_EXECUCAO = 200;

/**
 * Reprocessa webhooks do Bling que ficaram pendentes e lê as contas a pagar
 * e receber. Produtos e estoque do Bling são sincronizados pelo catálogo
 * (`/api/cron/catalogo-diario` e `modules/catalogo/sincronizacao.ts`), com
 * cursor e orçamento de tempo.
 */
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

  let eventosReprocessados = 0;
  for (const evento of eventosPendentes) {
    await processarEventoWebhookBling(evento.id);
    eventosReprocessados++;
  }

  const contasAtivas = await prisma.blingAccount.findMany({
    where: { isActive: true },
    select: { id: true, userId: true },
  });

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
      }
    }
  }

  return NextResponse.json({
    eventosReprocessados,
    contasElegiveis: contasAtivas.length,
    contasSincronizadas,
    errosSincronizacao,
  });
}
