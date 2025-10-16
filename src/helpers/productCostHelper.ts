import { prisma } from "@/lib/prisma";

/**
 * Busca o custo de um produto seguindo esta ordem de prioridade:
 * 1. Custo do Bling (precoCusto)
 * 2. Preço da última compra no sistema
 * 3. Zero (se nenhum dos anteriores existir)
 *
 * @param blingPrecoCusto - Custo vindo do Bling (opcional)
 * @param sku - SKU do produto para buscar última compra
 * @param userId - ID do usuário para filtrar pedidos
 * @returns Custo em centavos (número inteiro)
 */
export async function getProductCost(
  blingPrecoCusto: number | undefined | null,
  sku: string,
  userId: string
): Promise<number> {
  // 1. Se tem custo do Bling e é maior que zero, usa ele
  if (blingPrecoCusto && blingPrecoCusto > 0) {
    return Math.round(blingPrecoCusto * 100); // Converter para centavos
  }

  // 2. Buscar última compra do produto no sistema
  const lastPurchase = await prisma.pedidoProduto.findFirst({
    where: {
      produto: {
        sku,
        userId,
      },
      pedido: {
        userId,
        status: {
          in: ["recebido", "concluido"], // Apenas pedidos recebidos/concluídos
        },
      },
    },
    orderBy: {
      pedido: {
        dataConclusao: "desc", // Ordenar pela compra mais recente
      },
    },
    select: {
      custo: true,
      multiplicador: true,
    },
  });

  if (lastPurchase && lastPurchase.custo > 0) {
    // Retorna o custo da última compra (já está em centavos)
    return lastPurchase.custo;
  }

  // 3. Nenhum custo encontrado, retornar zero
  return 0;
}

/**
 * Calcula o custo médio baseado em múltiplas compras
 * (funcionalidade futura - pode ser útil)
 *
 * @param sku - SKU do produto
 * @param userId - ID do usuário
 * @returns Custo médio em centavos
 */
export async function getAverageCost(
  sku: string,
  userId: string
): Promise<number> {
  const purchases = await prisma.pedidoProduto.findMany({
    where: {
      produto: {
        sku,
        userId,
      },
      pedido: {
        userId,
        status: {
          in: ["recebido", "concluido"],
        },
      },
    },
    select: {
      custo: true,
      quantidade: true,
    },
    take: 10, // Considerar últimas 10 compras
  });

  if (purchases.length === 0) {
    return 0;
  }

  // Calcular média ponderada
  const totalCost = purchases.reduce(
    (sum, p) => sum + p.custo * p.quantidade,
    0
  );
  const totalQuantity = purchases.reduce((sum, p) => sum + p.quantidade, 0);

  return totalQuantity > 0 ? Math.round(totalCost / totalQuantity) : 0;
}
