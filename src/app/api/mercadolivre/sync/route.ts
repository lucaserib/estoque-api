import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { NotificationService } from "@/services/notificationService";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { pickMlImageUrl } from "@/lib/imageUrl";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const action = searchParams.get("action");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    if (action === "history") {
      const history = await prisma.mercadoLivreSyncHistory.findMany({
        where: { mercadoLivreAccountId: accountId },
        orderBy: { startedAt: "desc" },
        take: 50,
      });
      return NextResponse.json(history);
    }

    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: { mercadoLivreAccountId: accountId },
      include: { produto: true },
      orderBy: { lastSyncAt: "desc" },
    });
    return NextResponse.json(produtos);
  } catch (error) {
    console.error("[SYNC][GET] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao carregar dados de sincronização" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let notifyUserId: string | null = null;
  try {
    const user = await verifyUser(request);
    notifyUserId = user.id;

    const rateLimit = await checkRateLimit("ml-sync", user.id, 5, 300);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const { accountId, syncType = "full" } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    const startTime = Date.now();

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      const itemsResponse = await MercadoLivreService.getUserItems(accessToken);

      let newItems = 0;
      let updatedItems = 0;
      let errorItems = 0;
      const errors: string[] = [];


      const BATCH_SIZE = 8; // Processar 8 produtos por vez
      const productBatches: string[][] = [];

      for (let i = 0; i < itemsResponse.results.length; i += BATCH_SIZE) {
        productBatches.push(itemsResponse.results.slice(i, i + BATCH_SIZE));
      }


      for (
        let batchIndex = 0;
        batchIndex < productBatches.length;
        batchIndex++
      ) {
        const batch = productBatches[batchIndex];

        const batchResults = await Promise.allSettled(
          batch.map(async (itemId) => {
            try {
              const item = await MercadoLivreService.getItem(
                itemId,
                accessToken
              );

              const existingProduct =
                await prisma.produtoMercadoLivre.findFirst({
                  where: {
                    mlItemId: itemId,
                    mercadoLivreAccountId: accountId,
                  },
                });

              let currentPrice = Math.round(item.price * 100);
              let originalPrice = item.original_price
                ? Math.round(item.original_price * 100)
                : null;
              const basePrice = item.base_price
                ? Math.round(item.base_price * 100)
                : null;
              let hasPromotion = false;
              let promotionDiscount = 0;

              if (!originalPrice || originalPrice <= currentPrice) {
                try {

                  const pricesResponse = await fetch(
                    `https://api.mercadolibre.com/items/${itemId}/prices`,
                    {
                      headers: { Authorization: `Bearer ${accessToken}` },
                    }
                  );

                  if (pricesResponse.ok) {
                    const pricesData = await pricesResponse.json();

                    const standardPrice = pricesData.prices?.find(
                      (p: {
                        type?: string;
                        amount?: number;
                        regular_amount?: number;
                        conditions?: { context_restrictions?: string[] };
                      }) =>
                        p.type === "standard" &&
                        p.conditions?.context_restrictions?.includes(
                          "channel_marketplace"
                        )
                    );

                    const promotionPrice = pricesData.prices?.find(
                      (p: {
                        type?: string;
                        amount?: number;
                        regular_amount?: number;
                        conditions?: { context_restrictions?: string[] };
                      }) =>
                        p.type === "promotion" &&
                        p.conditions?.context_restrictions?.includes(
                          "channel_marketplace"
                        )
                    );

                    if (promotionPrice && promotionPrice.regular_amount) {
                      currentPrice = Math.round(promotionPrice.amount * 100);
                      originalPrice = Math.round(
                        promotionPrice.regular_amount * 100
                      );
                      hasPromotion = true;

                    } else if (standardPrice) {
                      currentPrice = Math.round(standardPrice.amount * 100);
                    }
                  }
                } catch (priceError) {
                  console.error(
                    `[SYNC] ❌ Erro ao buscar preços para ${itemId}:`,
                    priceError
                  );
                }
              } else {
                hasPromotion = true;
              }

              if (
                hasPromotion &&
                originalPrice &&
                originalPrice > currentPrice
              ) {
                promotionDiscount = Math.round(
                  ((originalPrice - currentPrice) / originalPrice) * 100
                );
              }


              const productData = {
                mlTitle: item.title,
                mlPrice: currentPrice,
                mlOriginalPrice: originalPrice, // ✅ NOVO: Preço original
                mlBasePrice: basePrice, // ✅ NOVO: Preço base
                mlHasPromotion: Boolean(hasPromotion), // ✅ CORREÇÃO: Garantir tipo boolean
                mlPromotionDiscount: hasPromotion ? promotionDiscount : null, // ✅ NOVO: % desconto
                mlAvailableQuantity: item.available_quantity,
                mlSoldQuantity: item.sold_quantity || 0,
                mlStatus: item.status,
                mlCondition: item.condition,
                mlListingType: item.listing_type_id || "gold_special",
                mlPermalink: item.permalink,
                mlThumbnail: pickMlImageUrl(item),
                mlCategoryId: item.category_id,
                mlShippingMode:
                  item.shipping?.logistic_type || item.shipping?.mode || null, // ✅ NOVO: Modo de envio (fulfillment, me2, custom)
                mlLastUpdated: new Date(item.last_updated || new Date()),
                lastSyncAt: new Date(),
                syncStatus: "synced",
                syncError: null,
              };

              if (existingProduct) {
                await prisma.produtoMercadoLivre.update({
                  where: { id: existingProduct.id },
                  data: productData,
                });
                return { type: "updated", itemId };
              } else {
                const realSku = MercadoLivreService.extractRealSku(item);
                let localProductId: string | null = null;

                if (realSku) {
                  const localProduct = await prisma.produto.findFirst({
                    where: {
                      sku: realSku,
                      userId: user.id,
                    },
                  });

                  if (localProduct) {
                    localProductId = localProduct.id;
                  }
                }

                await prisma.produtoMercadoLivre.create({
                  data: {
                    ...productData,
                    produtoId: localProductId, // Pode ser null
                    mercadoLivreAccountId: accountId,
                    mlItemId: itemId,
                    syncStatus: localProductId ? "synced" : "pending_link", // Status diferente se não vinculado
                  },
                });
                return { type: "created", itemId, linked: !!localProductId };
              }
            } catch (itemError) {
              const errorMessage = `Erro no produto ${itemId}: ${
                itemError instanceof Error
                  ? itemError.message
                  : "Erro desconhecido"
              }`;
              console.error(`[SYNC] ${errorMessage}`);
              return { type: "error", itemId, error: errorMessage };
            }
          })
        );

        batchResults.forEach((result) => {
          if (result.status === "fulfilled") {
            const value = result.value;
            switch (value?.type) {
              case "updated":
                updatedItems++;
                break;
              case "created":
                newItems++;
                break;
              case "skipped":
                break;
              case "error":
                errorItems++;
                errors.push((value as { error: string }).error);
                break;
            }
          } else {
            errorItems++;
            const errorMessage = `Erro inesperado no lote: ${result.reason}`;
            errors.push(errorMessage);
            console.error(`[SYNC] ${errorMessage}`);
          }
        });

        if (batchIndex < productBatches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      const syncedItems = newItems + updatedItems;


      return NextResponse.json({
        success: true,
        syncedCount: syncedItems,
        totalItems: itemsResponse.results.length,
        duration,
      });
    } catch (syncError) {
      console.error("Erro na sincronização:", syncError);
      throw syncError;
    }
  } catch (error) {
    console.error("Erro na sincronização:", error);
    if (notifyUserId) {
      await NotificationService.notifySyncError(
        notifyUserId,
        error instanceof Error ? error.message : "Erro na sincronização"
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro na sincronização",
      },
      { status: 500 }
    );
  }
}
