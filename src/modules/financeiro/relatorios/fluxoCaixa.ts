import { StatusLancamento, TipoLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inicioDoDia, inicioDaSemana, inicioDoMes } from "../dominio/periodo";
import { comCacheFinanceiro } from "./cache";
import { calcularSaldoTotalAtual } from "./saldoContas";

export type Granularidade = "DIA" | "SEMANA" | "MES";

/**
 * Diferente da DRE (onde TRANSFERENCIA não conta — é só rearranjo entre
 * contas próprias): aqui toda TRANSFERENCIA sai como saída de caixa real,
 * porque a única que este sistema de fato gera (pagamento de fatura de
 * cartão) é dinheiro saindo da conta bancária de verdade, sem um lançamento
 * irmão de entrada em lugar nenhum — não é um "wash" de duas pontas.
 */
export function valorComoCaixa(tipo: TipoLancamento, valor: number): number {
  if (tipo === TipoLancamento.RECEITA) return valor;
  return -valor;
}

function bucketPara(data: Date, granularidade: Granularidade): Date {
  if (granularidade === "DIA") return inicioDoDia(data);
  if (granularidade === "SEMANA") return inicioDaSemana(data);
  return inicioDoMes(data);
}

export interface PontoFluxoCaixa {
  periodo: Date;
  realizado: number;
  previsto: number;
}

export interface FluxoCaixa {
  granularidade: Granularidade;
  pontos: PontoFluxoCaixa[];
}

export async function gerarFluxoCaixa(
  userId: string,
  desde: Date,
  ate: Date,
  granularidade: Granularidade
): Promise<FluxoCaixa> {
  const chave = `fluxo-caixa:${desde.toISOString()}:${ate.toISOString()}:${granularidade}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const [realizados, previstos] = await Promise.all([
      prisma.lancamentoFinanceiro.findMany({
        where: { userId, status: StatusLancamento.PAGO, pagamento: { gte: desde, lte: ate } },
        select: { tipo: true, valor: true, pagamento: true },
      }),
      prisma.lancamentoFinanceiro.findMany({
        where: { userId, status: StatusLancamento.PREVISTO, vencimento: { gte: desde, lte: ate } },
        select: { tipo: true, valor: true, vencimento: true },
      }),
    ]);

    const pontosPorChave = new Map<string, PontoFluxoCaixa>();
    const obterPonto = (data: Date): PontoFluxoCaixa => {
      const bucket = bucketPara(data, granularidade);
      const chaveBucket = bucket.toISOString();
      let ponto = pontosPorChave.get(chaveBucket);
      if (!ponto) {
        ponto = { periodo: bucket, realizado: 0, previsto: 0 };
        pontosPorChave.set(chaveBucket, ponto);
      }
      return ponto;
    };

    for (const l of realizados) {
      if (!l.pagamento) continue;
      obterPonto(l.pagamento).realizado += valorComoCaixa(l.tipo, l.valor);
    }
    for (const l of previstos) {
      obterPonto(l.vencimento).previsto += valorComoCaixa(l.tipo, l.valor);
    }

    const pontos = [...pontosPorChave.values()].sort(
      (a, b) => a.periodo.getTime() - b.periodo.getTime()
    );
    return { granularidade, pontos };
  });
}

export interface SaldoProjetado {
  dias: 30 | 60 | 90;
  saldoAtual: number;
  liberacoesFuturas: number;
  lancamentosPrevistos: number;
  saldoProjetado: number;
}

/**
 * Cartão de crédito não entra no saldo atual — ele representa dívida, não
 * dinheiro disponível. `saldoAtual` vem de `calcularSaldoTotalAtual`: saldo
 * real da API do Mercado Pago para a carteira automática (quando disponível
 * e confirmado) ou saldo inicial + lançamentos pagos para as demais contas
 * (Fase 4 do Ciclo 9 — antes disso o cálculo usava só o saldo inicial
 * estático, ignorando qualquer lançamento já pago).
 */
export async function gerarSaldoProjetado(
  userId: string,
  dias: 30 | 60 | 90
): Promise<SaldoProjetado> {
  const hoje = new Date();
  const horizonte = new Date(hoje.getTime() + dias * 24 * 60 * 60 * 1000);

  const [saldoAtual, vendas, lancamentos] = await Promise.all([
    calcularSaldoTotalAtual(userId),
    prisma.vendaCanal.findMany({
      where: { userId, dataLiberacao: { gte: hoje, lte: horizonte } },
      select: { valorLiquidoReceber: true },
    }),
    prisma.lancamentoFinanceiro.findMany({
      where: { userId, status: StatusLancamento.PREVISTO, vencimento: { gte: hoje, lte: horizonte } },
      select: { tipo: true, valor: true },
    }),
  ]);

  const liberacoesFuturas = vendas.reduce((soma, v) => soma + (v.valorLiquidoReceber ?? 0), 0);
  const lancamentosPrevistos = lancamentos.reduce(
    (soma, l) => soma + valorComoCaixa(l.tipo, l.valor),
    0
  );

  return {
    dias,
    saldoAtual,
    liberacoesFuturas,
    lancamentosPrevistos,
    saldoProjetado: saldoAtual + liberacoesFuturas + lancamentosPrevistos,
  };
}
