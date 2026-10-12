import { CanalVenda, GrupoDre, StatusLancamento, TipoLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inicioDoDia, fimDoDia, inicioDoMes, fimDoMes, competenciaDe, type Competencia } from "../dominio/periodo";
import { calcularPontoEquilibrio } from "../dominio/formulas";
import { comCacheFinanceiro } from "./cache";

function diasNoMes(competencia: Competencia): number {
  return new Date(Date.UTC(competencia.ano, competencia.mes, 0)).getUTCDate();
}

export interface Diferenca {
  valorAtual: number;
  valorComparado: number;
  percentual: number | null;
}

function calcularDiferenca(valorAtual: number, valorComparado: number): Diferenca {
  return {
    valorAtual,
    valorComparado,
    percentual: valorComparado === 0 ? null : (valorAtual - valorComparado) / valorComparado,
  };
}

interface TotaisResumo {
  pedidos: number;
  unidades: number;
  faturamentoBruto: number;
  cancelamentos: number;
  descontos: number;
  tarifas: number;
  frete: number;
  ads: number;
  impostos: number;
  cmv: number;
  margemContribuicao: number;
}

async function somarPeriodo(userId: string, inicio: Date, fim: Date, canal?: CanalVenda): Promise<TotaisResumo> {
  const resumos = await prisma.resumoFinanceiroDiario.findMany({
    where: { userId, dia: { gte: inicio, lte: fim }, ...(canal && { canal }) },
    select: {
      pedidos: true, unidades: true, faturamentoBruto: true, cancelamentos: true,
      descontos: true, tarifas: true, frete: true, ads: true, impostos: true,
      cmv: true, margemContribuicao: true,
    },
  });

  return resumos.reduce(
    (soma, r) => ({
      pedidos: soma.pedidos + r.pedidos,
      unidades: soma.unidades + r.unidades,
      faturamentoBruto: soma.faturamentoBruto + r.faturamentoBruto,
      cancelamentos: soma.cancelamentos + r.cancelamentos,
      descontos: soma.descontos + r.descontos,
      tarifas: soma.tarifas + r.tarifas,
      frete: soma.frete + r.frete,
      ads: soma.ads + r.ads,
      impostos: soma.impostos + r.impostos,
      cmv: soma.cmv + r.cmv,
      margemContribuicao: soma.margemContribuicao + r.margemContribuicao,
    }),
    { pedidos: 0, unidades: 0, faturamentoBruto: 0, cancelamentos: 0, descontos: 0, tarifas: 0, frete: 0, ads: 0, impostos: 0, cmv: 0, margemContribuicao: 0 }
  );
}

async function despesasFixasDoMes(userId: string, competencia: Competencia): Promise<number> {
  const inicio = new Date(Date.UTC(competencia.ano, competencia.mes - 1, 1));
  const fim = new Date(Date.UTC(competencia.ano, competencia.mes, 0, 23, 59, 59, 999));

  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where: { userId, competencia: { gte: inicio, lte: fim }, categoria: { grupoDre: GrupoDre.DESPESA_OPERACIONAL } },
    select: { tipo: true, valor: true },
  });

  return lancamentos.reduce(
    (soma, l) => soma + (l.tipo === TipoLancamento.DESPESA ? l.valor : -l.valor),
    0
  );
}

interface ContasAPagarResumo {
  vencendoHoje: { quantidade: number; valor: number };
  vencidas: { quantidade: number; valor: number };
}

async function contasAPagarDoDia(userId: string, dia: Date): Promise<ContasAPagarResumo> {
  const inicio = inicioDoDia(dia);
  const fim = fimDoDia(dia);

  const [vencendoHoje, vencidas] = await Promise.all([
    prisma.lancamentoFinanceiro.findMany({
      where: { userId, tipo: TipoLancamento.DESPESA, status: StatusLancamento.PREVISTO, vencimento: { gte: inicio, lte: fim } },
      select: { valor: true },
    }),
    prisma.lancamentoFinanceiro.findMany({
      where: { userId, tipo: TipoLancamento.DESPESA, status: StatusLancamento.PREVISTO, vencimento: { lt: inicio } },
      select: { valor: true },
    }),
  ]);

  return {
    vencendoHoje: { quantidade: vencendoHoje.length, valor: vencendoHoje.reduce((s, l) => s + l.valor, 0) },
    vencidas: { quantidade: vencidas.length, valor: vencidas.reduce((s, l) => s + l.valor, 0) },
  };
}

async function valorALiberarNoDia(userId: string, dia: Date): Promise<number> {
  const inicio = inicioDoDia(dia);
  const fim = fimDoDia(dia);

  const vendas = await prisma.vendaCanal.findMany({
    where: { userId, dataLiberacao: { gte: inicio, lte: fim } },
    select: { valorLiquidoReceber: true },
  });
  return vendas.reduce((soma, v) => soma + (v.valorLiquidoReceber ?? 0), 0);
}

export interface ResumoDia extends TotaisResumo {
  dia: Date;
  lucroEstimado: number;
  ticketMedio: number | null;
  comparacaoOntem: {
    faturamentoBruto: Diferenca;
    margemContribuicao: Diferenca;
    pedidos: Diferenca;
  };
  comparacaoMedia7Dias: {
    faturamentoBruto: Diferenca;
    margemContribuicao: Diferenca;
    pedidos: Diferenca;
  };
  contasAPagar: ContasAPagarResumo;
  valorALiberarMercadoPago: number;
}

export async function gerarResumoDia(
  userId: string,
  algumInstanteDoDia: Date,
  canal?: CanalVenda
): Promise<ResumoDia> {
  const dia = inicioDoDia(algumInstanteDoDia);
  const chave = `resumo-dia:${dia.toISOString()}:${canal ?? "todos"}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const fim = fimDoDia(dia);
    const ontemInicio = inicioDoDia(new Date(dia.getTime() - 24 * 60 * 60 * 1000));
    const ontemFim = fimDoDia(ontemInicio);
    const seteDiasAtrasInicio = inicioDoDia(new Date(dia.getTime() - 7 * 24 * 60 * 60 * 1000));
    const seteDiasAtrasFim = fimDoDia(new Date(dia.getTime() - 1 * 24 * 60 * 60 * 1000));

    const [totaisHoje, totaisOntem, totaisUltimos7Dias, despesasFixas, contasAPagar, valorALiberar] =
      await Promise.all([
        somarPeriodo(userId, dia, fim, canal),
        somarPeriodo(userId, ontemInicio, ontemFim, canal),
        somarPeriodo(userId, seteDiasAtrasInicio, seteDiasAtrasFim, canal),
        despesasFixasDoMes(userId, competenciaDe(dia)),
        contasAPagarDoDia(userId, dia),
        valorALiberarNoDia(userId, dia),
      ]);

    const despesaFixaDiaria = despesasFixas / diasNoMes(competenciaDe(dia));
    const mediaUltimos7Dias = {
      faturamentoBruto: totaisUltimos7Dias.faturamentoBruto / 7,
      margemContribuicao: totaisUltimos7Dias.margemContribuicao / 7,
      pedidos: totaisUltimos7Dias.pedidos / 7,
    };

    return {
      dia,
      ...totaisHoje,
      lucroEstimado: totaisHoje.margemContribuicao - despesaFixaDiaria,
      ticketMedio: totaisHoje.pedidos === 0 ? null : totaisHoje.faturamentoBruto / totaisHoje.pedidos,
      comparacaoOntem: {
        faturamentoBruto: calcularDiferenca(totaisHoje.faturamentoBruto, totaisOntem.faturamentoBruto),
        margemContribuicao: calcularDiferenca(totaisHoje.margemContribuicao, totaisOntem.margemContribuicao),
        pedidos: calcularDiferenca(totaisHoje.pedidos, totaisOntem.pedidos),
      },
      comparacaoMedia7Dias: {
        faturamentoBruto: calcularDiferenca(totaisHoje.faturamentoBruto, mediaUltimos7Dias.faturamentoBruto),
        margemContribuicao: calcularDiferenca(totaisHoje.margemContribuicao, mediaUltimos7Dias.margemContribuicao),
        pedidos: calcularDiferenca(totaisHoje.pedidos, mediaUltimos7Dias.pedidos),
      },
      contasAPagar,
      valorALiberarMercadoPago: valorALiberar,
    };
  });
}

/** Mesma lógica de rateio diário do "lucro estimado do dia", só que somada dia a dia por um intervalo que pode cruzar meses (cada mês com sua própria despesa fixa). */
async function despesaFixaRateadaNoPeriodo(userId: string, desde: Date, ate: Date): Promise<number> {
  let total = 0;
  let cursor = desde;
  while (cursor <= ate) {
    const competencia = competenciaDe(cursor);
    const fimDoMesAtual = fimDoMes(cursor);
    const fimDoSegmento = fimDoMesAtual < ate ? fimDoMesAtual : ate;
    // Conta por dia de calendário (início do dia a início do dia), não por
    // duração em ms — cursor e fimDoSegmento raramente são ambos meia-noite
    // exata (fimDoSegmento é 23:59:59.999), e dividir a duração bruta por
    // 24h sofre erro de "cerca" (um segmento de 1 dia dá ~0.9999, não 1).
    const diasNesseSegmento =
      Math.round((inicioDoDia(fimDoSegmento).getTime() - inicioDoDia(cursor).getTime()) / (24 * 60 * 60 * 1000)) + 1;

    const despesasDoMes = await despesasFixasDoMes(userId, competencia);
    total += (despesasDoMes / diasNoMes(competencia)) * diasNesseSegmento;

    cursor = new Date(fimDoSegmento.getTime() + 1);
  }
  return Math.round(total);
}

export interface PontoEquilibrioMes {
  pontoEquilibrio: number | null;
  faturamentoBrutoAteAgora: number;
  faltaVender: number | null;
}

async function calcularPontoEquilibrioDoMes(
  userId: string,
  algumDiaDoMes: Date,
  canal?: CanalVenda
): Promise<PontoEquilibrioMes> {
  const competencia = competenciaDe(algumDiaDoMes);
  const inicioMes = inicioDoMes(algumDiaDoMes);
  const fimMes = fimDoMes(algumDiaDoMes);

  const [totaisDoMes, despesasFixas] = await Promise.all([
    somarPeriodo(userId, inicioMes, fimMes, canal),
    despesasFixasDoMes(userId, competencia),
  ]);

  const receitaLiquidaDoMes =
    totaisDoMes.faturamentoBruto - totaisDoMes.cancelamentos - totaisDoMes.descontos - totaisDoMes.impostos;
  const margemContribuicaoPercentual =
    receitaLiquidaDoMes === 0 ? null : totaisDoMes.margemContribuicao / receitaLiquidaDoMes;

  const pontoEquilibrio =
    margemContribuicaoPercentual == null ? null : calcularPontoEquilibrio(despesasFixas, margemContribuicaoPercentual);
  const faltaVender = pontoEquilibrio == null ? null : Math.max(0, pontoEquilibrio - totaisDoMes.faturamentoBruto);

  return { pontoEquilibrio, faturamentoBrutoAteAgora: totaisDoMes.faturamentoBruto, faltaVender };
}

export interface ResumoPeriodo extends TotaisResumo {
  desde: Date;
  ate: Date;
  margemContribuicaoPercentual: number | null;
  ticketMedio: number | null;
  lucroLiquido: number;
  pontoEquilibrioMes: PontoEquilibrioMes;
}

/**
 * Generaliza o "resumo do dia" para um intervalo arbitrário (o período
 * escolhido na Visão Geral, que não precisa ser um mês cheio — por isso não
 * reaproveita `gerarDre`, que é sempre por mês de calendário).
 */
export async function gerarResumoPeriodo(
  userId: string,
  desde: Date,
  ate: Date,
  canal?: CanalVenda
): Promise<ResumoPeriodo> {
  const chave = `resumo-periodo:${desde.toISOString()}:${ate.toISOString()}:${canal ?? "todos"}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const [totais, despesaFixaRateada, pontoEquilibrioMes] = await Promise.all([
      somarPeriodo(userId, desde, ate, canal),
      despesaFixaRateadaNoPeriodo(userId, desde, ate),
      calcularPontoEquilibrioDoMes(userId, ate, canal),
    ]);

    const receitaLiquida = totais.faturamentoBruto - totais.cancelamentos - totais.descontos - totais.impostos;

    return {
      desde,
      ate,
      ...totais,
      margemContribuicaoPercentual: receitaLiquida === 0 ? null : totais.margemContribuicao / receitaLiquida,
      ticketMedio: totais.pedidos === 0 ? null : totais.faturamentoBruto / totais.pedidos,
      lucroLiquido: totais.margemContribuicao - despesaFixaRateada,
      pontoEquilibrioMes,
    };
  });
}

export interface PontoSerieDiaria {
  dia: Date;
  faturamentoBruto: number;
  margemContribuicao: number;
}

/** Linha a linha do ResumoFinanceiroDiario no intervalo — sem agregação, é exatamente o que o gráfico diário da Visão Geral precisa. */
export async function gerarSerieDiaria(
  userId: string,
  desde: Date,
  ate: Date,
  canal?: CanalVenda
): Promise<PontoSerieDiaria[]> {
  const chave = `serie-diaria:${desde.toISOString()}:${ate.toISOString()}:${canal ?? "todos"}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const resumos = await prisma.resumoFinanceiroDiario.findMany({
      where: { userId, dia: { gte: inicioDoDia(desde), lte: fimDoDia(ate) }, ...(canal && { canal }) },
      select: { dia: true, faturamentoBruto: true, margemContribuicao: true },
      orderBy: { dia: "asc" },
    });

    const porDia = new Map<string, PontoSerieDiaria>();
    for (const r of resumos) {
      const chaveDia = r.dia.toISOString();
      const atual = porDia.get(chaveDia) ?? { dia: r.dia, faturamentoBruto: 0, margemContribuicao: 0 };
      atual.faturamentoBruto += r.faturamentoBruto;
      atual.margemContribuicao += r.margemContribuicao;
      porDia.set(chaveDia, atual);
    }

    return [...porDia.values()].sort((a, b) => a.dia.getTime() - b.dia.getTime());
  });
}
