import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/produtos/[id]/mercadolivre
 * Busca produtos ML vinculados a um produto local
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyUser(request);
    const produtoId = params.id;

    // Verificar se o produto pertence ao usuário
    const produto = await prisma.produto.findFirst({
      where: {
        id: produtoId,
        userId: user.id,
      },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Buscar produtos ML vinculados
    const mlProducts = await prisma.produtoMercadoLivre.findMany({
      where: {
        produtoId: produtoId,
      },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlPrice: true,
        mlAvailableQuantity: true,
        mlShippingMode: true,
        mlPermalink: true,
        mlStatus: true,
        mlThumbnail: true,
        lastSyncAt: true,
        mercadoLivreAccount: {
          select: {
            nickname: true,
          },
        },
      },
      orderBy: {
        lastSyncAt: "desc",
      },
    });

    return NextResponse.json({
      products: mlProducts,
      count: mlProducts.length,
    });
  } catch (error) {
    console.error("Erro ao buscar produtos ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
