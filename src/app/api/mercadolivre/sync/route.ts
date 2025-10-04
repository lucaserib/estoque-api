import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { accountId, syncType = "full" } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se a conta pertence ao usuário
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

    // Iniciar sincronização
    const startTime = Date.now();

    try {
      // Obter token válido
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // Buscar produtos do ML
      console.log(`[SYNC] Iniciando sincronização para conta ${accountId}`);
      const itemsResponse = await MercadoLivreService.getUserItems(accessToken);

      let newItems = 0;
      let updatedItems = 0;
      let errorItems = 0;
      const errors: string[] = [];

      console.log(
        `[SYNC] ${itemsResponse.results.length} produtos encontrados no ML`
      );

      // ✅ NOVO: Processar produtos em paralelo para melhor performance
      const BATCH_SIZE = 8; // Processar 8 produtos por vez
      const productBatches: string[][] = [];

      // Dividir produtos em lotes
      for (let i = 0; i < itemsResponse.results.length; i += BATCH_SIZE) {
        productBatches.push(itemsResponse.results.slice(i, i + BATCH_SIZE));
      }

      console.log(`[SYNC] Processando ${itemsResponse.results.length} produtos em ${productBatches.length} lotes de ${BATCH_SIZE}`);

      // Processar cada lote em paralelo
      for (let batchIndex = 0; batchIndex < productBatches.length; batchIndex++) {
        const batch = productBatches[batchIndex];
        console.log(`[SYNC] Processando lote ${batchIndex + 1}/${productBatches.length} com ${batch.length} produtos`);

        // Processar produtos do lote em paralelo
        const batchResults = await Promise.allSettled(
          batch.map(async (itemId) => {
            try {
              const item = await MercadoLivreService.getItem(itemId, accessToken);

              // Verificar se já existe
              const existingProduct = await prisma.produtoMercadoLivre.findFirst({
                where: {
                  mlItemId: itemId,
                  mercadoLivreAccountId: accountId,
                },
              });

              // ✅ IMPLEMENTAÇÃO MELHORADA: Buscar preços promocionais via API /prices
              let currentPrice = Math.round(item.price * 100);
              let originalPrice = item.original_price
                ? Math.round(item.original_price * 100)
                : null;
              let basePrice = item.base_price
                ? Math.round(item.base_price * 100)
                : null;
              let hasPromotion = false;
              let promotionDiscount = 0;

              // ✅ CORREÇÃO CRÍTICA: Buscar preços detalhados se não encontrou promoção
              if (!originalPrice || originalPrice <= currentPrice) {
                try {
                  console.log(`[SYNC] 🔍 Buscando preços detalhados para ${itemId}...`);
                  
                  const pricesResponse = await fetch(
                    `https://api.mercadolibre.com/items/${itemId}/prices`,
                    {
                      headers: { Authorization: `Bearer ${accessToken}` },
                    }
                  );

                  if (pricesResponse.ok) {
                    const pricesData = await pricesResponse.json();
                    
                    // Buscar preço padrão
                    const standardPrice = pricesData.prices?.find((p: any) => 
                      p.type === "standard" && 
                      p.conditions?.context_restrictions?.includes("channel_marketplace")
                    );

                    // Buscar preço promocional
                    const promotionPrice = pricesData.prices?.find((p: any) => 
                      p.type === "promotion" && 
                      p.conditions?.context_restrictions?.includes("channel_marketplace")
                    );

                    if (promotionPrice && promotionPrice.regular_amount) {
                      // Encontrou promoção ativa!
                      currentPrice = Math.round(promotionPrice.amount * 100);
                      originalPrice = Math.round(promotionPrice.regular_amount * 100);
                      hasPromotion = true;
                      
                      console.log(`[SYNC] 🏷️ PROMOÇÃO ENCONTRADA: ${itemId} - R$ ${(currentPrice/100).toFixed(2)} (era R$ ${(originalPrice/100).toFixed(2)})`);
                    } else if (standardPrice) {
                      currentPrice = Math.round(standardPrice.amount * 100);
                      console.log(`[SYNC] 💰 Preço padrão: ${itemId} - R$ ${(currentPrice/100).toFixed(2)}`);
                    }
                  } else {
                    console.log(`[SYNC] ⚠️ Erro ao buscar preços detalhados para ${itemId}: ${pricesResponse.status}`);
                  }
                } catch (priceError) {
                  console.error(`[SYNC] ❌ Erro ao buscar preços para ${itemId}:`, priceError);
                }
              } else {
                hasPromotion = true;
                console.log(`[SYNC] 🏷️ Promoção detectada via item básico: ${itemId}`);
              }

              // Calcular desconto se há promoção
              if (hasPromotion && originalPrice && originalPrice > currentPrice) {
                promotionDiscount = Math.round(
                  ((originalPrice - currentPrice) / originalPrice) * 100
                );
              }

              console.log(
                `[SYNC] ${item.title} - Preço: R$ ${(currentPrice / 100).toFixed(
                  2
                )}${
                  hasPromotion
                    ? ` (Original: R$ ${(originalPrice! / 100).toFixed(
                        2
                      )}, Desconto: ${promotionDiscount}%)`
                    : ""
                }`
              );

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
                mlThumbnail: item.thumbnail,
                mlCategoryId: item.category_id,
                mlShippingMode: item.shipping?.logistic_type || item.shipping?.mode || null, // ✅ NOVO: Modo de envio (fulfillment, me2, custom)
                mlLastUpdated: new Date(item.last_updated || new Date()),
                lastSyncAt: new Date(),
                syncStatus: "synced",
                syncError: null,
              };

              if (existingProduct) {
                // Atualizar produto existente
                await prisma.produtoMercadoLivre.update({
                  where: { id: existingProduct.id },
                  data: productData,
                });
                return { type: 'updated', itemId };
              } else {
                // Tentar extrair SKU real do produto ML
                const realSku = MercadoLivreService.extractRealSku(item);
                let localProductId: string | null = null;

                if (realSku) {
                  // Buscar produto local por SKU real
                  const localProduct = await prisma.produto.findFirst({
                    where: {
                      sku: realSku,
                      userId: user.id,
                    },
                  });

                  if (localProduct) {
                    localProductId = localProduct.id;
                    console.log(
                      `[SYNC] ✅ Produto ${itemId} vinculado automaticamente com SKU ${realSku}`
                    );
                  } else {
                    console.log(
                      `[SYNC] ⚠️ SKU ${realSku} não encontrado localmente para ${itemId} - criando sem vínculo`
                    );
                  }
                } else {
                  console.log(
                    `[SYNC] ⚠️ Produto ${itemId} sem SELLER_SKU - criando sem vínculo`
                  );
                }

                // Criar produto ML (com ou sem vínculo ao produto local)
                await prisma.produtoMercadoLivre.create({
                  data: {
                    ...productData,
                    produtoId: localProductId, // Pode ser null
                    mercadoLivreAccountId: accountId,
                    mlItemId: itemId,
                    syncStatus: localProductId ? "synced" : "pending_link", // Status diferente se não vinculado
                  },
                });
                return { type: 'created', itemId, linked: !!localProductId };
              }
            } catch (itemError) {
              const errorMessage = `Erro no produto ${itemId}: ${
                itemError instanceof Error ? itemError.message : "Erro desconhecido"
              }`;
              console.error(`[SYNC] ${errorMessage}`);
              return { type: 'error', itemId, error: errorMessage };
            }
          })
        );

        // Processar resultados do lote
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            const value = result.value;
            switch (value?.type) {
              case 'updated':
                updatedItems++;
                console.log(`[SYNC] Produto ${value.itemId} atualizado com sucesso`);
                break;
              case 'created':
                newItems++;
                console.log(`[SYNC] Produto ${value.itemId} criado com sucesso`);
                break;
              case 'skipped':
                console.log(`[SYNC] Produto ${value.itemId} pulado: ${value.reason}`);
                break;
              case 'error':
                errorItems++;
                errors.push(value.error);
                break;
            }
          } else {
            errorItems++;
            const errorMessage = `Erro inesperado no lote: ${result.reason}`;
            errors.push(errorMessage);
            console.error(`[SYNC] ${errorMessage}`);
          }
        });

        // Pequena pausa entre lotes para não sobrecarregar a API
        if (batchIndex < productBatches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      const syncedItems = newItems + updatedItems;

      console.log(`[SYNC] Sincronização concluída em ${duration}s`);

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
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro na sincronização",
      },
      { status: 500 }
    );
  }
}
