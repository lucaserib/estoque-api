import {
  CanalVenda,
  GrupoDre,
  ModoFaturamento,
  Prisma,
  RegimeTributario,
  StatusLancamento,
  StatusVendaCanal,
  TipoLancamento,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ConfigRelatorio {
  aliquotaImposto: number;
  modoFaturamento: ModoFaturamento;
  regimeTributario: RegimeTributario;
  usarImpostoEstimado: boolean;
}

export async function obterConfigRelatorio(userId: string): Promise<ConfigRelatorio> {
  const config = await prisma.configuracaoGeral.findUnique({
    where: { userId },
    select: { aliquotaImposto: true, modoFaturamento: true, regimeTributario: true, usarImpostoEstimado: true },
  });
  return {
    aliquotaImposto: config?.aliquotaImposto ?? 0,
    modoFaturamento: config?.modoFaturamento ?? ModoFaturamento.PRODUTOS,
    regimeTributario: config?.regimeTributario ?? RegimeTributario.SIMPLES,
    usarImpostoEstimado: config?.usarImpostoEstimado ?? true,
  };
}

export const SELECT_VENDA_CALCULO = {
  id: true,
  pedidoExternoId: true,
  dataVenda: true,
  status: true,
  logistica: true,
  faturamentoBruto: true,
  valorEstornado: true,
  descontoVendedor: true,
  tarifaVenda: true,
  freteVendedor: true,
  freteComprador: true,
  adsAtribuido: true,
  cmv: true,
  outrosCustos: true,
  valorLiquidoReceber: true,
  retencaoDividas: true,
  dataLiberacao: true,
  enriquecidoEm: true,
  freteOrigem: true,
  faltando: true,
  itens: {
    select: {
      produtoId: true,
      quantidade: true,
      precoUnitario: true,
      custoUnitario: true,
      descontoCusteadoMl: true,
    },
  },
} satisfies Prisma.VendaCanalSelect;

export type VendaParaCalculo = Prisma.VendaCanalGetPayload<{ select: typeof SELECT_VENDA_CALCULO }>;

const STATUS_VALIDOS = new Set<StatusVendaCanal>([
  StatusVendaCanal.PAGA,
  StatusVendaCanal.DEVOLVIDA_PARCIAL,
  StatusVendaCanal.EM_MEDIACAO,
]);

export function vendaValida(status: StatusVendaCanal): boolean {
  return STATUS_VALIDOS.has(status);
}

export interface ResultadoVendaCalculado {
  valida: boolean;
  vendaBruta: number;
  cancelamento: number;
  faturamento: number;
  receitaFrete: number;
  receitaTotal: number;
  unidades: number;
  imposto: number;
  tarifa: number;
  frete: number;
  ads: number;
  cmv: number;
  outrosCustos: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  descontoCampanha: number;
  descontoCusteadoMl: number;
  semCusto: boolean;
  semFrete: boolean;
  aguardandoDetalhes: boolean;
  semVinculo: boolean;
}

export function calcularVenda(venda: VendaParaCalculo, config: ConfigRelatorio): ResultadoVendaCalculado {
  const valida = vendaValida(venda.status);
  const detalhada = venda.enriquecidoEm != null;
  const vendaBruta = venda.faturamentoBruto;
  const cancelamento = valida ? Math.min(venda.valorEstornado, vendaBruta) : vendaBruta;
  const faturamento = vendaBruta - cancelamento;
  const freteVendedor = venda.freteVendedor ?? 0;
  const freteComprador = valida ? venda.freteComprador : 0;

  let receitaFrete = 0;
  let frete = valida ? freteVendedor : detalhada ? freteVendedor : 0;
  if (valida && config.modoFaturamento === ModoFaturamento.PRODUTOS_E_FRETE_COMPRADOR) {
    receitaFrete = freteComprador;
    frete += freteComprador;
  } else if (valida && config.modoFaturamento === ModoFaturamento.PRODUTOS_MENOS_FRETE) {
    receitaFrete = -freteVendedor;
    frete = 0;
  } else if (valida && config.modoFaturamento === ModoFaturamento.PRODUTOS_E_FRETE_TOTAL) {
    receitaFrete = freteVendedor + freteComprador;
    frete += freteComprador;
  }

  const tarifa = valida ? venda.tarifaVenda : detalhada ? venda.tarifaVenda : 0;
  const imposto = valida ? Math.round(faturamento * config.aliquotaImposto) : 0;
  const cmv = valida ? venda.cmv ?? 0 : 0;
  const unidades = valida ? venda.itens.reduce((soma, item) => soma + item.quantidade, 0) : 0;
  const receitaTotal = faturamento + receitaFrete;
  const margemContribuicao =
    receitaTotal - imposto - tarifa - frete - venda.adsAtribuido - cmv - venda.outrosCustos;

  return {
    valida,
    vendaBruta,
    cancelamento,
    faturamento,
    receitaFrete,
    receitaTotal,
    unidades,
    imposto,
    tarifa,
    frete,
    ads: venda.adsAtribuido,
    cmv,
    outrosCustos: venda.outrosCustos,
    margemContribuicao,
    margemContribuicaoPercentual: receitaTotal === 0 ? null : margemContribuicao / receitaTotal,
    descontoCampanha: valida ? venda.descontoVendedor : 0,
    descontoCusteadoMl: valida ? venda.itens.reduce((soma, item) => soma + item.descontoCusteadoMl, 0) : 0,
    semCusto: valida && venda.cmv == null,
    semFrete: valida && venda.freteVendedor == null,
    aguardandoDetalhes: !detalhada,
    semVinculo: venda.itens.some((item) => item.produtoId == null),
  };
}

export interface TotaisVendas {
  pedidos: number;
  pedidosCancelados: number;
  unidades: number;
  vendasBrutas: number;
  cancelamentos: number;
  faturamento: number;
  receitaFrete: number;
  receitaTotal: number;
  impostos: number;
  tarifas: number;
  frete: number;
  adsAtribuido: number;
  cmv: number;
  outrosCustos: number;
  margemContribuicaoVendas: number;
  descontoCampanha: number;
  descontoCusteadoMl: number;
  liquidoAReceber: number;
  retencoes: number;
  vendasSemCusto: number;
  faturamentoSemCusto: number;
  vendasSemFrete: number;
  vendasAguardandoDetalhes: number;
  vendasSemVinculo: number;
}

export function totaisVendasVazios(): TotaisVendas {
  return {
    pedidos: 0,
    pedidosCancelados: 0,
    unidades: 0,
    vendasBrutas: 0,
    cancelamentos: 0,
    faturamento: 0,
    receitaFrete: 0,
    receitaTotal: 0,
    impostos: 0,
    tarifas: 0,
    frete: 0,
    adsAtribuido: 0,
    cmv: 0,
    outrosCustos: 0,
    margemContribuicaoVendas: 0,
    descontoCampanha: 0,
    descontoCusteadoMl: 0,
    liquidoAReceber: 0,
    retencoes: 0,
    vendasSemCusto: 0,
    faturamentoSemCusto: 0,
    vendasSemFrete: 0,
    vendasAguardandoDetalhes: 0,
    vendasSemVinculo: 0,
  };
}

export function acumularVenda(
  totais: TotaisVendas,
  venda: VendaParaCalculo,
  resultado: ResultadoVendaCalculado
): void {
  if (resultado.valida) totais.pedidos++;
  else totais.pedidosCancelados++;
  totais.unidades += resultado.unidades;
  totais.vendasBrutas += resultado.vendaBruta;
  totais.cancelamentos += resultado.cancelamento;
  totais.faturamento += resultado.faturamento;
  totais.receitaFrete += resultado.receitaFrete;
  totais.receitaTotal += resultado.receitaTotal;
  totais.impostos += resultado.imposto;
  totais.tarifas += resultado.tarifa;
  totais.frete += resultado.frete;
  totais.adsAtribuido += resultado.ads;
  totais.cmv += resultado.cmv;
  totais.outrosCustos += resultado.outrosCustos;
  totais.margemContribuicaoVendas += resultado.margemContribuicao;
  totais.descontoCampanha += resultado.descontoCampanha;
  totais.descontoCusteadoMl += resultado.descontoCusteadoMl;
  if (resultado.valida) {
    totais.liquidoAReceber += venda.valorLiquidoReceber ?? 0;
    totais.retencoes += venda.retencaoDividas;
  }
  if (resultado.semCusto) {
    totais.vendasSemCusto++;
    totais.faturamentoSemCusto += resultado.faturamento;
  }
  if (resultado.semFrete) totais.vendasSemFrete++;
  if (resultado.aguardandoDetalhes) totais.vendasAguardandoDetalhes++;
  if (resultado.semVinculo && resultado.valida) totais.vendasSemVinculo++;
}

export interface FiltrosMotor {
  canal?: CanalVenda;
  contaCanalId?: string;
  logistica?: string;
}

function whereVendas(userId: string, desde: Date, ate: Date, filtros: FiltrosMotor): Prisma.VendaCanalWhereInput {
  return {
    userId,
    dataVenda: { gte: desde, lte: ate },
    ...(filtros.canal && { canal: filtros.canal }),
    ...(filtros.contaCanalId && { contaCanalId: filtros.contaCanalId }),
    ...(filtros.logistica && { logistica: filtros.logistica }),
  };
}

export async function buscarVendasParaCalculo(
  userId: string,
  desde: Date,
  ate: Date,
  filtros: FiltrosMotor = {}
): Promise<VendaParaCalculo[]> {
  return prisma.vendaCanal.findMany({
    where: whereVendas(userId, desde, ate, filtros),
    select: SELECT_VENDA_CALCULO,
    orderBy: { dataVenda: "asc" },
  });
}

export function totalizarVendas(vendas: VendaParaCalculo[], config: ConfigRelatorio): TotaisVendas {
  const totais = totaisVendasVazios();
  for (const venda of vendas) acumularVenda(totais, venda, calcularVenda(venda, config));
  return totais;
}

export interface LinhaCategoria {
  categoriaId: string;
  nome: string;
  valor: number;
}

interface SomaPorGrupo {
  total: number;
  porCategoria: LinhaCategoria[];
}

function somaVazia(): SomaPorGrupo {
  return { total: 0, porCategoria: [] };
}

async function somarLancamentosPorGrupo(
  userId: string,
  desde: Date,
  ate: Date
): Promise<Map<GrupoDre, SomaPorGrupo>> {
  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where: {
      userId,
      competencia: { gte: desde, lte: ate },
      status: { not: StatusLancamento.CANCELADO },
      tipo: { not: TipoLancamento.TRANSFERENCIA },
    },
    select: {
      tipo: true,
      valor: true,
      categoriaId: true,
      categoria: { select: { nome: true, grupoDre: true } },
    },
  });

  const porGrupo = new Map<GrupoDre, SomaPorGrupo>();
  for (const l of lancamentos) {
    const grupo = l.categoria.grupoDre;
    const soma = porGrupo.get(grupo) ?? somaVazia();
    const valor = l.tipo === TipoLancamento.DESPESA ? l.valor : -l.valor;
    soma.total += valor;
    const linha = soma.porCategoria.find((c) => c.categoriaId === l.categoriaId);
    if (linha) linha.valor += valor;
    else soma.porCategoria.push({ categoriaId: l.categoriaId, nome: l.categoria.nome, valor });
    porGrupo.set(grupo, soma);
  }
  for (const soma of porGrupo.values()) soma.porCategoria.sort((a, b) => b.valor - a.valor);
  return porGrupo;
}

export const ROTULO_COBRANCA: Record<string, string> = {
  ARMAZENAGEM_FULL: "Armazenagem e serviços Full",
  PUBLICIDADE: "Publicidade (Product Ads)",
  TARIFA_VENDA: "Tarifa de venda",
  FRETE: "Frete (Mercado Envios)",
  TARIFA_MERCADO_PAGO: "Tarifas do Mercado Pago",
  BONIFICACAO: "Bonificações e estornos do ML",
  ASSINATURA: "Assinaturas e serviços do ML",
  NAO_MAPEADO: "Outras cobranças do ML",
};

export interface CobrancasPeriodo {
  total: number;
  armazenagemFull: number;
  outras: number;
  porTipo: Array<{ tipo: string; rotulo: string; valor: number }>;
  publicidadeFatura: number;
}

async function somarCobrancas(
  userId: string,
  desde: Date,
  ate: Date,
  filtros: FiltrosMotor
): Promise<CobrancasPeriodo> {
  const grupos = await prisma.cobrancaCanal.groupBy({
    by: ["tipoNormalizado"],
    where: {
      userId,
      data: { gte: desde, lte: ate },
      coberturaPedido: false,
      ...(filtros.canal && { canal: filtros.canal }),
      ...(filtros.contaCanalId && { contaCanalId: filtros.contaCanalId }),
    },
    _sum: { valor: true },
  });

  let armazenagemFull = 0;
  let outras = 0;
  let publicidadeFatura = 0;
  const porTipo: CobrancasPeriodo["porTipo"] = [];
  for (const grupo of grupos) {
    const valor = grupo._sum.valor ?? 0;
    if (grupo.tipoNormalizado === "PUBLICIDADE") {
      publicidadeFatura += valor;
      continue;
    }
    if (grupo.tipoNormalizado === "ARMAZENAGEM_FULL") armazenagemFull += valor;
    else outras += valor;
    porTipo.push({
      tipo: grupo.tipoNormalizado,
      rotulo: ROTULO_COBRANCA[grupo.tipoNormalizado] ?? grupo.tipoNormalizado,
      valor,
    });
  }
  porTipo.sort((a, b) => b.valor - a.valor);
  return { total: armazenagemFull + outras, armazenagemFull, outras, porTipo, publicidadeFatura };
}

export type OrigemAds = "ADS_DIARIO" | "FATURA" | "NENHUM";

async function somarAds(
  userId: string,
  desde: Date,
  ate: Date,
  filtros: FiltrosMotor,
  publicidadeFatura: number
): Promise<{ total: number; origem: OrigemAds }> {
  const ads = await prisma.gastoAdsCanal.aggregate({
    where: {
      userId,
      dia: { gte: desde, lte: ate },
      ...(filtros.canal && { canal: filtros.canal }),
      ...(filtros.contaCanalId && { contaCanalId: filtros.contaCanalId }),
    },
    _sum: { custo: true },
    _count: { _all: true },
  });
  if (ads._count._all > 0) return { total: ads._sum.custo ?? 0, origem: "ADS_DIARIO" };
  if (publicidadeFatura !== 0) return { total: publicidadeFatura, origem: "FATURA" };
  return { total: 0, origem: "NENHUM" };
}

export interface Indicadores {
  desde: Date;
  ate: Date;
  config: ConfigRelatorio;
  vendas: TotaisVendas;
  pedidos: number;
  unidades: number;
  vendasBrutas: number;
  cancelamentos: number;
  faturamento: number;
  receitaFrete: number;
  outrasReceitas: number;
  receitaTotal: number;
  impostos: number;
  receitaLiquida: number;
  custosVariaveis: {
    tarifas: number;
    frete: number;
    ads: number;
    armazenagemFull: number;
    outrasCobrancas: number;
    outrosCustos: number;
    lancamentos: number;
    total: number;
  };
  origemAds: OrigemAds;
  cobrancas: CobrancasPeriodo;
  cmv: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  despesasOperacionais: LinhaCategoria[];
  totalDespesasOperacionais: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  resultadoNaoOperacional: number;
  impostoLucro: number;
  lucroLiquido: number;
  lucroLiquidoPercentual: number | null;
  ticketMedio: number | null;
  descontoCampanha: number;
  descontoCusteadoMl: number;
  liquidoAReceber: number;
  retencoes: number;
  qualidade: {
    vendasSemCusto: number;
    faturamentoSemCusto: number;
    vendasSemFrete: number;
    vendasAguardandoDetalhes: number;
    vendasSemVinculo: number;
    lucroConfiavel: boolean;
  };
}

export interface OpcoesIndicadores {
  filtros?: FiltrosMotor;
  config?: ConfigRelatorio;
  vendas?: VendaParaCalculo[];
}

export async function calcularIndicadores(
  userId: string,
  desde: Date,
  ate: Date,
  opcoes: OpcoesIndicadores = {}
): Promise<Indicadores> {
  const filtros = opcoes.filtros ?? {};
  const [config, vendas, lancamentos, cobrancas] = await Promise.all([
    opcoes.config ? Promise.resolve(opcoes.config) : obterConfigRelatorio(userId),
    opcoes.vendas ? Promise.resolve(opcoes.vendas) : buscarVendasParaCalculo(userId, desde, ate, filtros),
    somarLancamentosPorGrupo(userId, desde, ate),
    somarCobrancas(userId, desde, ate, filtros),
  ]);
  const ads = await somarAds(userId, desde, ate, filtros, cobrancas.publicidadeFatura);

  const totais = totalizarVendas(vendas, config);
  const grupo = (g: GrupoDre) => lancamentos.get(g) ?? somaVazia();

  const outrasReceitas = -grupo(GrupoDre.RECEITA_BRUTA).total;
  const deducoesLancadas = grupo(GrupoDre.DEDUCAO_RECEITA).total;
  const receitaTotal = totais.receitaTotal + outrasReceitas - deducoesLancadas;
  const impostos = config.usarImpostoEstimado ? totais.impostos : grupo(GrupoDre.IMPOSTO_VENDA).total;
  const receitaLiquida = receitaTotal - impostos;

  const custosVariaveis = {
    tarifas: totais.tarifas,
    frete: totais.frete,
    ads: ads.total,
    armazenagemFull: cobrancas.armazenagemFull,
    outrasCobrancas: cobrancas.outras,
    outrosCustos: totais.outrosCustos,
    lancamentos: grupo(GrupoDre.CUSTO_VARIAVEL).total,
    total: 0,
  };
  custosVariaveis.total =
    custosVariaveis.tarifas +
    custosVariaveis.frete +
    custosVariaveis.ads +
    custosVariaveis.armazenagemFull +
    custosVariaveis.outrasCobrancas +
    custosVariaveis.outrosCustos +
    custosVariaveis.lancamentos;

  const margemContribuicao = receitaLiquida - custosVariaveis.total - totais.cmv;
  const despesas = grupo(GrupoDre.DESPESA_OPERACIONAL);
  const resultadoOperacional = margemContribuicao - despesas.total;
  const resultadoFinanceiro = -grupo(GrupoDre.RESULTADO_FINANCEIRO).total;
  const resultadoNaoOperacional = -grupo(GrupoDre.NAO_OPERACIONAL).total;
  const impostoLucro =
    config.regimeTributario === RegimeTributario.SIMPLES ? 0 : grupo(GrupoDre.IMPOSTO_LUCRO).total;
  const lucroLiquido = resultadoOperacional + resultadoFinanceiro + resultadoNaoOperacional - impostoLucro;

  return {
    desde,
    ate,
    config,
    vendas: totais,
    pedidos: totais.pedidos,
    unidades: totais.unidades,
    vendasBrutas: totais.vendasBrutas,
    cancelamentos: totais.cancelamentos,
    faturamento: totais.faturamento,
    receitaFrete: totais.receitaFrete,
    outrasReceitas,
    receitaTotal,
    impostos,
    receitaLiquida,
    custosVariaveis,
    origemAds: ads.origem,
    cobrancas,
    cmv: totais.cmv,
    margemContribuicao,
    margemContribuicaoPercentual: receitaTotal === 0 ? null : margemContribuicao / receitaTotal,
    despesasOperacionais: despesas.porCategoria,
    totalDespesasOperacionais: despesas.total,
    resultadoOperacional,
    resultadoFinanceiro,
    resultadoNaoOperacional,
    impostoLucro,
    lucroLiquido,
    lucroLiquidoPercentual: receitaTotal === 0 ? null : lucroLiquido / receitaTotal,
    ticketMedio: totais.pedidos === 0 ? null : Math.round(totais.receitaTotal / totais.pedidos),
    descontoCampanha: totais.descontoCampanha,
    descontoCusteadoMl: totais.descontoCusteadoMl,
    liquidoAReceber: totais.liquidoAReceber,
    retencoes: totais.retencoes,
    qualidade: {
      vendasSemCusto: totais.vendasSemCusto,
      faturamentoSemCusto: totais.faturamentoSemCusto,
      vendasSemFrete: totais.vendasSemFrete,
      vendasAguardandoDetalhes: totais.vendasAguardandoDetalhes,
      vendasSemVinculo: totais.vendasSemVinculo,
      lucroConfiavel: totais.vendasSemCusto === 0 && totais.vendasAguardandoDetalhes === 0,
    },
  };
}

export interface BaldeVendas {
  chave: string;
  totais: TotaisVendas;
}

export function agruparVendas(
  vendas: VendaParaCalculo[],
  config: ConfigRelatorio,
  chaveDe: (venda: VendaParaCalculo) => string
): Map<string, TotaisVendas> {
  const baldes = new Map<string, TotaisVendas>();
  for (const venda of vendas) {
    const chave = chaveDe(venda);
    const totais = baldes.get(chave) ?? totaisVendasVazios();
    acumularVenda(totais, venda, calcularVenda(venda, config));
    baldes.set(chave, totais);
  }
  return baldes;
}
