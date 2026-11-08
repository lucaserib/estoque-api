import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { prisma } from "@/lib/prisma";
import { withCache, createCacheKey } from "@/lib/cache";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";
import { pickMlImageUrl } from "@/lib/imageUrl";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const rateLimit = await checkRateLimit("ml-sync-incremental", user.id, 10, 300);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const { accountId, syncType = "auto", maxItems = 50 } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID é obrigatório" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.contaId,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);
      const startTime = Date.now();

      const result = await performIncrementalSync(
        accessToken,
        accountId,
        user.contaId,
        syncType,
        maxItems
      );

      const timeElapsed = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: {
          ...result,
          timeElapsed,
          syncType,
          accountId,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("[INCREMENTAL_SYNC] Erro:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Erro na sincronização incremental",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[INCREMENTAL_SYNC] Erro na requisição:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

async function performIncrementalSync(
  accessToken: string,
  accountId: string,
  userId: string,
  syncType: string,
  maxItems: number
) {
  const result = {
    processedItems: 0,
    updatedItems: 0,
    newItems: 0,
    skippedItems: 0,
    errors: [] as string[],
    syncStrategies: [] as string[],
  };

  if (syncType === "auto" || syncType === "modified") {

    const modifiedResult = await syncModifiedProducts(
      accessToken,
      accountId,
      userId,
      maxItems
    );

    result.processedItems += modifiedResult.processed;
    result.updatedItems += modifiedResult.updated;
    result.newItems += modifiedResult.created;
    result.errors.push(...modifiedResult.errors);
    result.syncStrategies.push("modified_products");
  }

  if (syncType === "auto" || syncType === "critical") {

    const criticalResult = await syncCriticalStockProducts(
      accessToken,
      accountId,
      userId
    );

    result.processedItems += criticalResult.processed;
    result.updatedItems += criticalResult.updated;
    result.errors.push(...criticalResult.errors);
    result.syncStrategies.push("critical_stock");
  }

  if (syncType === "auto" || syncType === "errors") {

    const errorResult = await syncErrorProducts(
      accessToken,
      accountId,
      userId
    );

    result.processedItems += errorResult.processed;
    result.updatedItems += errorResult.updated;
    result.errors.push(...errorResult.errors);
    result.syncStrategies.push("error_recovery");
  }

  if (syncType === "auto" || syncType === "bestsellers") {

    const bestSellersResult = await syncBestSellingProducts(
      accessToken,
      accountId,
      userId,
      Math.min(20, maxItems)
    );

    result.processedItems += bestSellersResult.processed;
    result.updatedItems += bestSellersResult.updated;
    result.errors.push(...bestSellersResult.errors);
    result.syncStrategies.push("bestsellers");
  }

  return result;
}

async function syncModifiedProducts(
  accessToken: string,
  accountId: string,
  userId: string,
  maxItems: number
) {
  const result = { processed: 0, updated: 0, created: 0, errors: [] as string[] };

  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const searchUrl = `https://api.mercadolibre.com/users/${accountId}/items/search`;
    const searchResponse = await fetch(
      `${searchUrl}?offset=0&limit=${maxItems}&sort=last_updated_desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`Erro ao buscar produtos modificados: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const itemIds = searchData.results || [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < itemIds.length && i < maxItems; i += BATCH_SIZE) {
      const batch = itemIds.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (itemId: string) => {
        try {
          const localProduct = await prisma.produtoMercadoLivre.findFirst({
            where: {
              mlItemId: itemId,
              mercadoLivreAccountId: accountId,
            },
          });

          const item = await MercadoLivreService.getItem(itemId, accessToken);
          const lastUpdated = new Date(item.last_updated);

          if (!localProduct || (localProduct.mlLastUpdated && lastUpdated > localProduct.mlLastUpdated)) {
            await updateProductFromML(item, accountId, userId);

            if (localProduct) {
              result.updated++;
            } else {
              result.created++;
            }
          }

          result.processed++;
        } catch (itemError) {
          const errorMsg = `Erro no produto ${itemId}: ${itemError instanceof Error ? itemError.message : 'Erro desconhecido'}`;
          result.errors.push(errorMsg);
          console.error(`[INCREMENTAL_SYNC] ${errorMsg}`);
        }
      });

      await Promise.allSettled(batchPromises);

      if (i + BATCH_SIZE < itemIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
  } catch (error) {
    const errorMsg = `Erro na sincronização de produtos modificados: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    result.errors.push(errorMsg);
    console.error(`[INCREMENTAL_SYNC] ${errorMsg}`);
  }

  return result;
}

async function syncCriticalStockProducts(
  accessToken: string,
  accountId: string,
  userId: string
) {
  const result = { processed: 0, updated: 0, errors: [] as string[] };

  try {
    const criticalProducts = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        mlStatus: "active",
        mlAvailableQuantity: {
          lte: 5,
        },
      },
      take: 20,
      orderBy: {
        mlAvailableQuantity: "asc",
      },
    });

    for (const produto of criticalProducts) {
      try {
        const item = await MercadoLivreService.getItem(produto.mlItemId, accessToken);

        if (item.available_quantity !== produto.mlAvailableQuantity) {
          await updateProductFromML(item, accountId, userId);
          result.updated++;

        }

        result.processed++;
      } catch (itemError) {
        const errorMsg = `Erro no produto crítico ${produto.mlItemId}: ${itemError instanceof Error ? itemError.message : 'Erro desconhecido'}`;
        result.errors.push(errorMsg);
        console.error(`[INCREMENTAL_SYNC] ${errorMsg}`);
      }
    }
  } catch (error) {
    const errorMsg = `Erro na sincronização de estoque crítico: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    result.errors.push(errorMsg);
    console.error(`[INCREMENTAL_SYNC] ${errorMsg}`);
  }

  return result;
}

async function syncErrorProducts(
  accessToken: string,
  accountId: string,
  userId: string
) {
  const result = { processed: 0, updated: 0, errors: [] as string[] };

  try {
    const errorProducts = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        syncStatus: "error",
      },
      take: 10,
      orderBy: {
        lastSyncAt: "asc",
      },
    });

    for (const produto of errorProducts) {
      try {
        const item = await MercadoLivreService.getItem(produto.mlItemId, accessToken);
        await updateProductFromML(item, accountId, userId);

        result.updated++;

        result.processed++;
      } catch (itemError) {
        console.warn(`[INCREMENTAL_SYNC] Produto ${produto.mlItemId} ainda com erro:`, itemError);
        result.processed++;
      }
    }
  } catch (error) {
    const errorMsg = `Erro na sincronização de produtos com erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    result.errors.push(errorMsg);
    console.error(`[INCREMENTAL_SYNC] ${errorMsg}`);
  }

  return result;
}

async function syncBestSellingProducts(
  accessToken: string,
  accountId: string,
  userId: string,
  maxItems: number
) {
  const result = { processed: 0, updated: 0, errors: [] as string[] };

  try {
    const bestSellers = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        mlStatus: "active",
        mlSoldQuantity: {
          gt: 0,
        },
      },
      take: maxItems,
      orderBy: {
        mlSoldQuantity: "desc",
      },
    });

    for (const produto of bestSellers) {
      try {
        const item = await MercadoLivreService.getItem(produto.mlItemId, accessToken);
        await updateProductFromML(item, accountId, userId);

        result.updated++;
        result.processed++;

      } catch (itemError) {
        const errorMsg = `Erro no best seller ${produto.mlItemId}: ${itemError instanceof Error ? itemError.message : 'Erro desconhecido'}`;
        result.errors.push(errorMsg);
        console.error(`[INCREMENTAL_SYNC] ${errorMsg}`);
        result.processed++;
      }
    }
  } catch (error) {
    const errorMsg = `Erro na sincronização de best sellers: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
    result.errors.push(errorMsg);
    console.error(`[INCREMENTAL_SYNC] ${errorMsg}`);
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- item bruto da API do ML
async function updateProductFromML(item: any, accountId: string, userId: string) {
  const currentPrice = Math.round(item.price * 100);
  const originalPrice = item.original_price ? Math.round(item.original_price * 100) : null;
  const basePrice = item.base_price ? Math.round(item.base_price * 100) : null;
  const hasPromotion = originalPrice && originalPrice > currentPrice;

  let promotionDiscount = 0;
  if (hasPromotion && originalPrice) {
    promotionDiscount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  }

  const productData = {
    mlTitle: item.title,
    mlPrice: currentPrice,
    mlOriginalPrice: originalPrice,
    mlBasePrice: basePrice,
    mlHasPromotion: Boolean(hasPromotion),
    mlPromotionDiscount: hasPromotion ? promotionDiscount : null,
    mlAvailableQuantity: item.available_quantity,
    mlSoldQuantity: item.sold_quantity || 0,
    mlStatus: item.status,
    mlCondition: item.condition,
    mlListingType: item.listing_type_id || "gold_special",
    mlPermalink: item.permalink,
    mlThumbnail: pickMlImageUrl(item),
    mlCategoryId: item.category_id,
    mlLastUpdated: new Date(item.last_updated || new Date()),
    lastSyncAt: new Date(),
    syncStatus: "synced",
    syncError: null,
  };

  const existingProduct = await prisma.produtoMercadoLivre.findFirst({
    where: {
      mlItemId: item.id,
      mercadoLivreAccountId: accountId,
    },
  });

  if (existingProduct) {
    await prisma.produtoMercadoLivre.update({
      where: { id: existingProduct.id },
      data: productData,
    });
  } else {
    const sku = MercadoLivreService.extractRealSku(item);
    let localProductId = null;

    if (sku) {
      const localProduct = await prisma.produto.findFirst({
        where: {
          sku,
          userId,
        },
      });

      if (localProduct) {
        localProductId = localProduct.id;
      }
    }

    if (localProductId) {
      await prisma.produtoMercadoLivre.create({
        data: {
          ...productData,
          produtoId: localProductId,
          mercadoLivreAccountId: accountId,
          mlItemId: item.id,
        },
      });
    }
  }
}