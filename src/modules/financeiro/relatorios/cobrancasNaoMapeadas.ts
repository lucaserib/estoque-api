import { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface LinhaCobrancaNaoMapeada {
  tipoExterno: string;
  quantidade: number;
  total: number;
}

export async function listarCobrancasNaoMapeadas(
  userId: string,
  mesReferencia?: string,
  canal: CanalVenda = CanalVenda.MERCADO_LIVRE
): Promise<LinhaCobrancaNaoMapeada[]> {
  const agrupado = await prisma.cobrancaCanal.groupBy({
    by: ["tipoExterno"],
    where: {
      userId,
      canal,
      tipoNormalizado: "NAO_MAPEADO",
      ...(mesReferencia && { mesReferencia }),
    },
    _count: { _all: true },
    _sum: { valor: true },
  });

  return agrupado
    .map((item) => ({
      tipoExterno: item.tipoExterno,
      quantidade: item._count._all,
      total: item._sum.valor ?? 0,
    }))
    .sort((a, b) => b.total - a.total);
}
