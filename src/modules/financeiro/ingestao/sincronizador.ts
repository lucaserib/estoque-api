import { CanalVenda, Confianca, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularCustoKit } from "@/lib/custo";
import { obterAdaptador } from "../canais/registro";
import type {
  AdaptadorCanalFinanceiro,
  ContaCanal,
  VendaCanalNormalizada,
} from "../canais/tipos";
import {
  calcularResultadoVenda,
  ratearCustoVendaPorItem,
  type ItemVendaEntrada,
  type ResultadoVenda,
} from "../dominio/formulas";
import { inicioDoDia, fimDoDia } from "../dominio/periodo";
import { ratear } from "../dominio/dinheiro";
import { resolverOrigemCanonica } from "./deduplicacao";
import { vincularProduto } from "./vinculo";
import { invalidarCacheFinanceiro } from "../relatorios/cache";

const PENDENCIA_SEM_VINCULO = "SEM_VINCULO";
const PENDENCIA_LIBERACAO_ESTIMADA = "LIBERACAO_ESTIMADA";
const DIAS_PADRAO_REPROCESSAMENTO = 3;
const DIAS_PADRAO_BACKFILL = 90;
const DIAS_MAXIMO_BACKFILL = 365;
const TENTATIVAS_MAXIMAS_ERRO = 5;

function tempoMaximoLoteMs(): number {
  return Number(process.env.FINANCEIRO_TEMPO_MAXIMO_LOTE_MS ?? 40000);
}

function mensagemDeErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Erro desconhecido";
}

async function registrarErroPedido(
  userId: string,
  canal: CanalVenda,
  pedidoExternoId: string,
  etapa: string,
  mensagem: string
): Promise<void> {
  await prisma.sincronizacaoFinanceiraErro.upsert({
    where: { userId_canal_pedidoExternoId_etapa: { userId, canal, pedidoExternoId, etapa } },
    create: { userId, canal, pedidoExternoId, etapa, mensagem },
    update: { mensagem, tentativas: { increment: 1 }, ultimoErroEm: new Date(), resolvidoEm: null },
  });
}

async function resolverErroPedido(
  userId: string,
  canal: CanalVenda,
  pedidoExternoId: string
): Promise<void> {
  await prisma.sincronizacaoFinanceiraErro.updateMany({
    where: { userId, canal, pedidoExternoId, resolvidoEm: null },
    data: { resolvidoEm: new Date() },
  });
}

async function ingerirPedidoComRegistroDeErro(
  accountId: string,
  userId: string,
  canal: CanalVenda,
  pedidoExternoId: string,
  etapa: string
): Promise<void> {
  const erroAnterior = await prisma.sincronizacaoFinanceiraErro.findUnique({
    where: { userId_canal_pedidoExternoId_etapa: { userId, canal, pedidoExternoId, etapa } },
  });
  if (erroAnterior && erroAnterior.resolvidoEm == null && erroAnterior.tentativas >= TENTATIVAS_MAXIMAS_ERRO) {
    return;
  }

  try {
    await ingerirPedidoMercadoLivre(accountId, pedidoExternoId);
    await resolverErroPedido(userId, canal, pedidoExternoId);
  } catch (erro) {
    await registrarErroPedido(userId, canal, pedidoExternoId, etapa, mensagemDeErro(erro));
  }
}

function statusZeraQuantidade(status: StatusVendaCanal): boolean {
  return status === StatusVendaCanal.CANCELADA || status === StatusVendaCanal.DEVOLVIDA;
}

function calcularValorLiquidoReceber(resultado: ResultadoVenda): number | null {
  if (resultado.tarifa == null || resultado.freteVendedor == null) return null;
  return resultado.faturamentoBruto - resultado.tarifa - resultado.freteVendedor;
}

async function resolverCustoAtualDoProduto(produtoId: string): Promise<number | null> {
  const produto = await prisma.produto.findUnique({
    where: { id: produtoId },
    select: { isKit: true, custoMedio: true },
  });
  if (!produto) return null;
  if (!produto.isKit) return produto.custoMedio;

  const kit = await calcularCustoKit(produtoId);
  return kit.completo ? kit.custoMedio : null;
}

interface ConfigIngestao {
  aliquotaImposto: number;
  custoEnvioFlex: number | null;
  diasLiberacaoPadrao: number;
}

async function obterConfigIngestao(userId: string): Promise<ConfigIngestao> {
  const config = await prisma.configuracaoGeral.findUnique({
    where: { userId },
    select: { aliquotaImposto: true, custoEnvioFlex: true, diasLiberacaoPadrao: true },
  });
  return {
    aliquotaImposto: config?.aliquotaImposto ?? 0,
    custoEnvioFlex: config?.custoEnvioFlex ?? null,
    diasLiberacaoPadrao: config?.diasLiberacaoPadrao ?? 14,
  };
}

async function resolverLogisticaReal(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada
): Promise<string | null> {
  if (normalizado.logistica) return normalizado.logistica;
  if (!normalizado.envioExternoId || !adaptador.obterEnvio) return null;

  const envio = await adaptador.obterEnvio(contaCanal, normalizado.envioExternoId);
  return envio.logistica;
}

interface LiberacaoResolvida {
  dataLiberacao: Date | null;
  valorLiquidoOverride: number | null;
  estimado: boolean;
}

async function resolverLiberacao(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada,
  diasLiberacaoPadrao: number
): Promise<LiberacaoResolvida> {
  if (normalizado.dataLiberacao) {
    return { dataLiberacao: normalizado.dataLiberacao, valorLiquidoOverride: null, estimado: false };
  }

  if (adaptador.obterLiberacaoPagamento) {
    const liberacao = await adaptador.obterLiberacaoPagamento(contaCanal, normalizado.pedidoExternoId);
    if (liberacao.dataLiberacao) {
      return {
        dataLiberacao: liberacao.dataLiberacao,
        valorLiquidoOverride: liberacao.valorLiquido,
        estimado: liberacao.confianca === Confianca.ESTIMADO,
      };
    }
  }

  if (normalizado.status !== StatusVendaCanal.PAGA) {
    return { dataLiberacao: null, valorLiquidoOverride: null, estimado: false };
  }

  const estimativa = new Date(
    normalizado.dataVenda.getTime() + diasLiberacaoPadrao * 24 * 60 * 60 * 1000
  );
  return { dataLiberacao: estimativa, valorLiquidoOverride: null, estimado: true };
}

async function resolverFreteTotalDoPedidoAtual(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada,
  custoEnvioFlex: number | null
): Promise<number | null> {
  if (!normalizado.envioExternoId) return 0;
  if (normalizado.logistica === "self_service") return custoEnvioFlex;
  if (!adaptador.obterCustoEnvio) return null;

  const custo = await adaptador.obterCustoEnvio(contaCanal, normalizado.envioExternoId);
  if (custo.valor == null) return null;
  if (!normalizado.pacoteExternoId) return custo.valor;

  return ratearFreteDoPacoteEAtualizarIrmaos(
    contaCanal.userId,
    adaptador.canal,
    normalizado,
    custo.valor
  );
}

async function ratearFreteDoPacoteEAtualizarIrmaos(
  userId: string,
  canal: CanalVenda,
  normalizado: VendaCanalNormalizada,
  custoTotalEnvio: number
): Promise<number> {
  const irmaos = await prisma.vendaCanal.findMany({
    where: {
      userId,
      canal,
      pacoteExternoId: normalizado.pacoteExternoId,
      pedidoExternoId: { not: normalizado.pedidoExternoId },
    },
    select: { id: true, faturamentoBruto: true },
  });

  const faturamentoAtual = normalizado.itens.reduce(
    (soma, item) => soma + item.precoUnitario * item.quantidade,
    0
  );
  const pesos = [...irmaos.map((i) => i.faturamentoBruto), faturamentoAtual];
  const partes = ratear(custoTotalEnvio, pesos);

  for (let i = 0; i < irmaos.length; i++) {
    await recalcularEPersistirMargem(irmaos[i].id, { freteTotal: partes[i] });
  }

  return partes[partes.length - 1];
}

interface SobrescritasRecalculo {
  freteTotal?: number;
  adsAtribuido?: number;
}

/**
 * Recarrega uma VendaCanal já persistida, aplica a mesma regra de "zerar
 * quantidade se cancelada/devolvida" e recalcula a margem com frete e/ou ads
 * atualizados — usado quando um dado que chega depois (frete de um pacote
 * cujo irmão só agora apareceu, ads do dia) muda um número que já tinha sido
 * gravado. Idempotente: não re-escreve nada se o valor não mudou.
 */
export async function recalcularEPersistirMargem(
  vendaId: string,
  sobrescritas: SobrescritasRecalculo
): Promise<void> {
  const venda = await prisma.vendaCanal.findUniqueOrThrow({
    where: { id: vendaId },
    include: { itens: true },
  });

  const freteTotal = sobrescritas.freteTotal ?? venda.freteVendedor;
  const adsAtribuido = sobrescritas.adsAtribuido ?? venda.adsAtribuido;
  if (freteTotal === venda.freteVendedor && adsAtribuido === venda.adsAtribuido) return;

  const config = await obterConfigIngestao(venda.userId);
  const zerar = statusZeraQuantidade(venda.status);

  const itensEntrada: ItemVendaEntrada[] = venda.itens.map((item) => ({
    produtoId: item.produtoId,
    quantidade: zerar ? 0 : item.quantidade,
    precoUnitario: item.precoUnitario,
    tarifaTotal: item.tarifaVenda,
    descontoVendedorTotal: item.descontoRateado,
    custoUnitario: item.custoUnitario,
  }));

  const resultado = calcularResultadoVenda(
    { freteTotal, adsAtribuido },
    itensEntrada,
    { aliquotaImposto: config.aliquotaImposto }
  );
  const semVinculo = venda.itens.some((item) => item.produtoId === null);

  await prisma.$transaction(async (tx) => {
    await tx.vendaCanal.update({
      where: { id: vendaId },
      data: {
        freteVendedor: resultado.freteVendedor,
        adsAtribuido: resultado.adsAtribuido,
        margemContribuicao: resultado.margemContribuicao,
        valorLiquidoReceber: calcularValorLiquidoReceber(resultado),
        completo: resultado.completo && !semVinculo,
        faltando: semVinculo
          ? [...new Set([...resultado.faltando, PENDENCIA_SEM_VINCULO])]
          : resultado.faltando,
      },
    });
    for (let i = 0; i < venda.itens.length; i++) {
      await tx.vendaCanalItem.update({
        where: { id: venda.itens[i].id },
        data: {
          freteRateado: resultado.itens[i].freteRateado,
          adsRateado: resultado.itens[i].adsRateado,
          margemContribuicao: resultado.itens[i].margemContribuicao,
        },
      });
    }
  });

  await atualizarResumoDoDia(venda.userId, venda.canal, venda.dataVenda);
}

interface ItensPreparados {
  itensEntrada: ItemVendaEntrada[];
  vinculos: Array<string | null>;
  descontosCusteadosMlRateados: number[];
}

async function prepararItens(
  userId: string,
  accountId: string,
  normalizado: VendaCanalNormalizada,
  vendaExistente: { itens: Array<{ anuncioExternoId: string; variacaoExternaId: string | null; custoUnitario: number | null }> } | null
): Promise<ItensPreparados> {
  const vinculos: Array<string | null> = [];
  const zerar = statusZeraQuantidade(normalizado.status);
  const itensEntrada: ItemVendaEntrada[] = [];

  for (const item of normalizado.itens) {
    const produtoId = await vincularProduto(userId, accountId, item);
    vinculos.push(produtoId);

    const itemExistente = vendaExistente?.itens.find(
      (i) =>
        i.anuncioExternoId === item.anuncioExternoId &&
        i.variacaoExternaId === item.variacaoExternaId
    );
    const custoCongelado = itemExistente?.custoUnitario ?? null;
    const custoUnitario =
      custoCongelado ?? (produtoId ? await resolverCustoAtualDoProduto(produtoId) : null);

    itensEntrada.push({
      produtoId,
      quantidade: zerar ? 0 : item.quantidade,
      precoUnitario: item.precoUnitario,
      tarifaTotal: item.tarifaTotal,
      descontoVendedorTotal: 0,
      custoUnitario,
    });
  }

  const descontosRateados = ratearCustoVendaPorItem(
    normalizado.descontoVendedorTotal,
    itensEntrada
  );
  itensEntrada.forEach((item, i) => {
    item.descontoVendedorTotal = descontosRateados[i];
  });

  const descontosCusteadosMlRateados = ratearCustoVendaPorItem(
    normalizado.descontoCusteadoPeloMlTotal,
    itensEntrada
  );

  return { itensEntrada, vinculos, descontosCusteadosMlRateados };
}

async function persistirVendaNormalizada(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizadoOriginal: VendaCanalNormalizada
): Promise<void> {
  const origem = resolverOrigemCanonica(
    { canal: adaptador.canal, pedidoExternoId: normalizadoOriginal.pedidoExternoId },
    normalizadoOriginal.origemReal
  );
  const { userId } = contaCanal;

  const config = await obterConfigIngestao(userId);
  normalizadoOriginal.logistica = await resolverLogisticaReal(
    contaCanal,
    adaptador,
    normalizadoOriginal
  );
  const freteTotalPedido = await resolverFreteTotalDoPedidoAtual(
    contaCanal,
    adaptador,
    normalizadoOriginal,
    config.custoEnvioFlex
  );
  const liberacao = await resolverLiberacao(
    contaCanal,
    adaptador,
    normalizadoOriginal,
    config.diasLiberacaoPadrao
  );

  const vendaExistente = await prisma.vendaCanal.findUnique({
    where: {
      userId_canal_pedidoExternoId: {
        userId,
        canal: origem.canal,
        pedidoExternoId: origem.pedidoExternoId,
      },
    },
    include: { itens: true },
  });

  const { itensEntrada, vinculos, descontosCusteadosMlRateados } = await prepararItens(
    userId,
    contaCanal.contaCanalId,
    normalizadoOriginal,
    vendaExistente
  );

  const resultado: ResultadoVenda = calcularResultadoVenda(
    { freteTotal: freteTotalPedido, adsAtribuido: vendaExistente?.adsAtribuido ?? 0 },
    itensEntrada,
    { aliquotaImposto: config.aliquotaImposto }
  );

  const semVinculo = vinculos.some((v) => v === null);
  const completo = resultado.completo && !semVinculo;
  const faltando = [
    ...new Set([
      ...resultado.faltando,
      ...(semVinculo ? [PENDENCIA_SEM_VINCULO] : []),
      ...(liberacao.estimado ? [PENDENCIA_LIBERACAO_ESTIMADA] : []),
    ]),
  ];

  const faturamentoBrutoOriginal = normalizadoOriginal.itens.reduce(
    (soma, item) => soma + item.precoUnitario * item.quantidade,
    0
  );

  const dadosComuns = {
    pacoteExternoId: normalizadoOriginal.pacoteExternoId,
    dataVenda: normalizadoOriginal.dataVenda,
    dataCancelamento: normalizadoOriginal.dataCancelamento,
    dataLiberacao: liberacao.dataLiberacao,
    status: normalizadoOriginal.status,
    logistica: normalizadoOriginal.logistica,
    envioExternoId: normalizadoOriginal.envioExternoId,
    faturamentoBruto: faturamentoBrutoOriginal,
    descontoVendedor: resultado.descontoVendedor,
    tarifaVenda: resultado.tarifa ?? 0,
    freteVendedor: resultado.freteVendedor,
    freteComprador: normalizadoOriginal.freteComprador,
    impostoEstimado: resultado.imposto,
    adsAtribuido: resultado.adsAtribuido,
    cmv: resultado.cmv,
    outrosCustos: 0,
    margemContribuicao: resultado.margemContribuicao,
    valorLiquidoReceber: liberacao.valorLiquidoOverride ?? calcularValorLiquidoReceber(resultado),
    completo,
    faltando,
    freteConfianca: freteTotalPedido == null ? Confianca.ESTIMADO : Confianca.CONFIRMADO,
    atualizadoNoCanalEm: normalizadoOriginal.atualizadoNoCanalEm,
  };

  const venda = await prisma.vendaCanal.upsert({
    where: {
      userId_canal_pedidoExternoId: {
        userId,
        canal: origem.canal,
        pedidoExternoId: origem.pedidoExternoId,
      },
    },
    create: {
      userId,
      canal: origem.canal,
      contaCanalId: contaCanal.contaCanalId,
      pedidoExternoId: origem.pedidoExternoId,
      ...dadosComuns,
    },
    update: dadosComuns,
  });

  await prisma.$transaction([
    prisma.vendaCanalItem.deleteMany({ where: { vendaId: venda.id } }),
    prisma.vendaCanalItem.createMany({
      data: normalizadoOriginal.itens.map((item, i) => ({
        vendaId: venda.id,
        produtoId: vinculos[i],
        sku: item.sku,
        anuncioExternoId: item.anuncioExternoId,
        variacaoExternaId: item.variacaoExternaId,
        titulo: item.titulo,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        precoCheio: item.precoCheio,
        tarifaVenda: resultado.itens[i].tarifa ?? 0,
        freteRateado: resultado.itens[i].freteRateado,
        descontoRateado: resultado.itens[i].descontoVendedor,
        impostoRateado: resultado.itens[i].imposto,
        adsRateado: resultado.itens[i].adsRateado,
        custoUnitario: itensEntrada[i].custoUnitario,
        margemContribuicao: resultado.itens[i].margemContribuicao,
        descontoCusteadoMl: descontosCusteadosMlRateados[i],
      })),
    }),
  ]);

  await atualizarResumoDoDia(userId, origem.canal, normalizadoOriginal.dataVenda);
}

export async function atualizarResumoDoDia(
  userId: string,
  canal: CanalVenda,
  algumInstanteDoDia: Date
): Promise<void> {
  const dia = inicioDoDia(algumInstanteDoDia);
  const fimDia = fimDoDia(algumInstanteDoDia);

  const vendas = await prisma.vendaCanal.findMany({
    where: { userId, canal, dataVenda: { gte: dia, lte: fimDia } },
    select: {
      status: true,
      faturamentoBruto: true,
      descontoVendedor: true,
      tarifaVenda: true,
      freteVendedor: true,
      impostoEstimado: true,
      adsAtribuido: true,
      cmv: true,
      margemContribuicao: true,
      completo: true,
      itens: { select: { quantidade: true } },
    },
  });

  const resumo = {
    pedidos: 0,
    unidades: 0,
    faturamentoBruto: 0,
    cancelamentos: 0,
    descontos: 0,
    impostos: 0,
    tarifas: 0,
    frete: 0,
    ads: 0,
    cmv: 0,
    margemContribuicao: 0,
    vendasIncompletas: 0,
  };

  let adsAlocadoEmVendas = 0;

  for (const venda of vendas) {
    resumo.pedidos += 1;
    if (!venda.completo) resumo.vendasIncompletas += 1;
    adsAlocadoEmVendas += venda.adsAtribuido; // conta mesmo cancelada: ads não é reembolsado
    resumo.faturamentoBruto += venda.faturamentoBruto;

    if (statusZeraQuantidade(venda.status)) {
      resumo.cancelamentos += venda.faturamentoBruto;
      continue;
    }

    resumo.unidades += venda.itens.reduce((soma, item) => soma + item.quantidade, 0);
    resumo.descontos += venda.descontoVendedor;
    resumo.impostos += venda.impostoEstimado;
    resumo.tarifas += venda.tarifaVenda;
    resumo.frete += venda.freteVendedor ?? 0;
    resumo.cmv += venda.cmv ?? 0;
    if (venda.margemContribuicao != null) {
      resumo.margemContribuicao += venda.margemContribuicao;
    }
  }

  // Ads sem venda no dia não pode somar — o custo de GastoAdsCanal é a fonte
  // de verdade do total; a parte não alocada a nenhuma venda ainda reduz a
  // margem do dia (foi um gasto real), mesmo sem uma venda específica pra descontar.
  const totalAdsDoDia = await prisma.gastoAdsCanal.aggregate({
    where: { userId, canal, dia: { gte: dia, lte: fimDia } },
    _sum: { custo: true },
  });
  resumo.ads = totalAdsDoDia._sum.custo ?? 0;
  const adsNaoAlocado = Math.max(0, resumo.ads - adsAlocadoEmVendas);
  resumo.margemContribuicao -= adsNaoAlocado;

  await prisma.resumoFinanceiroDiario.upsert({
    where: { userId_dia_canal: { userId, dia, canal } },
    create: { userId, dia, canal, ...resumo },
    update: { ...resumo, atualizadoEm: new Date() },
  });

  await invalidarCacheFinanceiro(userId);
}

export async function ingerirPedidoMercadoLivre(
  accountId: string,
  pedidoExternoId: string
): Promise<{ ingerido: boolean; motivo?: string }> {
  const conta = await prisma.mercadoLivreAccount.findUnique({
    where: { id: accountId },
    select: { userId: true },
  });
  if (!conta) return { ingerido: false, motivo: "CONTA_NAO_ENCONTRADA" };

  const contaCanal: ContaCanal = { contaCanalId: accountId, userId: conta.userId };
  const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);

  const normalizado = await adaptador.obterPedido(contaCanal, pedidoExternoId);
  if (!normalizado) return { ingerido: false, motivo: "NAO_RELEVANTE_AINDA" };

  await persistirVendaNormalizada(contaCanal, adaptador, normalizado);
  return { ingerido: true };
}

const HORAS_SOBREPOSICAO_INCREMENTAL = 2;

export async function reprocessarUltimosDias(
  accountId: string,
  dias: number = DIAS_PADRAO_REPROCESSAMENTO
): Promise<{ processados: number }> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true, ultimaSincronizacaoFinanceiraEm: true },
  });
  const contaCanal: ContaCanal = { contaCanalId: accountId, userId: conta.userId };
  const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);

  const ate = new Date();
  const desde = conta.ultimaSincronizacaoFinanceiraEm
    ? new Date(conta.ultimaSincronizacaoFinanceiraEm.getTime() - HORAS_SOBREPOSICAO_INCREMENTAL * 60 * 60 * 1000)
    : new Date(ate.getTime() - dias * 24 * 60 * 60 * 1000);

  let processados = 0;
  let cursor: string | null = null;
  do {
    const pagina = await adaptador.listarPedidosAlterados(contaCanal, desde, ate, cursor);
    for (const pedido of pagina.pedidos) {
      await ingerirPedidoComRegistroDeErro(
        accountId,
        contaCanal.userId,
        adaptador.canal,
        pedido.pedidoExternoId,
        "INCREMENTAL"
      );
      processados++;
    }
    cursor = pagina.cursor;
  } while (cursor);

  await prisma.mercadoLivreAccount.update({
    where: { id: accountId },
    data: { ultimaSincronizacaoFinanceiraEm: new Date() },
  });

  return { processados };
}

export async function reprocessarErrosPendentes(accountId: string): Promise<{ processados: number }> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });
  const canal = CanalVenda.MERCADO_LIVRE;

  const erros = await prisma.sincronizacaoFinanceiraErro.findMany({
    where: { userId: conta.userId, canal, resolvidoEm: null, tentativas: { lt: TENTATIVAS_MAXIMAS_ERRO } },
  });

  let processados = 0;
  for (const erro of erros) {
    await ingerirPedidoComRegistroDeErro(accountId, conta.userId, canal, erro.pedidoExternoId, erro.etapa);
    processados++;
  }

  return { processados };
}

interface CursorBackfill {
  desde: string;
  ate: string;
  offset: number;
}

export async function continuarBackfill(
  accountId: string,
  diasHistorico: number = DIAS_PADRAO_BACKFILL
): Promise<{ status: "CONCLUIDO" | "EM_ANDAMENTO"; processados: number }> {
  const diasEfetivos = Math.min(diasHistorico, DIAS_MAXIMO_BACKFILL);
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });
  const userId = conta.userId;
  const canal = CanalVenda.MERCADO_LIVRE;

  let sincronizacao = await prisma.sincronizacaoFinanceira.findFirst({
    where: { userId, canal, tipo: "BACKFILL", status: "EM_ANDAMENTO" },
    orderBy: { iniciadoEm: "desc" },
  });

  if (!sincronizacao) {
    const agora = new Date();
    const desde = new Date(agora.getTime() - diasEfetivos * 24 * 60 * 60 * 1000);
    const cursorInicial: CursorBackfill = { desde: desde.toISOString(), ate: agora.toISOString(), offset: 0 };
    sincronizacao = await prisma.sincronizacaoFinanceira.create({
      data: { userId, canal, tipo: "BACKFILL", status: "EM_ANDAMENTO", cursor: cursorInicial },
    });
  }

  let cursorAtual = sincronizacao.cursor as unknown as CursorBackfill;
  const contaCanal: ContaCanal = { contaCanalId: accountId, userId };
  const adaptador = obterAdaptador(canal);

  try {
    let processadosNoLote = 0;
    const inicioLote = Date.now();
    let offsetAtual: string | null = String(cursorAtual.offset);

    while (Date.now() - inicioLote < tempoMaximoLoteMs()) {
      const pagina = await adaptador.listarPedidosAlterados(
        contaCanal,
        new Date(cursorAtual.desde),
        new Date(cursorAtual.ate),
        offsetAtual
      );

      for (const pedido of pagina.pedidos) {
        await ingerirPedidoComRegistroDeErro(
          accountId,
          userId,
          canal,
          pedido.pedidoExternoId,
          "BACKFILL"
        );
        processadosNoLote++;
      }

      offsetAtual = pagina.cursor;
      cursorAtual = { ...cursorAtual, offset: Number(offsetAtual ?? 0) };

      if (!pagina.temMais) {
        await prisma.sincronizacaoFinanceira.update({
          where: { id: sincronizacao.id },
          data: {
            status: "CONCLUIDO",
            concluidoEm: new Date(),
            cursor: cursorAtual,
            processados: { increment: pagina.pedidos.length },
          },
        });
        await prisma.mercadoLivreAccount.update({
          where: { id: accountId },
          data: { ultimaSincronizacaoFinanceiraEm: new Date() },
        });
        return { status: "CONCLUIDO", processados: processadosNoLote };
      }

      await prisma.sincronizacaoFinanceira.update({
        where: { id: sincronizacao.id },
        data: { cursor: cursorAtual, processados: { increment: pagina.pedidos.length } },
      });
    }

    return { status: "EM_ANDAMENTO", processados: processadosNoLote };
  } catch (erro) {
    await prisma.sincronizacaoFinanceira.update({
      where: { id: sincronizacao.id },
      data: {
        status: "ERRO",
        erro: mensagemDeErro(erro),
      },
    });
    throw erro;
  }
}
