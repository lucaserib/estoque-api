import { CanalVenda, StatusVendaCanal } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface FiltrosLucroPorVenda {
  desde?: Date;
  ate?: Date;
  canal?: CanalVenda;
  status?: StatusVendaCanal;
  soPrejuizo?: boolean;
  soIncompletas?: boolean;
  produtoId?: string;
  logistica?: string;
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

  const [vendas, total] = await Promise.all([
    prisma.vendaCanal.findMany({
      where,
      include: { itens: { select: { titulo: true, quantidade: true, sku: true, produtoId: true } } },
      orderBy: { dataVenda: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
    }),
    prisma.vendaCanal.count({ where }),
  ]);

  return { vendas, total, pagina, porPagina };
}

export class VendaNaoEncontradaError extends Error {
  constructor() {
    super("Venda não encontrada");
    this.name = "VendaNaoEncontradaError";
  }
}

export async function obterDetalheVenda(userId: string, vendaId: string) {
  const venda = await prisma.vendaCanal.findFirst({
    where: { id: vendaId, userId },
    include: { itens: { include: { produto: { select: { nome: true, sku: true } } } } },
  });
  if (!venda) throw new VendaNaoEncontradaError();
  return venda;
}
