import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

/**
 * API OTIMIZADA para atualizar preços promocionais em lote
 * Melhora performance evitando buscar preços individuais
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { accountId, forceUpdate = false } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId é obrigatório" },
        { status: 400 }
      );
    }

    console.log(
      `[PRECOS_BATCH] Iniciando atualização ${
        forceUpdate ? "forçada" : "inteligente"
      } de preços`
    );

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.id, isActive: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    const accessToken = await MercadoLivreService.getValidToken(accountId);

    // ✅ OTIMIZAÇÃO: Buscar apenas produtos que precisam de atualização
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - (forceUpdate ? 0 : 30)); // 30 min cache

    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        mlStatus: "active",
        ...(!forceUpdate
          ? {
              OR: [
                { lastSyncAt: null as any },
                { lastSyncAt: { lt: cutoffTime } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlPrice: true,
        mlOriginalPrice: true,
        mlHasPromotion: true,
        lastSyncAt: true,
      },
      orderBy: { lastSyncAt: "asc" }, // Mais antigos primeiro
      take: 50, // ✅ PERFORMANCE: Processar em lotes de 50
    });

    console.log(`[PRECOS_BATCH] ${produtos.length} produtos para atualizar`);

    if (produtos.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Nenhum produto precisa de atualização",
        updated: 0,
      });
    }

    let updated = 0;
    let withPromotion = 0;
    const errors: string[] = [];

    // ✅ PROCESSAMENTO: Atualizar preços em paralelo (max 5 simultâneos)
    const batches = [];
    for (let i = 0; i < produtos.length; i += 5) {
      batches.push(produtos.slice(i, i + 5));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (produto) => {
          try {
            // ✅ API OFICIAL: Buscar preços usando endpoint /prices
            const response = await fetch(
              `https://api.mercadolibre.com/items/${produto.mlItemId}/prices`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );

            if (!response.ok) {
              errors.push(`${produto.mlItemId}: HTTP ${response.status}`);
              return;
            }

            const data = await response.json();

            // ✅ PROCESSAMENTO: Extrair preços conforme documentação ML
            const standardPrice = data.prices?.find(
              (p: {
                type: string;
                amount: number;
                conditions?: { context_restrictions?: string[] };
              }) =>
                p.type === "standard" &&
                p.conditions?.context_restrictions?.includes(
                  "channel_marketplace"
                )
            );

            const promotionPrice = data.prices?.find(
              (p: {
                type: string;
                amount: number;
                regular_amount: number;
                conditions?: { context_restrictions?: string[] };
              }) =>
                p.type === "promotion" &&
                p.conditions?.context_restrictions?.includes(
                  "channel_marketplace"
                )
            );

            // ✅ CÁLCULO: Determinar preços finais
            let finalPrice = Math.round((standardPrice?.amount || 0) * 100);
            let originalPrice: number | null = null;
            let hasPromotion = false;
            let promotionDiscount: number | null = null;

            if (promotionPrice && promotionPrice.regular_amount) {
              finalPrice = Math.round(promotionPrice.amount * 100);
              originalPrice = Math.round(promotionPrice.regular_amount * 100);
              hasPromotion = true;
              promotionDiscount = Math.round(
                ((promotionPrice.regular_amount - promotionPrice.amount) /
                  promotionPrice.regular_amount) *
                  100
              );
              withPromotion++;
            }

            // ✅ ATUALIZAÇÃO: Apenas se houver mudança real
            if (
              produto.mlPrice !== finalPrice ||
              produto.mlOriginalPrice !== originalPrice ||
              produto.mlHasPromotion !== hasPromotion
            ) {
              await prisma.produtoMercadoLivre.update({
                where: { id: produto.id },
                data: {
                  mlPrice: finalPrice,
                  mlOriginalPrice: originalPrice,
                  mlBasePrice: standardPrice
                    ? Math.round(standardPrice.amount * 100)
                    : null,
                  mlHasPromotion: hasPromotion,
                  mlPromotionDiscount: promotionDiscount,
                  lastSyncAt: new Date(),
                },
              });

              updated++;

              console.log(
                `[PRECOS_BATCH] ✅ ${produto.mlItemId}: R$ ${(
                  finalPrice / 100
                ).toFixed(2)}${
                  hasPromotion ? ` (${promotionDiscount}% OFF)` : ""
                }`
              );
            }
          } catch (error) {
            console.error(`[PRECOS_BATCH] Erro ${produto.mlItemId}:`, error);
            errors.push(`${produto.mlItemId}: ${error}`);
          }
        })
      );

      // ✅ DELAY: Evitar rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(
      `[PRECOS_BATCH] ✅ Concluído: ${updated} atualizados, ${withPromotion} com promoção`
    );

    return NextResponse.json({
      success: true,
      processed: produtos.length,
      updated,
      withPromotion,
      errors: errors.slice(0, 10), // Máximo 10 erros
      summary: {
        message: `${updated} produtos atualizados, ${withPromotion} com promoção ativa`,
        nextUpdate: forceUpdate ? "Imediato" : "30 minutos",
      },
    });
  } catch (error) {
    console.error("[PRECOS_BATCH] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
