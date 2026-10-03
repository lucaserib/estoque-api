import { prisma } from "@/lib/prisma";
import { CustoOrigem } from "@prisma/client";

const PEDIDOS_CONSIDERADOS = 10;

export interface ResolverCustoInput {
  produtoId?: string;
  sku: string;
  userId: string;
  precoCustoFornecedorPadraoBling?: number | null;
  precoCustoProdutoBling?: number | null;
}

export interface ResolverCustoResultado {
  custoMedio: number | null;
  custoOrigem: CustoOrigem | null;
  preservado: boolean;
}

async function mediaPonderadaPedidosCompra(
  sku: string,
  userId: string
): Promise<number | null> {
  const compras = await prisma.pedidoProduto.findMany({
    where: {
      produto: { sku, userId },
      pedido: { userId, status: "confirmado" },
    },
    select: { custo: true, quantidade: true, multiplicador: true },
    orderBy: { pedido: { dataConclusao: "desc" } },
    take: PEDIDOS_CONSIDERADOS,
  });

  if (compras.length === 0) return null;

  const custoTotal = compras.reduce(
    (soma, compra) =>
      soma + compra.custo * compra.quantidade * (compra.multiplicador || 1),
    0
  );
  const quantidadeTotal = compras.reduce(
    (soma, compra) => soma + compra.quantidade * (compra.multiplicador || 1),
    0
  );

  return quantidadeTotal > 0 ? Math.round(custoTotal / quantidadeTotal) : null;
}

export async function resolverCustoProduto(
  input: ResolverCustoInput
): Promise<ResolverCustoResultado> {
  if (input.produtoId) {
    const produtoAtual = await prisma.produto.findUnique({
      where: { id: input.produtoId },
      select: { custoOrigem: true, custoMedio: true },
    });

    if (
      produtoAtual &&
      (produtoAtual.custoOrigem === "MANUAL" ||
        produtoAtual.custoOrigem === "PLANILHA")
    ) {
      return {
        custoMedio: produtoAtual.custoMedio,
        custoOrigem: produtoAtual.custoOrigem,
        preservado: true,
      };
    }
  }

  const mediaPonderada = await mediaPonderadaPedidosCompra(
    input.sku,
    input.userId
  );
  if (mediaPonderada !== null) {
    return {
      custoMedio: mediaPonderada,
      custoOrigem: "PEDIDO_COMPRA",
      preservado: false,
    };
  }

  if (
    input.precoCustoFornecedorPadraoBling &&
    input.precoCustoFornecedorPadraoBling > 0
  ) {
    return {
      custoMedio: Math.round(input.precoCustoFornecedorPadraoBling * 100),
      custoOrigem: "BLING_FORNECEDOR",
      preservado: false,
    };
  }

  if (input.precoCustoProdutoBling && input.precoCustoProdutoBling > 0) {
    return {
      custoMedio: Math.round(input.precoCustoProdutoBling * 100),
      custoOrigem: "BLING_PRODUTO",
      preservado: false,
    };
  }

  return { custoMedio: null, custoOrigem: null, preservado: false };
}

export interface CalcularCustoKitResultado {
  custoMedio: number | null;
  completo: boolean;
}

export async function calcularCustoKit(
  kitId: string
): Promise<CalcularCustoKitResultado> {
  const componentes = await prisma.componente.findMany({
    where: { kitId },
    select: {
      quantidade: true,
      produto: { select: { custoMedio: true } },
    },
  });

  if (componentes.length === 0) {
    return { custoMedio: null, completo: false };
  }

  let total = 0;
  for (const componente of componentes) {
    if (componente.produto.custoMedio === null) {
      return { custoMedio: null, completo: false };
    }
    total += componente.produto.custoMedio * componente.quantidade;
  }

  return { custoMedio: total, completo: true };
}
