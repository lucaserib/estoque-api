import { CanalVenda, StatusLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/services/notificationService";
import { inicioDoDia, fimDoDia, competenciaDe } from "./dominio/periodo";
import { gerarRelatorioConciliacao } from "./relatorios/conciliacao";

const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;

export interface ResultadoAlertasFinanceiros {
  contasAVencer: number;
  contasVencidas: number;
  vendasComPrejuizo: number;
  divergenciasConciliacao: number;
}

/**
 * Roda uma vez por dia (cron `financeiro-diario`) por conta (dono), já que o
 * plano Hobby da Vercel só executa cron 1x/dia. Contas a vencer/vencidas não
 * dependem de nenhuma conta ML conectada; vendas com prejuízo olham só os
 * últimos 3 dias (mesma janela do reprocessamento) para não re-notificar
 * venda antiga; a conciliação olha o mês de competência atual. Dedup contra
 * notificação não lida do mesmo tipo+link já é feito pelo próprio
 * `NotificationService.create` — rodar todo dia não duplica nada enquanto o
 * problema não for resolvido (pago, corrigido) nem a notificação for lida.
 */
export async function gerarAlertasFinanceiros(userId: string): Promise<ResultadoAlertasFinanceiros> {
  const agora = new Date();
  const amanha = new Date(agora.getTime() + 24 * 60 * 60 * 1000);

  const [aVencer, vencidas, vendasComPrejuizo] = await Promise.all([
    prisma.lancamentoFinanceiro.findMany({
      where: {
        userId,
        status: StatusLancamento.PREVISTO,
        vencimento: { gte: inicioDoDia(amanha), lte: fimDoDia(amanha) },
      },
      select: { id: true, descricao: true, valor: true },
    }),
    prisma.lancamentoFinanceiro.findMany({
      where: {
        userId,
        status: StatusLancamento.PREVISTO,
        vencimento: { lt: inicioDoDia(agora) },
      },
      select: { id: true, descricao: true, valor: true },
    }),
    prisma.vendaCanal.findMany({
      where: {
        userId,
        completo: true,
        margemContribuicao: { lt: 0 },
        dataVenda: { gte: new Date(agora.getTime() - TRES_DIAS_MS) },
      },
      select: { id: true, pedidoExternoId: true, margemContribuicao: true },
    }),
  ]);

  for (const lancamento of aVencer) {
    await NotificationService.notifyContaAVencer(userId, lancamento.id, lancamento.descricao, lancamento.valor);
  }
  for (const lancamento of vencidas) {
    await NotificationService.notifyContaVencida(userId, lancamento.id, lancamento.descricao, lancamento.valor);
  }
  for (const venda of vendasComPrejuizo) {
    await NotificationService.notifyVendaComPrejuizo(
      userId,
      venda.id,
      venda.pedidoExternoId,
      venda.margemContribuicao ?? 0
    );
  }

  const { ano, mes } = competenciaDe(agora);
  const mesReferencia = `${ano}-${String(mes).padStart(2, "0")}`;
  const relatorio = await gerarRelatorioConciliacao(userId, CanalVenda.MERCADO_LIVRE, mesReferencia);
  const linhasComAlerta = relatorio.linhas.filter((l) => l.alerta);

  for (const linha of linhasComAlerta) {
    await NotificationService.notifyDivergenciaConciliacao(
      userId,
      mesReferencia,
      linha.tipo === "TARIFA_VENDA" ? "Tarifa de venda" : "Frete",
      linha.diferenca
    );
  }

  return {
    contasAVencer: aVencer.length,
    contasVencidas: vencidas.length,
    vendasComPrejuizo: vendasComPrejuizo.length,
    divergenciasConciliacao: linhasComAlerta.length,
  };
}
