import { CanalVenda, GrupoDre, StatusLancamento, TipoLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inicioDoDia, fimDoDia, competenciaDe, type Competencia } from "../dominio/periodo";
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
