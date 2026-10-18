import { CanalVenda, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calcularVenda, obterConfigRelatorio, SELECT_VENDA_CALCULO } from "./motor";
import { rotuloLogistica } from "./porLogistica";

export interface FiltrosLucroPorVenda {
  desde?: Date;
  ate?: Date;
  canal?: CanalVenda;
  status?: StatusVendaCanal;
  soPrejuizo?: boolean;
  soIncompletas?: boolean;
  produtoId?: string;
  logistica?: string;
  aguardandoDetalhes?: boolean;
  busca?: string;
  pagina?: number;
  porPagina?: number;
}

const POR_PAGINA_PADRAO = 20;
const POR_PAGINA_MAXIMA = 100;

function montarWhere(userId: string, filtros: FiltrosLucroPorVenda) {
  return {
    userId,
    ...(filtros.canal && { canal: filtros.canal }),
    ...(filtros.status && { status: filtros.status }),
    ...(filtros.soPrejuizo && { margemContribuicao: { lt: 0 } }),
    ...(filtros.soIncompletas && { completo: false }),
    ...(filtros.logistica && { logistica: filtros.logistica }),
    ...(filtros.aguardandoDetalhes && { enriquecidoEm: null }),
    ...(filtros.busca && {
      OR: [
        { pedidoExternoId: { contains: filtros.busca.trim() } },
        { itens: { some: { titulo: { contains: filtros.busca.trim(), mode: "insensitive" as const } } } },
        { itens: { some: { sku: { contains: filtros.busca.trim(), mode: "insensitive" as const } } } },
      ],
    }),
    ...((filtros.desde || filtros.ate) && {
      dataVenda: {
        ...(filtros.desde && { gte: filtros.desde }),
        ...(filtros.ate && { lte: filtros.ate }),
      },
    }),
    ...(filtros.produtoId && { itens: { some: { produtoId: filtros.produtoId } } }),
  };
}

export async function listarVendasComLucro(userId: string, filtros: FiltrosLucroPorVenda) {
  const pagina = Math.max(filtros.pagina ?? 1, 1);
  const porPagina = Math.min(filtros.porPagina ?? POR_PAGINA_PADRAO, POR_PAGINA_MAXIMA);
  const where = montarWhere(userId, filtros);

  const [vendas, total, config] = await Promise.all([
    prisma.vendaCanal.findMany({
      where,
      select: {
        ...SELECT_VENDA_CALCULO,
        canal: true,
        pacoteExternoId: true,
        statusLiberacao: true,
        freteConfianca: true,
        freteAjusteManual: true,
        freteAjusteManualMotivo: true,
        enriquecimentoErro: true,
        itens: {
          select: {
            ...SELECT_VENDA_CALCULO.itens.select,
            titulo: true,
            sku: true,
            anuncioExternoId: true,
          },
        },
      },
      orderBy: { dataVenda: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.vendaCanal.count({ where }),
    obterConfigRelatorio(userId),
  ]);

  return {
    vendas: vendas.map((venda) => ({
      ...venda,
      logisticaRotulo: rotuloLogistica(venda.logistica),
      calculo: calcularVenda(venda, config),
    })),
    total,
    pagina,
    porPagina,
    modoFaturamento: config.modoFaturamento,
  };
}

export class VendaNaoEncontradaError extends Error {
  constructor() {
    super("Venda não encontrada");
    this.name = "VendaNaoEncontradaError";
  }
}

export async function obterDetalheVenda(userId: string, vendaId: string) {
  const [venda, config] = await Promise.all([
    prisma.vendaCanal.findFirst({
      where: { id: vendaId, userId },
      include: {
        itens: { include: { produto: { select: { nome: true, sku: true } } } },
        cobrancasPagamento: { orderBy: { valor: "desc" } },
      },
    }),
    obterConfigRelatorio(userId),
  ]);
  if (!venda) throw new VendaNaoEncontradaError();
  return {
    ...venda,
    logisticaRotulo: rotuloLogistica(venda.logistica),
    calculo: calcularVenda(venda, config),
    modoFaturamento: config.modoFaturamento,
  };
}
