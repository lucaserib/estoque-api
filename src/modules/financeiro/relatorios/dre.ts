import { CanalVenda, GrupoDre, RegimeTributario, TipoLancamento } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inicioDoMes, fimDoMes, type Competencia } from "../dominio/periodo";
import { comCacheFinanceiro } from "./cache";

function instanteDoMes(competencia: Competencia): Date {
  return new Date(Date.UTC(competencia.ano, competencia.mes - 1, 15, 12, 0, 0));
}

function mesAnterior(competencia: Competencia): Competencia {
  return competencia.mes === 1
    ? { ano: competencia.ano - 1, mes: 12 }
    : { ano: competencia.ano, mes: competencia.mes - 1 };
}

/** RECEITA soma, DESPESA subtrai, TRANSFERENCIA não afeta a DRE (é movimento entre contas próprias). */
function valorComSinal(tipo: TipoLancamento, valor: number): number {
  if (tipo === TipoLancamento.RECEITA) return valor;
  if (tipo === TipoLancamento.DESPESA) return -valor;
  return 0;
}

export interface ItemDespesaOperacional {
  categoriaId: string;
  nome: string;
  valor: number;
}

export interface DreMensal {
  competencia: Competencia;
  faturamentoBruto: number;
  cancelamentosEDevolucoes: number;
  descontos: number;
  receitaOperacionalBruta: number;
  impostosSobreVendas: number;
  receitaLiquida: number;
  custosVariaveis: {
    tarifas: number;
    frete: number;
    publicidade: number;
    armazenagemFull: number;
    outrasTarifasNaoMapeadas: number;
    freteDevolucaoEOutros: number;
    total: number;
  };
  cmv: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  despesasOperacionais: ItemDespesaOperacional[];
  totalDespesasOperacionais: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  impostoLucro: number;
  lucroLiquido: number;
  lucroLiquidoPercentual: number | null;
}

export interface RelatorioDre {
  meses: DreMensal[];
}

async function somarResumoDoMes(
  userId: string,
  competencia: Competencia,
  canal?: CanalVenda
) {
  const inicio = inicioDoMes(instanteDoMes(competencia));
  const fim = fimDoMes(instanteDoMes(competencia));

  const resumos = await prisma.resumoFinanceiroDiario.findMany({
    where: { userId, dia: { gte: inicio, lte: fim }, ...(canal && { canal }) },
    select: {
      faturamentoBruto: true,
      cancelamentos: true,
      descontos: true,
      impostos: true,
      tarifas: true,
      frete: true,
      ads: true,
      cmv: true,
      margemContribuicao: true,
    },
  });

  return resumos.reduce(
    (soma, r) => ({
      faturamentoBruto: soma.faturamentoBruto + r.faturamentoBruto,
      cancelamentos: soma.cancelamentos + r.cancelamentos,
      descontos: soma.descontos + r.descontos,
      impostos: soma.impostos + r.impostos,
      tarifas: soma.tarifas + r.tarifas,
      frete: soma.frete + r.frete,
      ads: soma.ads + r.ads,
      cmv: soma.cmv + r.cmv,
      margemContribuicao: soma.margemContribuicao + r.margemContribuicao,
    }),
    { faturamentoBruto: 0, cancelamentos: 0, descontos: 0, impostos: 0, tarifas: 0, frete: 0, ads: 0, cmv: 0, margemContribuicao: 0 }
  );
}

/**
 * Vendas de uma conta de canal específica (`contaCanalId`) não têm snapshot
 * próprio em ResumoFinanceiroDiario (ele só separa por `canal`, não por
 * conta dentro do canal) — nesse caso cai para a soma direta de VendaCanal,
 * mais lenta, só quando o filtro realmente pede uma conta específica.
 */
async function somarVendaCanalDoMes(
  userId: string,
  competencia: Competencia,
  canal: CanalVenda,
  contaCanalId: string
) {
  const inicio = inicioDoMes(instanteDoMes(competencia));
  const fim = fimDoMes(instanteDoMes(competencia));

  const vendas = await prisma.vendaCanal.findMany({
    where: { userId, canal, contaCanalId, dataVenda: { gte: inicio, lte: fim } },
    select: {
      faturamentoBruto: true,
      status: true,
      descontoVendedor: true,
      impostoEstimado: true,
      tarifaVenda: true,
      freteVendedor: true,
      adsAtribuido: true,
      cmv: true,
      margemContribuicao: true,
    },
  });

  const soma = {
    faturamentoBruto: 0, cancelamentos: 0, descontos: 0, impostos: 0,
    tarifas: 0, frete: 0, ads: 0, cmv: 0, margemContribuicao: 0,
  };
  for (const v of vendas) {
    if (v.status === "CANCELADA" || v.status === "DEVOLVIDA") {
      soma.cancelamentos += v.faturamentoBruto;
      continue;
    }
    soma.faturamentoBruto += v.faturamentoBruto;
    soma.descontos += v.descontoVendedor;
    soma.impostos += v.impostoEstimado;
    soma.tarifas += v.tarifaVenda;
    soma.frete += v.freteVendedor ?? 0;
    soma.ads += v.adsAtribuido;
    soma.cmv += v.cmv ?? 0;
    soma.margemContribuicao += v.margemContribuicao ?? 0;
  }
  return soma;
}

async function somarOutrosCustosDoMes(
  userId: string,
  competencia: Competencia,
  canal?: CanalVenda,
  contaCanalId?: string
): Promise<number> {
  const inicio = inicioDoMes(instanteDoMes(competencia));
  const fim = fimDoMes(instanteDoMes(competencia));

  const resultado = await prisma.vendaCanal.aggregate({
    where: {
      userId,
      dataVenda: { gte: inicio, lte: fim },
      ...(canal && { canal }),
      ...(contaCanalId && { contaCanalId }),
    },
    _sum: { outrosCustos: true },
  });
  return resultado._sum.outrosCustos ?? 0;
}

async function somarCobrancasDoMes(
  userId: string,
  competencia: Competencia,
  tipoNormalizado: string,
  canal?: CanalVenda
): Promise<number> {
  const mesReferencia = `${competencia.ano}-${String(competencia.mes).padStart(2, "0")}`;
  const resultado = await prisma.cobrancaCanal.aggregate({
    where: { userId, mesReferencia, tipoNormalizado, coberturaPedido: false, ...(canal && { canal }) },
    _sum: { valor: true },
  });
  return resultado._sum.valor ?? 0;
}

async function somarLancamentosPorGrupo(
  userId: string,
  competencia: Competencia,
  grupoDre: GrupoDre
): Promise<{ total: number; porCategoria: ItemDespesaOperacional[] }> {
  const inicio = inicioDoMes(instanteDoMes(competencia));
  const fim = fimDoMes(instanteDoMes(competencia));

  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where: { userId, competencia: { gte: inicio, lte: fim }, categoria: { grupoDre } },
    select: { tipo: true, valor: true, categoriaId: true, categoria: { select: { nome: true } } },
  });

  const porCategoriaMap = new Map<string, ItemDespesaOperacional>();
  let total = 0;
  for (const l of lancamentos) {
    const valor = -valorComSinal(l.tipo, l.valor); // despesas aparecem como número positivo "a deduzir"
    total += valor;
    const atual = porCategoriaMap.get(l.categoriaId);
    if (atual) {
      atual.valor += valor;
    } else {
      porCategoriaMap.set(l.categoriaId, { categoriaId: l.categoriaId, nome: l.categoria.nome, valor });
    }
  }

  return { total, porCategoria: [...porCategoriaMap.values()] };
}

export interface FiltrosDre {
  canal?: CanalVenda;
  contaCanalId?: string;
}

async function gerarDreDeUmMes(
  userId: string,
  competencia: Competencia,
  regimeTributario: RegimeTributario,
  filtros: FiltrosDre
): Promise<DreMensal> {
  const resumoVendas =
    filtros.contaCanalId && filtros.canal
      ? await somarVendaCanalDoMes(userId, competencia, filtros.canal, filtros.contaCanalId)
      : await somarResumoDoMes(userId, competencia, filtros.canal);

  const [armazenagemFull, outrasTarifasNaoMapeadas, freteDevolucaoEOutros, despesasOperacionais, resultadoFinanceiro, impostoLucroBruto] =
    await Promise.all([
      somarCobrancasDoMes(userId, competencia, "ARMAZENAGEM_FULL", filtros.canal),
      somarCobrancasDoMes(userId, competencia, "NAO_MAPEADO", filtros.canal),
      somarOutrosCustosDoMes(userId, competencia, filtros.canal, filtros.contaCanalId),
      somarLancamentosPorGrupo(userId, competencia, "DESPESA_OPERACIONAL"),
      somarLancamentosPorGrupo(userId, competencia, "RESULTADO_FINANCEIRO"),
      somarLancamentosPorGrupo(userId, competencia, "IMPOSTO_LUCRO"),
    ]);

  const receitaOperacionalBruta =
    resumoVendas.faturamentoBruto - resumoVendas.cancelamentos - resumoVendas.descontos;
  const receitaLiquida = receitaOperacionalBruta - resumoVendas.impostos;

  const custosVariaveis = {
    tarifas: resumoVendas.tarifas,
    frete: resumoVendas.frete,
    publicidade: resumoVendas.ads,
    armazenagemFull,
    outrasTarifasNaoMapeadas,
    freteDevolucaoEOutros,
    total:
      resumoVendas.tarifas +
      resumoVendas.frete +
      resumoVendas.ads +
      armazenagemFull +
      outrasTarifasNaoMapeadas +
      freteDevolucaoEOutros,
  };

  const margemContribuicao = receitaLiquida - custosVariaveis.total - resumoVendas.cmv;
  const resultadoOperacional = margemContribuicao - despesasOperacionais.total;
  const impostoLucro =
    regimeTributario === RegimeTributario.SIMPLES ? 0 : impostoLucroBruto.total;
  // somarLancamentosPorGrupo devolve no padrão "despesa é positivo, a
  // deduzir" (certo para despesasOperacionais/impostoLucro, que só somam
  // DESPESA e são sempre subtraídos). RESULTADO_FINANCEIRO mistura RECEITA
  // ("Rendimentos") e DESPESA ("Juros e tarifas") por desenho do plano de
  // contas padrão, e entra somando no lucro líquido — por isso o sinal
  // precisa ser invertido de volta aqui: rendimento aumenta o lucro, juro paga reduz.
  const resultadoFinanceiroLiquido = -resultadoFinanceiro.total;
  const lucroLiquido = resultadoOperacional + resultadoFinanceiroLiquido - impostoLucro;

  return {
    competencia,
    faturamentoBruto: resumoVendas.faturamentoBruto,
    cancelamentosEDevolucoes: resumoVendas.cancelamentos,
    descontos: resumoVendas.descontos,
    receitaOperacionalBruta,
    impostosSobreVendas: resumoVendas.impostos,
    receitaLiquida,
    custosVariaveis,
    cmv: resumoVendas.cmv,
    margemContribuicao,
    margemContribuicaoPercentual: receitaLiquida === 0 ? null : margemContribuicao / receitaLiquida,
    despesasOperacionais: despesasOperacionais.porCategoria,
    totalDespesasOperacionais: despesasOperacionais.total,
    resultadoOperacional,
    resultadoFinanceiro: resultadoFinanceiroLiquido,
    impostoLucro,
    lucroLiquido,
    lucroLiquidoPercentual: receitaLiquida === 0 ? null : lucroLiquido / receitaLiquida,
  };
}

export async function gerarDre(
  userId: string,
  ate: Competencia,
  quantidadeDeMeses: number,
  filtros: FiltrosDre = {}
): Promise<RelatorioDre> {
  const chave = `dre:${ate.ano}-${ate.mes}:${quantidadeDeMeses}:${filtros.canal ?? "todos"}:${filtros.contaCanalId ?? "todas"}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const config = await prisma.configuracaoGeral.findUnique({
      where: { userId },
      select: { regimeTributario: true },
    });
    const regimeTributario = config?.regimeTributario ?? RegimeTributario.SIMPLES;

    const meses: DreMensal[] = [];
    let competencia = ate;
    for (let i = 0; i < Math.min(quantidadeDeMeses, 12); i++) {
      meses.unshift(await gerarDreDeUmMes(userId, competencia, regimeTributario, filtros));
      competencia = mesAnterior(competencia);
    }

    return { meses };
  });
}
