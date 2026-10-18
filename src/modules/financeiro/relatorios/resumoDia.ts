import { GrupoDre, StatusLancamento, StatusVendaCanal, TipoLancamento, CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inicioDoDia, fimDoDia, inicioDoMes, fimDoMes, competenciaDe, type Competencia } from "../dominio/periodo";
import { calcularPontoEquilibrio } from "../dominio/formulas";
import { comCacheFinanceiro } from "./cache";
import {
  agruparVendas,
  buscarVendasParaCalculo,
  calcularIndicadores,
  obterConfigRelatorio,
  type Indicadores,
} from "./motor";

const DIA_MS = 24 * 60 * 60 * 1000;

function diasNoMes(competencia: Competencia): number {
  return new Date(Date.UTC(competencia.ano, competencia.mes, 0)).getUTCDate();
}

export interface Diferenca {
  valorAtual: number;
  valorComparado: number;
  percentual: number | null;
}

/** Variação percentual só quando a base é relevante — evita "+1.059%" contra um dia com uma venda só. */
function calcularDiferenca(valorAtual: number, valorComparado: number, baseMinima = 0): Diferenca {
  return {
    valorAtual,
    valorComparado,
    percentual:
      valorComparado === 0 || Math.abs(valorComparado) < baseMinima
        ? null
        : (valorAtual - valorComparado) / Math.abs(valorComparado),
  };
}

function compararIndicadores(atual: Indicadores, comparado: Indicadores) {
  return {
    faturamento: calcularDiferenca(atual.receitaTotal, comparado.receitaTotal, 1000),
    margemContribuicao: calcularDiferenca(atual.margemContribuicao, comparado.margemContribuicao, 1000),
    pedidos: calcularDiferenca(atual.pedidos, comparado.pedidos, 3),
  };
}

export type Comparacao = ReturnType<typeof compararIndicadores>;

interface ContasAPagarResumo {
  vencendoHoje: { quantidade: number; valor: number };
  vencidas: { quantidade: number; valor: number };
  proximos7Dias: { quantidade: number; valor: number };
}

async function contasAPagarDoDia(userId: string, dia: Date): Promise<ContasAPagarResumo> {
  const inicio = inicioDoDia(dia);
  const fim = fimDoDia(dia);
  const fim7Dias = fimDoDia(new Date(dia.getTime() + 7 * DIA_MS));
  const base = { userId, tipo: TipoLancamento.DESPESA, status: StatusLancamento.PREVISTO };

  const [vencendoHoje, vencidas, proximos7Dias] = await Promise.all([
    prisma.lancamentoFinanceiro.aggregate({
      where: { ...base, vencimento: { gte: inicio, lte: fim } },
      _sum: { valor: true },
      _count: { _all: true },
    }),
    prisma.lancamentoFinanceiro.aggregate({
      where: { ...base, vencimento: { lt: inicio } },
      _sum: { valor: true },
      _count: { _all: true },
    }),
    prisma.lancamentoFinanceiro.aggregate({
      where: { ...base, vencimento: { gt: fim, lte: fim7Dias } },
      _sum: { valor: true },
      _count: { _all: true },
    }),
  ]);

  return {
    vencendoHoje: { quantidade: vencendoHoje._count._all, valor: vencendoHoje._sum.valor ?? 0 },
    vencidas: { quantidade: vencidas._count._all, valor: vencidas._sum.valor ?? 0 },
    proximos7Dias: { quantidade: proximos7Dias._count._all, valor: proximos7Dias._sum.valor ?? 0 },
  };
}

async function valorALiberarNoDia(userId: string, dia: Date): Promise<number> {
  const resultado = await prisma.vendaCanal.aggregate({
    where: {
      userId,
      dataLiberacao: { gte: inicioDoDia(dia), lte: fimDoDia(dia) },
      status: { notIn: [StatusVendaCanal.CANCELADA, StatusVendaCanal.DEVOLVIDA] },
    },
    _sum: { valorLiquidoReceber: true },
  });
  return resultado._sum.valorLiquidoReceber ?? 0;
}

export interface ResumoDia {
  dia: Date;
  indicadores: Indicadores;
  comparacaoOntem: Comparacao;
  comparacaoSemanaPassada: Comparacao;
  comparacaoMedia7Dias: Comparacao;
  contasAPagar: ContasAPagarResumo;
  valorALiberarHoje: number;
}

export async function gerarResumoDia(
  userId: string,
  algumInstanteDoDia: Date,
  canal?: CanalVenda
): Promise<ResumoDia> {
  const dia = inicioDoDia(algumInstanteDoDia);
  const config = await obterConfigRelatorio(userId);
  const chave = `resumo-dia:${dia.toISOString()}:${canal ?? "todos"}:${config.modoFaturamento}:${config.aliquotaImposto}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const filtros = { canal };
    const ontem = inicioDoDia(new Date(dia.getTime() - DIA_MS));
    const semanaPassada = inicioDoDia(new Date(dia.getTime() - 7 * DIA_MS));
    const inicio7Dias = semanaPassada;
    const fim7Dias = fimDoDia(ontem);

    const [hoje, indOntem, indSemanaPassada, ind7Dias, contasAPagar, valorALiberarHoje] = await Promise.all([
      calcularIndicadores(userId, dia, fimDoDia(dia), { filtros, config }),
      calcularIndicadores(userId, ontem, fimDoDia(ontem), { filtros, config }),
      calcularIndicadores(userId, semanaPassada, fimDoDia(semanaPassada), { filtros, config }),
      calcularIndicadores(userId, inicio7Dias, fim7Dias, { filtros, config }),
      contasAPagarDoDia(userId, dia),
      valorALiberarNoDia(userId, dia),
    ]);

    const media7: Indicadores = {
      ...ind7Dias,
      receitaTotal: Math.round(ind7Dias.receitaTotal / 7),
      margemContribuicao: Math.round(ind7Dias.margemContribuicao / 7),
      pedidos: Math.round((ind7Dias.pedidos / 7) * 10) / 10,
    };

    return {
      dia,
      indicadores: hoje,
      comparacaoOntem: compararIndicadores(hoje, indOntem),
      comparacaoSemanaPassada: compararIndicadores(hoje, indSemanaPassada),
      comparacaoMedia7Dias: compararIndicadores(hoje, media7),
      contasAPagar,
      valorALiberarHoje,
    };
  });
}

async function despesasFixasDoMes(userId: string, competencia: Competencia): Promise<number> {
  const instante = new Date(Date.UTC(competencia.ano, competencia.mes - 1, 15, 12));
  const resultado = await prisma.lancamentoFinanceiro.findMany({
    where: {
      userId,
      competencia: { gte: inicioDoMes(instante), lte: fimDoMes(instante) },
      status: { not: StatusLancamento.CANCELADO },
      tipo: { not: TipoLancamento.TRANSFERENCIA },
      categoria: { grupoDre: GrupoDre.DESPESA_OPERACIONAL },
    },
    select: { tipo: true, valor: true },
  });
  return resultado.reduce((soma, l) => soma + (l.tipo === TipoLancamento.DESPESA ? l.valor : -l.valor), 0);
}

export interface PontoEquilibrioMes {
  despesasFixasDoMes: number;
  pontoEquilibrio: number | null;
  faturamentoDoMes: number;
  faltaVender: number | null;
  motivoIndisponivel: "SEM_DESPESAS_CADASTRADAS" | "MARGEM_NEGATIVA" | null;
}

export interface MetaMes {
  metaFaturamentoMensal: number | null;
  percentualMeta: number | null;
  diasTranscorridos: number;
  diasNoMes: number;
  mesEmAndamento: boolean;
  projecaoFechamento: number;
}

export interface ResumoPeriodo {
  desde: Date;
  ate: Date;
  indicadores: Indicadores;
  periodoAnterior: { desde: Date; ate: Date; indicadores: Indicadores };
  comparacaoPeriodoAnterior: Comparacao;
  mes: Competencia;
  pontoEquilibrioMes: PontoEquilibrioMes;
  metaMes: MetaMes;
}

/**
 * Resumo de um período arbitrário + o fechamento do mês que contém o fim do
 * período (ponto de equilíbrio, meta e projeção). Tudo vem do motor único.
 */
export async function gerarResumoPeriodo(
  userId: string,
  desde: Date,
  ate: Date,
  canal?: CanalVenda
): Promise<ResumoPeriodo> {
  const config = await obterConfigRelatorio(userId);
  const chave = `resumo-periodo:${desde.toISOString()}:${ate.toISOString()}:${canal ?? "todos"}:${config.modoFaturamento}:${config.aliquotaImposto}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const filtros = { canal };
    const agora = new Date();
    const referencia = ate < agora ? ate : agora;
    const competencia = competenciaDe(referencia);
    const inicioMes = inicioDoMes(referencia);
    const fimMes = fimDoMes(referencia);
    const duracao = ate.getTime() - desde.getTime();
    const anteriorAte = new Date(desde.getTime() - 1);
    const anteriorDesde = new Date(anteriorAte.getTime() - duracao);

    const [indicadores, anterior, indicadoresMes, despesasFixas, configMeta] = await Promise.all([
      calcularIndicadores(userId, desde, ate, { filtros, config }),
      calcularIndicadores(userId, anteriorDesde, anteriorAte, { filtros, config }),
      calcularIndicadores(userId, inicioMes, fimMes, { filtros, config }),
      despesasFixasDoMes(userId, competencia),
      prisma.configuracaoGeral.findUnique({ where: { userId }, select: { metaFaturamentoMensal: true } }),
    ]);

    const margemSemDespesas =
      indicadoresMes.receitaTotal === 0
        ? null
        : indicadoresMes.margemContribuicao / indicadoresMes.receitaTotal;
    let pontoEquilibrio: number | null = null;
    let motivoIndisponivel: PontoEquilibrioMes["motivoIndisponivel"] = null;
    if (despesasFixas <= 0) motivoIndisponivel = "SEM_DESPESAS_CADASTRADAS";
    else if (margemSemDespesas == null || margemSemDespesas <= 0) motivoIndisponivel = "MARGEM_NEGATIVA";
    else pontoEquilibrio = calcularPontoEquilibrio(despesasFixas, margemSemDespesas);

    const totalDias = diasNoMes(competencia);
    const mesEmAndamento = agora >= inicioMes && agora <= fimMes;
    const diasTranscorridos = mesEmAndamento
      ? Math.max(1, Math.round((inicioDoDia(agora).getTime() - inicioMes.getTime()) / DIA_MS) + 1)
      : totalDias;
    const projecaoFechamento = mesEmAndamento
      ? Math.round((indicadoresMes.receitaTotal / diasTranscorridos) * totalDias)
      : indicadoresMes.receitaTotal;
    const meta = configMeta?.metaFaturamentoMensal ?? null;

    return {
      desde,
      ate,
      indicadores,
      periodoAnterior: { desde: anteriorDesde, ate: anteriorAte, indicadores: anterior },
      comparacaoPeriodoAnterior: compararIndicadores(indicadores, anterior),
      mes: competencia,
      pontoEquilibrioMes: {
        despesasFixasDoMes: despesasFixas,
        pontoEquilibrio,
        faturamentoDoMes: indicadoresMes.receitaTotal,
        faltaVender: pontoEquilibrio == null ? null : Math.max(0, pontoEquilibrio - indicadoresMes.receitaTotal),
        motivoIndisponivel,
      },
      metaMes: {
        metaFaturamentoMensal: meta,
        percentualMeta: meta == null || meta === 0 ? null : indicadoresMes.receitaTotal / meta,
        diasTranscorridos,
        diasNoMes: totalDias,
        mesEmAndamento,
        projecaoFechamento,
      },
    };
  });
}

export interface PontoSerieDiaria {
  dia: Date;
  faturamento: number;
  margemContribuicao: number;
  pedidos: number;
  unidades: number;
}

function chaveDiaSp(data: Date): string {
  return inicioDoDia(data).toISOString();
}

/** Uma linha por dia do intervalo (dias sem venda aparecem com zero), com a mesma regra do total. */
export async function gerarSerieDiaria(
  userId: string,
  desde: Date,
  ate: Date,
  canal?: CanalVenda
): Promise<PontoSerieDiaria[]> {
  const config = await obterConfigRelatorio(userId);
  const chave = `serie-diaria:${desde.toISOString()}:${ate.toISOString()}:${canal ?? "todos"}:${config.modoFaturamento}:${config.aliquotaImposto}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const agora = new Date();
    const fim = ate < agora ? ate : agora;
    const vendas = await buscarVendasParaCalculo(userId, desde, fim, { canal });
    const baldes = agruparVendas(vendas, config, (v) => chaveDiaSp(v.dataVenda));

    const pontos: PontoSerieDiaria[] = [];
    let cursor = inicioDoDia(desde);
    while (cursor <= fim) {
      const totais = baldes.get(cursor.toISOString());
      pontos.push({
        dia: cursor,
        faturamento: totais?.receitaTotal ?? 0,
        margemContribuicao: totais?.margemContribuicaoVendas ?? 0,
        pedidos: totais?.pedidos ?? 0,
        unidades: totais?.unidades ?? 0,
      });
      cursor = new Date(fimDoDia(cursor).getTime() + 1);
    }
    return pontos;
  });
}
