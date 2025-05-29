import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { prisma } from "@/lib/prisma";
import { MLSyncResult } from "@/types/mercadolivre";

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

    // Criar histórico de sincronização
    const syncHistory = await MercadoLivreService.createSyncHistory(
      accountId,
      syncType
    );

    const result: MLSyncResult = {
      success: false,
      totalItems: 0,
      syncedItems: 0,
      errors: [],
      newItems: 0,
      updatedItems: 0,
      errorItems: 0,
      syncHistoryId: syncHistory.id,
    };

    const startTime = Date.now();

    try {
      // Obter token válido
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // Buscar todos os produtos do usuário no ML com paginação
      let offset = 0;
      const limit = 50;
      let hasMore = true;
      const allItemIds: string[] = [];

      while (hasMore) {
        const itemsResponse = await MercadoLivreService.getUserItems(
          accessToken,
          {
            offset,
            limit,
          }
        );

        allItemIds.push(...itemsResponse.results);
        result.totalItems = itemsResponse.paging.total;

        // Verificar se há mais páginas
        hasMore =
          itemsResponse.results.length === limit &&
          offset + limit < itemsResponse.paging.total;
        offset += limit;
      }

      if (result.totalItems === 0) {
        result.success = true;
        await MercadoLivreService.updateSyncHistory(syncHistory.id, {
          status: "success",
          totalItems: result.totalItems,
          syncedItems: result.syncedItems,
          newItems: result.newItems,
          updatedItems: result.updatedItems,
          errorItems: result.errorItems,
          errors: result.errors,
        });
        return NextResponse.json(result);
      }

      // Buscar detalhes dos produtos em lotes
      const BATCH_SIZE = 20;

      for (let i = 0; i < allItemIds.length; i += BATCH_SIZE) {
        const batch = allItemIds.slice(i, i + BATCH_SIZE);

        try {
          const items = await MercadoLivreService.getMultipleItems(
            batch,
            accessToken
          );

          for (const item of items) {
            try {
              // Verificar se já existe no banco
              const existingProduct =
                await prisma.produtoMercadoLivre.findFirst({
                  where: {
                    mlItemId: item.id,
                    mercadoLivreAccountId: accountId,
                  },
                });

              const productData = {
                mlItemId: item.id,
                mercadoLivreAccountId: accountId,
                mlTitle: item.title,
                mlPrice: Math.round(item.price * 100), // Converter para centavos
                mlAvailableQuantity: item.available_quantity,
                mlSoldQuantity: item.sold_quantity || 0,
                mlStatus: item.status,
                mlCondition: item.condition,
                mlListingType: item.listing_type_id,
                mlPermalink: item.permalink,
                mlThumbnail: item.thumbnail,
                mlCategoryId: item.category_id,
                mlCategoryName: "", // Será preenchido posteriormente se necessário
                mlShippingMode: item.shipping?.mode,
                mlAcceptsMercadoPago: item.accepts_mercadopago,
                mlFreeShipping: item.shipping?.free_shipping || false,
                mlLastUpdated: item.last_updated
                  ? new Date(item.last_updated)
                  : null,
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
                result.updatedItems++;
              } else {
                // Tentar encontrar produto local correspondente pelo título ou criar sem vínculo
                let produtoId: string | null = null;

                // Buscar produto local por título similar ou SKU
                const localProduct = await prisma.produto.findFirst({
                  where: {
                    userId: user.id,
                    OR: [
                      { nome: { contains: item.title, mode: "insensitive" } },
                      {
                        nome: {
                          contains: item.title.split(" ")[0],
                          mode: "insensitive",
                        },
                      },
                      { sku: { contains: item.id, mode: "insensitive" } },
                    ],
                  },
                });

                if (localProduct) {
                  produtoId = localProduct.id;
                } else {
                  // Criar produto local baseado no item do ML
                  const newProduct = await prisma.produto.create({
                    data: {
                      userId: user.id,
                      nome: item.title,
                      sku: `ML_${item.id}`,
                      custoMedio: Math.round(item.price * 100 * 0.8), // Estimar custo como 80% do preço
                      isKit: false,
                    },
                  });
                  produtoId = newProduct.id;
                }

                // Criar vínculo ML
                await prisma.produtoMercadoLivre.create({
                  data: {
                    ...productData,
                    produtoId,
                  },
                });
                result.newItems++;
              }

              result.syncedItems++;
            } catch (error) {
              console.error(`Erro ao sincronizar item ${item.id}:`, error);
              result.errors.push(
                `Erro no item ${item.title}: ${
                  error instanceof Error ? error.message : "Erro desconhecido"
                }`
              );
              result.errorItems++;
            }
          }
        } catch (error) {
          console.error(`Erro ao buscar lote de itens:`, error);
          result.errors.push(
            `Erro ao buscar lote: ${
              error instanceof Error ? error.message : "Erro desconhecido"
            }`
          );
          result.errorItems += batch.length;
        }
      }

      result.success = result.errorItems < result.totalItems / 2; // Sucesso se menos de 50% dos itens tiveram erro
    } catch (error) {
      console.error("Erro durante a sincronização:", error);
      result.errors.push(
        error instanceof Error ? error.message : "Erro desconhecido"
      );
      result.success = false;
    }

    // Calcular duração
    result.duration = Math.floor((Date.now() - startTime) / 1000);

    // Atualizar histórico de sincronização
    await MercadoLivreService.updateSyncHistory(syncHistory.id, {
      status: result.success ? "success" : "error",
      totalItems: result.totalItems,
      syncedItems: result.syncedItems,
      newItems: result.newItems,
      updatedItems: result.updatedItems,
      errorItems: result.errorItems,
      errors: result.errors,
      duration: result.duration,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Erro na rota de sincronização ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

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

    // Verificar se a conta pertence ao usuário
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    if (action === "history") {
      // Buscar histórico de sincronizações
      const history = await MercadoLivreService.getSyncHistory(accountId);
      return NextResponse.json(history);
    }

    // Buscar produtos sincronizados (ação padrão)
    const products = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccount: {
          id: accountId,
          userId: user.id,
        },
      },
      include: {
        produto: {
          select: {
            id: true,
            nome: true,
            sku: true,
            custoMedio: true,
          },
        },
      },
      orderBy: {
        lastSyncAt: "desc",
      },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("Erro ao buscar dados de sincronização:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { accountId, itemId, updates } = body;

    if (!accountId || !itemId || !updates) {
      return NextResponse.json(
        { error: "Parâmetros insuficientes" },
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

    // Verificar se o produto pertence à conta
    const mlProduct = await prisma.produtoMercadoLivre.findFirst({
      where: {
        mlItemId: itemId,
        mercadoLivreAccountId: accountId,
      },
    });

    if (!mlProduct) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    try {
      // Obter token válido
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // Atualizar no ML
      const updatedItem = await MercadoLivreService.updateItem(
        itemId,
        updates,
        accessToken
      );

      // Atualizar no banco local
      await prisma.produtoMercadoLivre.update({
        where: { id: mlProduct.id },
        data: {
          mlTitle: updatedItem.title,
          mlPrice: Math.round(updatedItem.price * 100),
          mlAvailableQuantity: updatedItem.available_quantity,
          mlStatus: updatedItem.status,
          mlCondition: updatedItem.condition,
          mlLastUpdated: new Date(updatedItem.last_updated),
          lastSyncAt: new Date(),
          syncStatus: "synced",
          syncError: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Produto atualizado com sucesso",
        item: updatedItem,
      });
    } catch (error) {
      // Marcar erro de sincronização
      await prisma.produtoMercadoLivre.update({
        where: { id: mlProduct.id },
        data: {
          syncStatus: "error",
          syncError:
            error instanceof Error ? error.message : "Erro desconhecido",
          lastSyncAt: new Date(),
        },
      });

      throw error;
    }
  } catch (error) {
    console.error("Erro ao atualizar produto ML:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}
