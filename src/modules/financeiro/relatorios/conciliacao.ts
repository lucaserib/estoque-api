import {
  CanalVenda,
  Confianca,
  OrigemLancamento,
  StatusLancamento,
  TipoLancamento,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { seedPlanoContasPadrao } from "../lancamentos/planoContasPadrao";
import { inicioDoMes, fimDoMes } from "../dominio/periodo";

const LIMITE_ALERTA_PERCENTUAL = 0.01;

const NOME_CATEGORIA_POR_TIPO: Record<string, string> = {
  TARIFA_VENDA: "Tarifas de marketplace",
  FRETE: "Frete de vendas",
};

export interface LinhaConciliacao {
  tipo: "TARIFA_VENDA" | "FRETE";
  totalPedidos: number;
  totalFatura: number;
  diferenca: number;
  diferencaPercentual: number | null;
  alerta: boolean;
}

export interface RelatorioConciliacao {
  mesReferencia: string;
  canal: CanalVenda;
  linhas: LinhaConciliacao[];
}

function limitesDoMes(mesReferencia: string): { inicio: Date; fim: Date } {
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const instanteDentroDoMes = new Date(Date.UTC(ano, mes - 1, 15, 12, 0, 0));
  return { inicio: inicioDoMes(instanteDentroDoMes), fim: fimDoMes(instanteDentroDoMes) };
}

export async function gerarRelatorioConciliacao(
  userId: string,
  canal: CanalVenda,
  mesReferencia: string
): Promise<RelatorioConciliacao> {
  const { inicio, fim } = limitesDoMes(mesReferencia);

  const [vendas, cobrancasPorTipo] = await Promise.all([
    prisma.vendaCanal.aggregate({
      where: { userId, canal, dataVenda: { gte: inicio, lte: fim } },
      _sum: { tarifaVenda: true, freteVendedor: true },
    }),
    prisma.cobrancaCanal.groupBy({
      by: ["tipoNormalizado"],
      where: { userId, canal, mesReferencia, coberturaPedido: true },
      _sum: { valor: true },
    }),
  ]);

  const totalPorTipo = (tipo: string) =>
    cobrancasPorTipo.find((c) => c.tipoNormalizado === tipo)?._sum.valor ?? 0;

  const linhas: LinhaConciliacao[] = (["TARIFA_VENDA", "FRETE"] as const).map((tipo) => {
    const totalPedidos =
      tipo === "TARIFA_VENDA" ? vendas._sum.tarifaVenda ?? 0 : vendas._sum.freteVendedor ?? 0;
    const totalFatura = totalPorTipo(tipo);
    const diferenca = totalFatura - totalPedidos;
    const diferencaPercentual = totalPedidos === 0 ? null : diferenca / totalPedidos;
    const alerta =
      diferencaPercentual != null && Math.abs(diferencaPercentual) > LIMITE_ALERTA_PERCENTUAL;

    return { tipo, totalPedidos, totalFatura, diferenca, diferencaPercentual, alerta };
  });

  return { mesReferencia, canal, linhas };
}

async function resolverCategoriaDoTipo(userId: string, tipo: string): Promise<string> {
  const nome = NOME_CATEGORIA_POR_TIPO[tipo] ?? "Outras";
  await seedPlanoContasPadrao(userId);

  const categoria = await prisma.categoriaFinanceira.findFirst({
    where: { userId, nome, paiId: null },
    select: { id: true },
  });
  if (!categoria) {
    throw new Error(`Categoria "${nome}" não encontrada mesmo após o seed do plano de contas`);
  }
  return categoria.id;
}

/**
 * Idempotente por mês/tipo/canal (chaveExterna) — clicar de novo no botão
 * depois que a fatura mudar atualiza o mesmo lançamento em vez de duplicar.
 */
export async function gerarLancamentoAjusteConciliacao(
  userId: string,
  criadoPorId: string,
  canal: CanalVenda,
  mesReferencia: string,
  linha: LinhaConciliacao
): Promise<{ id: string }> {
  const categoriaId = await resolverCategoriaDoTipo(userId, linha.tipo);
  const [ano, mes] = mesReferencia.split("-").map(Number);
  const competencia = new Date(Date.UTC(ano, mes - 1, 1));
  const chaveExterna = `conciliacao:${canal}:${mesReferencia}:${linha.tipo}`;

  const dadosComuns = {
    tipo: linha.diferenca > 0 ? TipoLancamento.DESPESA : TipoLancamento.RECEITA,
    descricao: `Ajuste de conciliação — ${linha.tipo} (${mesReferencia})`,
    valor: Math.abs(linha.diferenca),
    categoriaId,
  };

  const lancamento = await prisma.lancamentoFinanceiro.upsert({
    where: { userId_chaveExterna: { userId, chaveExterna } },
    create: {
      userId,
      criadoPorId,
      competencia,
      vencimento: competencia,
      status: StatusLancamento.PREVISTO,
      origem: OrigemLancamento.CONCILIACAO,
      confianca: Confianca.CONFIRMADO,
      chaveExterna,
      ...dadosComuns,
    },
    update: dadosComuns,
  });

  return { id: lancamento.id };
}
