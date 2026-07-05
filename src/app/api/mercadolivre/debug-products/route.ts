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

    // Buscar alguns produtos para debug
    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
      },
      take: 5,
      orderBy: { lastSyncAt: "desc" },
    });

    console.log("[DEBUG_PRODUCTS] Produtos encontrados:", produtos.length);

    const debug = produtos.map(produto => ({
      mlItemId: produto.mlItemId,
      mlTitle: produto.mlTitle?.substring(0, 50) + "...",
      mlPrice: produto.mlPrice,
      mlOriginalPrice: produto.mlOriginalPrice,
      mlHasPromotion: produto.mlHasPromotion,
      mlPromotionDiscount: produto.mlPromotionDiscount,
      mlAvailableQuantity: produto.mlAvailableQuantity,
      mlSoldQuantity: produto.mlSoldQuantity,
      lastSyncAt: produto.lastSyncAt,
      // Formatação aplicada
      priceFormatted: produto.mlPrice ? (produto.mlPrice / 100).toFixed(2) : "N/A",
      originalPriceFormatted: produto.mlOriginalPrice ? (produto.mlOriginalPrice / 100).toFixed(2) : "N/A",
      // Dados brutos para debug
      rawPrice: produto.mlPrice,
      rawOriginalPrice: produto.mlOriginalPrice,
    }));

    return NextResponse.json({
      debug,
      totalFound: produtos.length,
      accountId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Erro na API de debug:", error);
    return NextResponse.json(
      { 
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    );
  }
}
