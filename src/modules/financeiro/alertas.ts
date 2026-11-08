import { CanalVenda, StatusLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationService } from "@/services/notificationService";
import { inicioDoDia, fimDoDia, competenciaDe } from "./dominio/periodo";
import { gerarRelatorioConciliacao } from "./relatorios/conciliacao";
import { calcularReposicaoConta } from "@/services/reposicaoService";

const TRES_DIAS_MS = 3 * 24 * 60 * 60 * 1000;

export interface ResultadoAlertasFinanceiros {
  contasAVencer: number;
  contasVencidas: number;
  vendasComPrejuizo: number;
  divergenciasConciliacao: number;
  rupturasPrevistas: number;
}

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

  const { sugestoes } = await calcularReposicaoConta(userId);
  const emRuptura = sugestoes.filter((s) => s.status === "critico");
  for (const sugestao of emRuptura) {
    await NotificationService.notifyEstoqueCritico(userId, sugestao.nome, sugestao.produtoId);
  }

  return {
    contasAVencer: aVencer.length,
    contasVencidas: vencidas.length,
    vendasComPrejuizo: vendasComPrejuizo.length,
    divergenciasConciliacao: linhasComAlerta.length,
    rupturasPrevistas: emRuptura.length,
  };
}
