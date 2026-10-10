import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/produtos/estoque-full
 * Lê o snapshot de estoque Full já gravado por produto durante a
 * sincronização de anúncios (sync/route.ts, processItemWebhook) — em vez
 * de chamar a API do ML produto a produto a cada carregamento de tela.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    // Buscar conta ML ativa do usuário
    const mlAccount = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.contaId,
        isActive: true,
      },
    });

    if (!mlAccount) {
      return NextResponse.json({
        success: true,
        estoqueFullPorProduto: {},
      });
    }

    const estoqueFullPorProduto: { [key: string]: number } = {};

    const produtosMLFull = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: mlAccount.id,
        produtoId: { not: null },
        mlLogisticType: "fulfillment",
      },
      select: {
        produtoId: true,
        mlFullDisponivel: true,
      },
    });

    for (const produtoML of produtosMLFull) {
      if (!produtoML.produtoId || produtoML.mlFullDisponivel == null) {
        continue;
      }
      estoqueFullPorProduto[produtoML.produtoId] =
        (estoqueFullPorProduto[produtoML.produtoId] || 0) +
        produtoML.mlFullDisponivel;
    }

    return NextResponse.json({
      success: true,
      estoqueFullPorProduto,
      totalProdutosFull: Object.keys(estoqueFullPorProduto).length,
      totalUnidadesFull: Object.values(estoqueFullPorProduto).reduce(
        (sum, val) => sum + val,
        0
      ),
    });
  } catch (error) {
    console.error("Erro ao buscar estoque Full:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao buscar estoque Full",
      },
      { status: 500 }
    );
  }
}
