import { NextRequest, NextResponse } from "next/server";
import { CanalVenda } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { exigirVisualizacao, permissaoErrorResponse } from "@/lib/permissoes";
import { enfileirarPeriodo, executarFila } from "@/modules/financeiro/ingestao/fila";

export const maxDuration = 30;

const DIAS_HISTORICO_AUTOMATICO = 365;
const HORAS_JANELA_ALERTA_WEBHOOK = 24;

async function garantirInicioAutomatico(userId: string, accountId: string): Promise<void> {
  const tarefaConcluida = await prisma.tarefaSincronizacaoFinanceira.findFirst({
    where: { userId, contaCanalId: accountId, tipo: "PEDIDOS_PERIODO", status: "CONCLUIDA" },
  });
  if (tarefaConcluida) return;

  const jaEnfileirada = await prisma.tarefaSincronizacaoFinanceira.findFirst({
    where: {
      userId,
      contaCanalId: accountId,
      tipo: "PEDIDOS_PERIODO",
      status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
    },
  });
  if (jaEnfileirada) return;

  const ate = new Date();
  const desde = new Date(ate.getTime() - DIAS_HISTORICO_AUTOMATICO * 24 * 60 * 60 * 1000);
  await enfileirarPeriodo(accountId, desde, ate, 20);
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirVisualizacao(user.role, "FINANCEIRO_VER");

    const contaAtiva = await prisma.mercadoLivreAccount.findFirst({
      where: { userId: user.contaId, isActive: true },
      select: { id: true },
    });

    if (contaAtiva) {
      await garantirInicioAutomatico(user.contaId, contaAtiva.id);
      await executarFila(user.contaId, contaAtiva.id, 8000);
    }

    const [ultimaConcluida, emAndamento, erroPendentesCount, webhooksPorTopico] = await Promise.all([
      prisma.sincronizacaoFinanceira.findFirst({
        where: { userId: user.contaId, canal: CanalVenda.MERCADO_LIVRE, status: "CONCLUIDO" },
        orderBy: { concluidoEm: "desc" },
      }),
      prisma.tarefaSincronizacaoFinanceira.findFirst({
        where: {
          userId: user.contaId,
          canal: CanalVenda.MERCADO_LIVRE,
          status: { in: ["PENDENTE", "EM_ANDAMENTO"] },
        },
        orderBy: { prioridade: "desc" },
      }),
      prisma.sincronizacaoFinanceiraErro.count({
        where: { userId: user.contaId, canal: CanalVenda.MERCADO_LIVRE, resolvidoEm: null },
      }),
      contaAtiva
        ? prisma.mercadoLivreWebhook.groupBy({
            by: ["topic"],
            where: { mercadoLivreAccountId: contaAtiva.id },
            _max: { receivedAt: true },
          })
        : Promise.resolve([]),
    ]);

    const ultimoWebhookPorTopico: Record<string, string | null> = {};
    for (const linha of webhooksPorTopico) {
      ultimoWebhookPorTopico[linha.topic] = linha._max.receivedAt?.toISOString() ?? null;
    }

    const limiteAlerta = new Date(Date.now() - HORAS_JANELA_ALERTA_WEBHOOK * 60 * 60 * 1000);
    const [ultimoWebhookOrders, vendaRecente] = await Promise.all([
      contaAtiva
        ? prisma.mercadoLivreWebhook.findFirst({
            where: { mercadoLivreAccountId: contaAtiva.id, topic: "orders_v2", receivedAt: { gte: limiteAlerta } },
            select: { id: true },
          })
        : Promise.resolve(null),
      prisma.vendaCanal.findFirst({
        where: { userId: user.contaId, canal: CanalVenda.MERCADO_LIVRE, dataVenda: { gte: limiteAlerta } },
        select: { id: true },
      }),
    ]);
    const alertaWebhooksAusentes = Boolean(vendaRecente) && !ultimoWebhookOrders;

    return NextResponse.json({
      emAndamento: emAndamento
        ? { tipo: emAndamento.tipo, processados: emAndamento.processados, status: emAndamento.status }
        : null,
      ultimaSincronizacaoConcluidaEm: ultimaConcluida?.concluidoEm ?? null,
      errosPendentes: erroPendentesCount,
      ultimoWebhookPorTopico,
      alertaWebhooksAusentes,
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao obter status da sincronização financeira:", error);
    return NextResponse.json({ error: "Erro ao obter status da sincronização financeira" }, { status: 500 });
  }
}
