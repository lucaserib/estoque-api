import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

/**
 * GET /api/produtos/estoque-full
 * Busca estoque Full atual em tempo real da API do ML
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    // Buscar conta ML ativa do usuário
    const mlAccount = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (!mlAccount) {
      return NextResponse.json({
        success: true,
        estoqueFullPorProduto: {},
      });
    }

    const accessToken = await MercadoLivreService.getValidToken(mlAccount.id);

    console.log(`[ESTOQUE_FULL] Buscando estoque Full em tempo real...`);
    const estoqueFullPorProduto: { [key: string]: number } = {};

    const produtosMLVinculados = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: mlAccount.id,
        produtoId: { not: null },
      },
      select: {
        produtoId: true,
        mlItemId: true,
      },
    });

    console.log(
      `[ESTOQUE_FULL] Verificando ${produtosMLVinculados.length} produtos vinculados...`
    );

    // Buscar dados atualizados de cada item do ML em tempo real
    for (const produtoML of produtosMLVinculados) {
      try {
        const item = await MercadoLivreService.getItem(
          produtoML.mlItemId,
          accessToken
        );

        // Verificar se é Full (logistic_type = fulfillment)
        if (
          item.shipping?.logistic_type === "fulfillment" &&
          produtoML.produtoId
        ) {
          estoqueFullPorProduto[produtoML.produtoId] =
            (estoqueFullPorProduto[produtoML.produtoId] || 0) +
            item.available_quantity;

          console.log(
            `[ESTOQUE_FULL] ✅ ${produtoML.mlItemId}: ${item.available_quantity} unidades`
          );
        }
      } catch (itemError) {
        console.error(
          `[ESTOQUE_FULL] Erro ao buscar item ${produtoML.mlItemId}:`,
          itemError
        );
      }
    }

    console.log(
      `[ESTOQUE_FULL] Total de produtos com Full: ${
        Object.keys(estoqueFullPorProduto).length
      }`
    );

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
