import { CanalVenda, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { inicioDoMes, fimDoMes, type Competencia } from "../dominio/periodo";
import { listarPedidosCriadosNoPeriodo } from "../canais/mercadoLivre/cliente";
import { mapearPedido } from "../canais/mercadoLivre/mapeador";
import { ingerirPedidoMercadoLivre } from "../ingestao/sincronizador";

function statusCancelado(status: StatusVendaCanal): boolean {
  return (
    status === StatusVendaCanal.CANCELADA ||
    status === StatusVendaCanal.DEVOLVIDA ||
    status === StatusVendaCanal.DEVOLVIDA_PARCIAL
  );
}

export interface DivergenciaConferencia {
  pedidoExternoId: string;
  campo: string;
  valorMl: number | string | null;
  valorApp: number | string | null;
}

export interface TotaisConferencia {
  pedidos: number;
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
}

function totaisVazios(): TotaisConferencia {
  return { pedidos: 0, unidades: 0, faturamento: 0, cancelados: 0, valorCancelado: 0, tarifa: 0 };
}

export async function conferirMes(
  userId: string,
  accountId: string,
  competencia: Competencia
): Promise<ResultadoConferencia> {
  const instanteDoMes = new Date(Date.UTC(competencia.ano, competencia.mes - 1, 15, 12, 0, 0));
  const desde = inicioDoMes(instanteDoMes);
  const ate = fimDoMes(instanteDoMes);

  const pedidosMl = await listarPedidosCriadosNoPeriodo(accountId, desde, ate);

  const totalMl = totaisVazios();
  const totalApp = totaisVazios();
  const faltando: string[] = [];
  const divergentes: DivergenciaConferencia[] = [];

  const idsExternos = pedidosMl.map((p) => String(p.id));
  const vendas =
    idsExternos.length === 0
      ? []
      : await prisma.vendaCanal.findMany({
          where: { userId, canal: CanalVenda.MERCADO_LIVRE, pedidoExternoId: { in: idsExternos } },
          include: { itens: true },
        });
  const vendaPorPedido = new Map(vendas.map((v) => [v.pedidoExternoId, v]));

  for (const pedidoBruto of pedidosMl) {
    const pedidoExternoId = String(pedidoBruto.id);
    const normalizado = mapearPedido(pedidoBruto, null);
    if (!normalizado) continue;

    const faturamentoMl = normalizado.itens.reduce((soma, item) => soma + item.precoUnitario * item.quantidade, 0);
    const tarifaMl = normalizado.itens.reduce((soma, item) => soma + (item.tarifaTotal ?? 0), 0);
    const unidadesMl = normalizado.itens.reduce((soma, item) => soma + item.quantidade, 0);
    const canceladoMl = statusCancelado(normalizado.status);

    totalMl.pedidos++;
    totalMl.unidades += unidadesMl;
    totalMl.tarifa += tarifaMl;
    if (canceladoMl) {
      totalMl.cancelados++;
      totalMl.valorCancelado += faturamentoMl;
    } else {
      totalMl.faturamento += faturamentoMl;
    }

    const venda = vendaPorPedido.get(pedidoExternoId);
    if (!venda) {
      faltando.push(pedidoExternoId);
      continue;
    }

    const unidadesApp = venda.itens.reduce((soma, item) => soma + item.quantidade, 0);
    const canceladoApp = statusCancelado(venda.status);

    totalApp.pedidos++;
    totalApp.unidades += unidadesApp;
    totalApp.tarifa += venda.tarifaVenda;
    if (canceladoApp) {
      totalApp.cancelados++;
      totalApp.valorCancelado += venda.faturamentoBruto;
    } else {
      totalApp.faturamento += venda.faturamentoBruto;
    }

    if (venda.faturamentoBruto !== faturamentoMl) {
      divergentes.push({ pedidoExternoId, campo: "faturamento", valorMl: faturamentoMl, valorApp: venda.faturamentoBruto });
    }
    if (venda.status !== normalizado.status) {
      divergentes.push({ pedidoExternoId, campo: "status", valorMl: normalizado.status, valorApp: venda.status });
    }
    if (unidadesApp !== unidadesMl) {
      divergentes.push({ pedidoExternoId, campo: "unidades", valorMl: unidadesMl, valorApp: unidadesApp });
    }
  }

  const coberturaPercentual =
    totalMl.pedidos === 0
      ? 100
      : Math.round(((totalMl.pedidos - faltando.length) / totalMl.pedidos) * 1000) / 10;

  return { competencia, totalMl, totalApp, coberturaPercentual, faltando, divergentes };
}

export async function importarFaltantes(
  accountId: string,
  pedidosExternoId: string[]
): Promise<{ importados: number; erros: number }> {
  let importados = 0;
  let erros = 0;
  for (const pedidoExternoId of pedidosExternoId) {
    try {
      const resultado = await ingerirPedidoMercadoLivre(accountId, pedidoExternoId);
      if (resultado.ingerido) importados++;
    } catch {
      erros++;
    }
  }
  return { importados, erros };
}

export async function reprocessarDivergentes(
  accountId: string,
  pedidosExternoId: string[]
): Promise<{ reprocessados: number; erros: number }> {
  let reprocessados = 0;
  let erros = 0;
  for (const pedidoExternoId of [...new Set(pedidosExternoId)]) {
    try {
      await ingerirPedidoMercadoLivre(accountId, pedidoExternoId);
      reprocessados++;
    } catch {
      erros++;
    }
  }
  return { reprocessados, erros };
}
