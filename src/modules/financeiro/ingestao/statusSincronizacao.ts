import { CanalVenda, StatusTarefaSincronizacao, TipoTarefaSincronizacao } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enfileirarPeriodo } from "./fila";
import { filtroAguardandoDetalhes } from "./enriquecimento";

const DIAS_HISTORICO_AUTOMATICO = 400;
const HORAS_JANELA_ALERTA_WEBHOOK = 24;

export const VERSAO_DADOS_FINANCEIROS = 10;

export async function garantirHistoricoAtualizado(accountId: string): Promise<void> {
  const conta = await prisma.mercadoLivreAccount.findUnique({
    where: { id: accountId },
    select: { versaoDadosFinanceiros: true },
  });
  if (!conta || conta.versaoDadosFinanceiros >= VERSAO_DADOS_FINANCEIROS) return;

  const ate = new Date();
  const desde = new Date(ate.getTime() - DIAS_HISTORICO_AUTOMATICO * 24 * 60 * 60 * 1000);
  await enfileirarPeriodo(accountId, desde, ate, 50, true);
  await prisma.mercadoLivreAccount.update({
    where: { id: accountId },
    data: { versaoDadosFinanceiros: VERSAO_DADOS_FINANCEIROS },
  });
}

export interface TarefaEmAndamento {
  id: string;
  tipo: TipoTarefaSincronizacao;
  status: StatusTarefaSincronizacao;
  processados: number;
  mesAtual: string | null;
  desde: string | null;
  ate: string | null;
  erro: string | null;
}

export interface StatusSincronizacao {
  contaConectada: boolean;
  pendente: boolean;
  tarefas: TarefaEmAndamento[];
  vendasAguardandoDetalhes: number;
  vendasComFalhaDeDetalhe: number;
  ultimaAtualizacaoEm: string | null;
  processandoAgora: boolean;
  ultimoWebhookPorTopico: Record<string, string | null>;
  alertaWebhooksAusentes: boolean;
  errosPendentes: number;
}

function mesDoCursor(cursor: unknown): string | null {
  if (!cursor || typeof cursor !== "object") return null;
  const inicio = (cursor as { inicioJanela?: string }).inicioJanela;
  if (!inicio) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" }).format(
    new Date(inicio)
  );
}

export async function obterStatusSincronizacao(userId: string): Promise<StatusSincronizacao> {
  const conta = await prisma.mercadoLivreAccount.findFirst({
    where: { userId, isActive: true },
    select: { id: true, ultimaSincronizacaoFinanceiraEm: true, financeiroProcessandoAte: true },
  });

  if (!conta) {
    return {
      contaConectada: false,
      pendente: false,
      tarefas: [],
      vendasAguardandoDetalhes: 0,
      vendasComFalhaDeDetalhe: 0,
      ultimaAtualizacaoEm: null,
      processandoAgora: false,
      ultimoWebhookPorTopico: {},
      alertaWebhooksAusentes: false,
      errosPendentes: 0,
    };
  }

  await garantirHistoricoAtualizado(conta.id);

  const limiteAlerta = new Date(Date.now() - HORAS_JANELA_ALERTA_WEBHOOK * 60 * 60 * 1000);
  const [tarefas, aguardando, comFalha, errosPendentes, webhooksPorTopico, webhookRecente, vendaRecente, ultimaTarefa] =
    await Promise.all([
      prisma.tarefaSincronizacaoFinanceira.findMany({
        where: {
          userId,
          contaCanalId: conta.id,
          tentativas: { lt: 5 },
          status: { in: [StatusTarefaSincronizacao.PENDENTE, StatusTarefaSincronizacao.EM_ANDAMENTO] },
        },
        orderBy: [{ prioridade: "desc" }, { criadaEm: "asc" }],
      }),
      prisma.vendaCanal.count({ where: filtroAguardandoDetalhes(conta.id) }),
      prisma.vendaCanal.count({
        where: { contaCanalId: conta.id, enriquecidoEm: null, enriquecimentoTentativas: { gte: 5 } },
      }),
      prisma.sincronizacaoFinanceiraErro.count({
        where: { userId, canal: CanalVenda.MERCADO_LIVRE, resolvidoEm: null },
      }),
      prisma.mercadoLivreWebhook.groupBy({
        by: ["topic"],
        where: { mercadoLivreAccountId: conta.id },
        _max: { receivedAt: true },
      }),
      prisma.mercadoLivreWebhook.findFirst({
        where: { mercadoLivreAccountId: conta.id, topic: "orders_v2", receivedAt: { gte: limiteAlerta } },
        select: { id: true },
      }),
      prisma.vendaCanal.findFirst({
        where: { userId, canal: CanalVenda.MERCADO_LIVRE, dataVenda: { gte: limiteAlerta } },
        select: { id: true },
      }),
      prisma.tarefaSincronizacaoFinanceira.findFirst({
        where: { userId, contaCanalId: conta.id, status: StatusTarefaSincronizacao.CONCLUIDA },
        orderBy: { concluidaEm: "desc" },
        select: { concluidaEm: true },
      }),
    ]);

  const ultimoWebhookPorTopico: Record<string, string | null> = {};
  for (const linha of webhooksPorTopico) {
    ultimoWebhookPorTopico[linha.topic] = linha._max.receivedAt?.toISOString() ?? null;
  }

  const candidatos = [conta.ultimaSincronizacaoFinanceiraEm, ultimaTarefa?.concluidaEm].filter(
    (d): d is Date => d instanceof Date
  );
  const ultimaAtualizacao = candidatos.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    contaConectada: true,
    pendente: tarefas.length > 0 || aguardando > 0,
    tarefas: tarefas.map((t) => ({
      id: t.id,
      tipo: t.tipo,
      status: t.status,
      processados: t.processados,
      mesAtual: mesDoCursor(t.cursor),
      desde: t.desde?.toISOString() ?? null,
      ate: t.ate?.toISOString() ?? null,
      erro: t.erro,
    })),
    vendasAguardandoDetalhes: aguardando,
    vendasComFalhaDeDetalhe: comFalha,
    ultimaAtualizacaoEm: ultimaAtualizacao?.toISOString() ?? null,
    processandoAgora: conta.financeiroProcessandoAte != null && conta.financeiroProcessandoAte > new Date(),
    ultimoWebhookPorTopico,
    alertaWebhooksAusentes: Boolean(vendaRecente) && !webhookRecente,
    errosPendentes,
  };
}
