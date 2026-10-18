import { CanalVenda, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { MLOrder } from "@/types/mercadolivre";
import { inicioDoMes, fimDoMes, type Competencia } from "../dominio/periodo";
import { listarPedidosCriadosNoPeriodo } from "../canais/mercadoLivre/cliente";
import { mapearPedido } from "../canais/mercadoLivre/mapeador";
import { ingerirPedidosEmLote, type ResultadoLote } from "../ingestao/lote";
import { obterUserIdDaConta } from "../ingestao/sincronizador";

function statusCancelado(status: StatusVendaCanal): boolean {
  return status === StatusVendaCanal.CANCELADA || status === StatusVendaCanal.DEVOLVIDA;
}

export interface DivergenciaConferencia {
  pedidoExternoId: string;
  campo: "faturamento" | "status" | "unidades" | "tarifa" | "data";
  valorMl: number | string | null;
  valorApp: number | string | null;
}

export interface TotaisConferencia {
  pedidos: number;
  pedidosValidos: number;
  unidades: number;
  faturamento: number;
  cancelados: number;
  valorCancelado: number;
  tarifa: number;
}

export interface ResultadoConferencia {
  competencia: Competencia;
  totalMl: TotaisConferencia;
  totalApp: TotaisConferencia;
  coberturaPercentual: number;
  faltando: string[];
  divergentes: DivergenciaConferencia[];
  sobrando: string[];
  aguardandoDetalhes: number;
  confere: boolean;
}

function totaisVazios(): TotaisConferencia {
  return { pedidos: 0, pedidosValidos: 0, unidades: 0, faturamento: 0, cancelados: 0, valorCancelado: 0, tarifa: 0 };
}

function limitesDoMes(competencia: Competencia) {
  const instante = new Date(Date.UTC(competencia.ano, competencia.mes - 1, 15, 12, 0, 0));
  return { desde: inicioDoMes(instante), ate: fimDoMes(instante) };
}

function somarNoTotal(
  total: TotaisConferencia,
  status: StatusVendaCanal,
  faturamento: number,
  estornado: number,
  unidades: number,
  tarifa: number
) {
  total.pedidos++;
  if (statusCancelado(status)) {
    total.cancelados++;
    total.valorCancelado += faturamento;
    return;
  }
  total.pedidosValidos++;
  total.unidades += unidades;
  total.faturamento += faturamento - estornado;
  total.valorCancelado += estornado;
  total.tarifa += tarifa;
}

/**
 * Compara, pedido a pedido, o que o Mercado Livre tem no mês (data de criação
 * do pedido, fuso de SP — o mesmo critério de todos os relatórios) com o que
 * está gravado. Faturamento = preço × quantidade dos pedidos não cancelados,
 * exatamente como o painel de vendas do ML.
 */
export async function conferirMes(
  userId: string,
  accountId: string,
  competencia: Competencia,
  pedidosJaBuscados?: MLOrder[]
): Promise<ResultadoConferencia> {
  const { desde, ate } = limitesDoMes(competencia);
  const pedidosMl = pedidosJaBuscados ?? (await listarPedidosCriadosNoPeriodo(accountId, desde, ate));

  const totalMl = totaisVazios();
  const totalApp = totaisVazios();
  const faltando: string[] = [];
  const divergentes: DivergenciaConferencia[] = [];

  const vendasDoMes = await prisma.vendaCanal.findMany({
    where: {
      userId,
      canal: CanalVenda.MERCADO_LIVRE,
      contaCanalId: accountId,
      dataVenda: { gte: desde, lte: ate },
    },
    include: { itens: { select: { quantidade: true, tarifaVenda: true } } },
  });
  const idsMl = new Set(pedidosMl.map((p) => String(p.id)));
  const foraDoMes = await prisma.vendaCanal.findMany({
    where: {
      userId,
      canal: CanalVenda.MERCADO_LIVRE,
      pedidoExternoId: { in: [...idsMl].filter((id) => !vendasDoMes.some((v) => v.pedidoExternoId === id)) },
    },
    include: { itens: { select: { quantidade: true, tarifaVenda: true } } },
  });
  const vendaPorPedido = new Map([...vendasDoMes, ...foraDoMes].map((v) => [v.pedidoExternoId, v]));

  for (const pedidoBruto of pedidosMl) {
    const pedidoExternoId = String(pedidoBruto.id);
    const normalizado = mapearPedido(pedidoBruto, null);
    if (!normalizado) continue;

    const faturamentoMl = normalizado.itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0);
    const tarifaMl = normalizado.itens.reduce((soma, item) => soma + (item.tarifaTotal ?? 0), 0);
    const unidadesMl = normalizado.itens.reduce((soma, item) => soma + item.quantidade, 0);
    somarNoTotal(totalMl, normalizado.status, faturamentoMl, normalizado.valorEstornado ?? 0, unidadesMl, tarifaMl);

    const venda = vendaPorPedido.get(pedidoExternoId);
    if (!venda) {
      faltando.push(pedidoExternoId);
      continue;
    }

    const unidadesApp = venda.itens.reduce((soma, item) => soma + item.quantidade, 0);
    somarNoTotal(totalApp, venda.status, venda.faturamentoBruto, venda.valorEstornado, unidadesApp, venda.tarifaVenda);

    if (venda.faturamentoBruto !== faturamentoMl) {
      divergentes.push({ pedidoExternoId, campo: "faturamento", valorMl: faturamentoMl, valorApp: venda.faturamentoBruto });
    }
    if (venda.status !== normalizado.status) {
      divergentes.push({ pedidoExternoId, campo: "status", valorMl: normalizado.status, valorApp: venda.status });
    }
    if (unidadesApp !== unidadesMl) {
      divergentes.push({ pedidoExternoId, campo: "unidades", valorMl: unidadesMl, valorApp: unidadesApp });
    }
    if (venda.dataVenda.getTime() !== normalizado.dataVenda.getTime()) {
      divergentes.push({
        pedidoExternoId,
        campo: "data",
        valorMl: normalizado.dataVenda.toISOString(),
        valorApp: venda.dataVenda.toISOString(),
      });
    }
    if (!statusCancelado(normalizado.status) && Math.abs(venda.tarifaVenda - tarifaMl) > 2) {
      divergentes.push({ pedidoExternoId, campo: "tarifa", valorMl: tarifaMl, valorApp: venda.tarifaVenda });
    }
  }

  const sobrando = vendasDoMes.filter((v) => !idsMl.has(v.pedidoExternoId)).map((v) => v.pedidoExternoId);
  const aguardandoDetalhes = vendasDoMes.filter((v) => v.enriquecidoEm == null).length;

  const coberturaPercentual =
    totalMl.pedidos === 0
      ? 100
      : Math.round(((totalMl.pedidos - faltando.length) / totalMl.pedidos) * 1000) / 10;

  const confere =
    faltando.length === 0 &&
    divergentes.filter((d) => d.campo !== "tarifa").length === 0 &&
    totalMl.faturamento === totalApp.faturamento &&
    totalMl.pedidosValidos === totalApp.pedidosValidos;

  return {
    competencia,
    totalMl,
    totalApp,
    coberturaPercentual,
    faltando,
    divergentes,
    sobrando,
    aguardandoDetalhes,
    confere,
  };
}

export interface ResultadoCorrecaoMes {
  antes: ResultadoConferencia;
  depois: ResultadoConferencia;
  lote: ResultadoLote;
}

/**
 * Corrige o mês de uma vez: busca todos os pedidos do mês no ML (uma única
 * listagem), grava em lote os que faltam ou divergem e devolve a conferência
 * de antes e depois. Os detalhes do pagamento das vendas corrigidas entram na
 * fila de detalhamento.
 */
export async function corrigirMes(accountId: string, competencia: Competencia): Promise<ResultadoCorrecaoMes> {
  const userId = await obterUserIdDaConta(accountId);
  if (!userId) throw new Error("Conta do Mercado Livre não encontrada");

  const { desde, ate } = limitesDoMes(competencia);
  const pedidosMl = await listarPedidosCriadosNoPeriodo(accountId, desde, ate);
  const antes = await conferirMes(userId, accountId, competencia, pedidosMl);

  const precisamCorrecao = new Set([...antes.faltando, ...antes.divergentes.map((d) => d.pedidoExternoId)]);
  const paraGravar = pedidosMl.filter((p) => precisamCorrecao.has(String(p.id)));
  const lote = await ingerirPedidosEmLote({ contaCanalId: accountId, userId }, paraGravar, {
    forcar: true,
    etapa: "CONFERENCIA",
  });

  if (antes.sobrando.length > 0) {
    await prisma.vendaCanal.updateMany({
      where: { userId, contaCanalId: accountId, pedidoExternoId: { in: antes.sobrando } },
      data: { enriquecidoEm: null, enriquecimentoTentativas: 0 },
    });
  }

  const depois = await conferirMes(userId, accountId, competencia, pedidosMl);
  return { antes, depois, lote };
}
