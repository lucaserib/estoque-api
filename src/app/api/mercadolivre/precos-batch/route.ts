import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchMlWithBackoff } from "@/lib/mlFetch";

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

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.contaId, isActive: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    const accessToken = await MercadoLivreService.getValidToken(accountId);

    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - (forceUpdate ? 0 : 30));

    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        mlStatus: "active",
        ...(!forceUpdate
          ? {
              OR: [
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma não tipa filtro `null` neste campo DateTime
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
      orderBy: { lastSyncAt: "asc" },
      take: 50,
    });

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

    const batches = [];
    for (let i = 0; i < produtos.length; i += 5) {
      batches.push(produtos.slice(i, i + 5));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map(async (produto) => {
          try {
            const response = await fetchMlWithBackoff(
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

            }
          } catch (error) {
            console.error(`[PRECOS_BATCH] Erro ${produto.mlItemId}:`, error);
            errors.push(`${produto.mlItemId}: ${error}`);
          }
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return NextResponse.json({
      success: true,
      processed: produtos.length,
      updated,
      withPromotion,
      errors: errors.slice(0, 10),
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
