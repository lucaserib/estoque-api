import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {

    const user = await verifyUser(request);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }


    // Buscar produtos sem vendas primeiro
    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
      },
      take: 10,
      orderBy: { lastSyncAt: "desc" },
      select: {
        mlItemId: true,
        mlTitle: true,
        mlStatus: true,
        mlPrice: true,
        mlOriginalPrice: true,
        mlHasPromotion: true,
        mlPromotionDiscount: true,
        mlSoldQuantity: true,
        mlAvailableQuantity: true,
      },
    });


    const formattedProducts = produtos.map((produto) => ({
      ...produto,
      salesData: {
        quantity30d: produto.mlSoldQuantity || 0,
        revenue30d: (produto.mlSoldQuantity || 0) * (produto.mlPrice || 0),
        salesVelocity: (produto.mlSoldQuantity || 0) / 30,
      },
    }));

    return NextResponse.json({
      products: formattedProducts,
      total: formattedProducts.length,
    });
  } catch (error) {
    console.error("[PRODUTOS_SIMPLE] Erro:", error);
    return NextResponse.json(
      {
        error: `Erro interno: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
