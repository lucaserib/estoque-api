import { CanalVenda, Confianca, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku";
import { calcularCustoKit } from "@/lib/custo";
import { obterAdaptador } from "../canais/registro";
import type {
  AdaptadorCanalFinanceiro,
  ContaCanal,
  ItemVendaCanalNormalizado,
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

const PENDENCIA_SEM_VINCULO = "SEM_VINCULO";
const LOTE_MAXIMO_POR_CHAMADA = 10;
const DIAS_PADRAO_REPROCESSAMENTO = 3;
const DIAS_PADRAO_BACKFILL = 90;
const DIAS_MAXIMO_BACKFILL = 365;

function statusZeraQuantidade(status: StatusVendaCanal): boolean {
  return status === StatusVendaCanal.CANCELADA || status === StatusVendaCanal.DEVOLVIDA;
}

async function vincularProduto(
  userId: string,
  accountId: string,
  item: Pick<ItemVendaCanalNormalizado, "anuncioExternoId" | "sku">
): Promise<string | null> {
  const vinculo = await prisma.produtoMercadoLivre.findUnique({
    where: {
      mlItemId_mercadoLivreAccountId: {
        mlItemId: item.anuncioExternoId,
        mercadoLivreAccountId: accountId,
      },
    },
    select: { produtoId: true },
  });
  if (vinculo?.produtoId) return vinculo.produtoId;

  if (!item.sku) return null;

  const skuNormalizado = normalizeSku(item.sku);
  const produto = await prisma.produto.findUnique({
    where: { sku_userId: { sku: skuNormalizado, userId } },
    select: { id: true },
  });
  return produto?.id ?? null;
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
}

async function obterConfigIngestao(userId: string): Promise<ConfigIngestao> {
  const config = await prisma.configuracaoGeral.findUnique({
    where: { userId },
    select: { aliquotaImposto: true, custoEnvioFlex: true },
  });
  return {
    aliquotaImposto: config?.aliquotaImposto ?? 0,
    custoEnvioFlex: config?.custoEnvioFlex ?? null,
  };
}

/**
 * Full: custo vem da cobrança mensal (Fase 4), não do pedido. Flex: custo
 * configurado em ConfiguracaoGeral.custoEnvioFlex (null = ainda não
 * configurado, vira pendência SEM_FRETE em vez de 0 inventado). Sem envio
 * (retirada): zero de verdade. Os demais: custo real via obterCustoEnvio.
 */
async function resolverFreteTotalDoPedidoAtual(
  contaCanal: ContaCanal,
  adaptador: AdaptadorCanalFinanceiro,
  normalizado: VendaCanalNormalizada,
  custoEnvioFlex: number | null
): Promise<number | null> {
  if (!normalizado.envioExternoId) return 0;
  if (normalizado.logistica === "fulfillment") return 0;
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
    await reaplicarFreteEmVendaExistente(irmaos[i].id, partes[i]);
  }

  return partes[partes.length - 1];
}

async function reaplicarFreteEmVendaExistente(
  vendaId: string,
  novoFreteTotal: number
): Promise<void> {
  const venda = await prisma.vendaCanal.findUniqueOrThrow({
    where: { id: vendaId },
    include: { itens: true },
  });
  if (venda.freteVendedor === novoFreteTotal) return;

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
    { freteTotal: novoFreteTotal, adsAtribuido: venda.adsAtribuido },
    itensEntrada,
    { aliquotaImposto: config.aliquotaImposto }
  );
  const semVinculo = venda.itens.some((item) => item.produtoId === null);

  await prisma.$transaction(async (tx) => {
    await tx.vendaCanal.update({
      where: { id: vendaId },
      data: {
        freteVendedor: resultado.freteVendedor,
        margemContribuicao: resultado.margemContribuicao,
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

  return { itensEntrada, vinculos };
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
  const freteTotalPedido = await resolverFreteTotalDoPedidoAtual(
    contaCanal,
    adaptador,
    normalizadoOriginal,
    config.custoEnvioFlex
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

  const { itensEntrada, vinculos } = await prepararItens(
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
  const faltando = semVinculo
    ? [...new Set([...resultado.faltando, PENDENCIA_SEM_VINCULO])]
    : resultado.faltando;

  const faturamentoBrutoOriginal = normalizadoOriginal.itens.reduce(
    (soma, item) => soma + item.precoUnitario * item.quantidade,
    0
  );

  const dadosComuns = {
    pacoteExternoId: normalizadoOriginal.pacoteExternoId,
    dataVenda: normalizadoOriginal.dataVenda,
    dataCancelamento: normalizadoOriginal.dataCancelamento,
    dataLiberacao: normalizadoOriginal.dataLiberacao,
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
    valorLiquidoReceber: null,
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

  for (const venda of vendas) {
    resumo.pedidos += 1;
    if (!venda.completo) resumo.vendasIncompletas += 1;

    if (statusZeraQuantidade(venda.status)) {
      resumo.cancelamentos += venda.faturamentoBruto;
      continue;
    }

    resumo.unidades += venda.itens.reduce((soma, item) => soma + item.quantidade, 0);
    resumo.faturamentoBruto += venda.faturamentoBruto;
    resumo.descontos += venda.descontoVendedor;
    resumo.impostos += venda.impostoEstimado;
    resumo.tarifas += venda.tarifaVenda;
    resumo.frete += venda.freteVendedor ?? 0;
    resumo.ads += venda.adsAtribuido;
    resumo.cmv += venda.cmv ?? 0;
    if (venda.margemContribuicao != null) {
      resumo.margemContribuicao += venda.margemContribuicao;
    }
  }

  await prisma.resumoFinanceiroDiario.upsert({
    where: { userId_dia_canal: { userId, dia, canal } },
    create: { userId, dia, canal, ...resumo },
    update: { ...resumo, atualizadoEm: new Date() },
  });
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

export async function reprocessarUltimosDias(
  accountId: string,
  dias: number = DIAS_PADRAO_REPROCESSAMENTO
): Promise<{ processados: number }> {
  const conta = await prisma.mercadoLivreAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { userId: true },
  });
  const contaCanal: ContaCanal = { contaCanalId: accountId, userId: conta.userId };
  const adaptador = obterAdaptador(CanalVenda.MERCADO_LIVRE);

  const ate = new Date();
  const desde = new Date(ate.getTime() - dias * 24 * 60 * 60 * 1000);

  let processados = 0;
  let cursor: string | null = null;
  do {
    const pagina = await adaptador.listarPedidosAlterados(contaCanal, desde, ate, cursor);
    for (const pedido of pagina.pedidos) {
      await ingerirPedidoMercadoLivre(accountId, pedido.pedidoExternoId);
      processados++;
    }
    cursor = pagina.cursor;
  } while (cursor);

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

  const cursorSalvo = sincronizacao.cursor as unknown as CursorBackfill;
  const contaCanal: ContaCanal = { contaCanalId: accountId, userId };
  const adaptador = obterAdaptador(canal);

  try {
    let processadosNesteLote = 0;
    let offsetAtual: string | null = String(cursorSalvo.offset);

    while (processadosNesteLote < LOTE_MAXIMO_POR_CHAMADA) {
      const pagina = await adaptador.listarPedidosAlterados(
        contaCanal,
        new Date(cursorSalvo.desde),
        new Date(cursorSalvo.ate),
        offsetAtual
      );

      for (const pedido of pagina.pedidos) {
        await ingerirPedidoMercadoLivre(accountId, pedido.pedidoExternoId);
        processadosNesteLote++;
      }

      offsetAtual = pagina.cursor;

      if (!pagina.temMais) {
        await prisma.sincronizacaoFinanceira.update({
          where: { id: sincronizacao.id },
          data: {
            status: "CONCLUIDO",
            concluidoEm: new Date(),
            processados: { increment: processadosNesteLote },
          },
        });
        return { status: "CONCLUIDO", processados: processadosNesteLote };
      }
    }

    const novoCursor: CursorBackfill = { ...cursorSalvo, offset: Number(offsetAtual ?? 0) };
    await prisma.sincronizacaoFinanceira.update({
      where: { id: sincronizacao.id },
      data: { cursor: novoCursor, processados: { increment: processadosNesteLote } },
    });
    return { status: "EM_ANDAMENTO", processados: processadosNesteLote };
  } catch (erro) {
    await prisma.sincronizacaoFinanceira.update({
      where: { id: sincronizacao.id },
      data: {
        status: "ERRO",
        erro: erro instanceof Error ? erro.message : "Erro desconhecido",
      },
    });
    throw erro;
  }
}
