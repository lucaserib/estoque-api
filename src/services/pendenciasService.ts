import { prisma } from "@/lib/prisma";
import { calcularPendencias, Pendencia } from "@/lib/pendencias";

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

export interface ItemPendencia {
  produtoId: string;
  nome: string;
  sku: string;
  estoqueTotal: number;
  custoMedio: number | null;
  pendencias: Pendencia[];
}

export async function calcularTodasPendencias(
  userId: string
): Promise<ItemPendencia[]> {
  const [produtos, armazensBling] = await Promise.all([
    prisma.produto.findMany({
      where: { userId, ativo: true },
      select: {
        id: true,
        nome: true,
        sku: true,
        isKit: true,
        custoMedio: true,
        precoVenda: true,
        ean: true,
        estoques: { select: { armazemId: true, quantidade: true } },
        componentes: {
          select: { produto: { select: { custoMedio: true } } },
        },
        fornecedores: {
          select: { principal: true, prazoEntregaDias: true },
        },
        ProdutoMercadoLivre: {
          select: {
            mlStatus: true,
            mlPrice: true,
            mlCustoFrete: true,
            mlTarifaVenda: true,
            mlCustosAtualizadosEm: true,
            mlFreeShipping: true,
          },
        },
      },
    }),
    prisma.armazem.findMany({
      where: { userId, blingDepositoId: { not: null } },
      select: { id: true },
    }),
  ]);

  const armazemBlingIds = new Set(armazensBling.map((a) => a.id));

  const ultimaMovimentacaoPorPar = new Map<
    string,
    { origem: string; createdAt: Date }
  >();

  if (armazemBlingIds.size > 0) {
    const movimentacoes = await prisma.estoqueMovimentacao.findMany({
      where: {
        userId,
        armazemId: { in: Array.from(armazemBlingIds) },
        createdAt: { gte: new Date(Date.now() - TRINTA_DIAS_MS) },
      },
      orderBy: { createdAt: "desc" },
      select: {
        produtoId: true,
        armazemId: true,
        origem: true,
        createdAt: true,
      },
      take: 5000,
    });

    for (const mov of movimentacoes) {
      const chave = `${mov.produtoId}:${mov.armazemId}`;
      if (!ultimaMovimentacaoPorPar.has(chave)) {
        ultimaMovimentacaoPorPar.set(chave, {
          origem: mov.origem,
          createdAt: mov.createdAt,
        });
      }
    }
  }

  return produtos.map((produto) => {
    const estoqueTotal = produto.estoques.reduce(
      (sum, e) => sum + e.quantidade,
      0
    );

    const estoqueDivergente = produto.estoques.some((e) => {
      if (!armazemBlingIds.has(e.armazemId)) return false;
      const ultima = ultimaMovimentacaoPorPar.get(
        `${produto.id}:${e.armazemId}`
      );
      return !!ultima && ultima.origem !== "SINCRONIZACAO_BLING";
    });

    const pendencias = calcularPendencias({
      isKit: produto.isKit,
      custoMedio: produto.custoMedio,
      precoVenda: produto.precoVenda,
      ean: produto.ean,
      componentes: produto.componentes,
      fornecedores: produto.fornecedores,
      produtosMercadoLivre: produto.ProdutoMercadoLivre,
      estoqueDivergente,
    });

    return {
      produtoId: produto.id,
      nome: produto.nome,
      sku: produto.sku,
      estoqueTotal,
      custoMedio: produto.custoMedio,
      pendencias,
    };
  });
}
