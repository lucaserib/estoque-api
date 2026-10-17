import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BlingService,
  BlingReconnectError,
  BlingTransientError,
} from "@/services/blingService";
import { sincronizarProdutoUnico } from "@/services/blingProductSync";
import { processarEventoWebhookBling } from "@/services/blingWebhookProcessor";
import { sincronizarContasFinanceirasBling } from "@/modules/financeiro/canais/erp/bling/contasFinanceiras";

const MAX_EVENTOS_POR_EXECUCAO = 200;

function formatarDataBling(data: Date): string {
  return data.toISOString().slice(0, 19).replace("T", " ");
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (
    !process.env.CRON_SECRET ||
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
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
    select: { id: true, userId: true, ultimaSincronizacaoProdutos: true },
  });

  let contasSincronizadas = 0;
  let produtosSincronizados = 0;
  let errosSincronizacao = 0;

  for (const conta of contasAtivas) {
    try {
      const dataAlteracaoInicial = conta.ultimaSincronizacaoProdutos
        ? formatarDataBling(conta.ultimaSincronizacaoProdutos)
        : undefined;

      const produtos = await BlingService.getAllProducts(
        conta.id,
        dataAlteracaoInicial
      );

      for (const resumo of produtos) {
        try {
          await sincronizarProdutoUnico(conta.id, conta.userId, resumo.id);
          produtosSincronizados++;
        } catch (error) {
          errosSincronizacao++;
          console.error(
            `[CRON_BLING_SYNC] Erro ao sincronizar produto ${resumo.id} da conta ${conta.id}:`,
            error
          );
        }
      }

      await prisma.blingAccount.update({
        where: { id: conta.id },
        data: { ultimaSincronizacaoProdutos: new Date() },
      });
      contasSincronizadas++;

      try {
        await sincronizarContasFinanceirasBling(conta.userId, conta.id);
      } catch (error) {
        errosSincronizacao++;
        console.error(
          `[CRON_BLING_SYNC] Erro ao sincronizar contas financeiras da conta ${conta.id}:`,
          error
        );
      }
    } catch (error) {
      if (error instanceof BlingReconnectError || error instanceof BlingTransientError) {
        console.error(
          `[CRON_BLING_SYNC] Conta ${conta.id} indisponível, tentando na próxima execução:`,
          error
        );
      } else {
        console.error(
          `[CRON_BLING_SYNC] Erro ao processar conta ${conta.id}:`,
          error
        );
      }
    }
  }

  return NextResponse.json({
    eventosReprocessados,
    contasElegiveis: contasAtivas.length,
    contasSincronizadas,
    produtosSincronizados,
    errosSincronizacao,
  });
}
