import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    console.log("[TEST_PRODUTOS] 🚀 Iniciando sem auth para debug...");
    
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    console.log("[TEST_PRODUTOS] 🔍 Buscando conta ML...");
    
    // Buscar conta sem verificar usuário para debug
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        isActive: true,
      },
    });

    if (!account) {
      console.log("[TEST_PRODUTOS] ❌ Conta não encontrada");
      return NextResponse.json(
        { error: "Conta do Mercado Livre não encontrada ou inativa" },
        { status: 404 }
      );
    }
    
    console.log("[TEST_PRODUTOS] ✅ Conta encontrada:", account.mlUserId);

    console.log("[TEST_PRODUTOS] 📦 Buscando produtos...");
    
    // Buscar produtos ML
    const produtosML = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
      },
      take: 5,
      orderBy: { lastSyncAt: "desc" },
    });

    console.log(`[TEST_PRODUTOS] ✅ ${produtosML.length} produtos encontrados`);

    const products = produtosML.map(produto => ({
      id: produto.id,
      mlItemId: produto.mlItemId,
      mlTitle: produto.mlTitle?.substring(0, 60) + "...",
      mlStatus: produto.mlStatus,
      mlPrice: produto.mlPrice,
      mlOriginalPrice: produto.mlOriginalPrice,
      mlHasPromotion: produto.mlHasPromotion,
      mlPromotionDiscount: produto.mlPromotionDiscount,
      mlAvailableQuantity: produto.mlAvailableQuantity,
      mlSoldQuantity: produto.mlSoldQuantity,
      
      // Preços formatados corretamente
      priceFormatted: `R$ ${(produto.mlPrice / 100).toFixed(2)}`,
      originalPriceFormatted: produto.mlOriginalPrice ? `R$ ${(produto.mlOriginalPrice / 100).toFixed(2)}` : null,
      savingsFormatted: produto.mlOriginalPrice ? `R$ ${((produto.mlOriginalPrice - produto.mlPrice) / 100).toFixed(2)}` : null,
      
      salesData: {
        quantity30d: produto.mlSoldQuantity || 0,
        revenue30d: (produto.mlSoldQuantity || 0) * (produto.mlPrice || 0),
        salesVelocity: (produto.mlSoldQuantity || 0) / 30,
      }
    }));

    console.log("[TEST_PRODUTOS] ✅ Produtos formatados, retornando...");

    return NextResponse.json({
      products,
      total: products.length,
      debug: "Sem autenticação para teste",
      summary: {
        withPromotion: products.filter(p => p.mlHasPromotion).length,
        active: products.filter(p => p.mlStatus === "active").length,
        paused: products.filter(p => p.mlStatus === "paused").length,
      }
    });

  } catch (error) {
    console.error("[TEST_PRODUTOS] ❌ Erro:", error);
    return NextResponse.json(
      { error: `Erro específico: ${error.message}` },
      { status: 500 }
    );
  }
}
