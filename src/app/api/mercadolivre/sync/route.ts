import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

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
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    if (action === "history") {
      // Retornar histórico de sincronizações
      const history = await MercadoLivreService.getSyncHistory(accountId);
      return NextResponse.json(history);
    }

    // Retornar produtos sincronizados
    const products = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
      },
      include: {
        produto: {
          select: {
            id: true,
            nome: true,
            sku: true,
          },
        },
      },
      orderBy: { lastSyncAt: "desc" },
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
    const syncHistory = await MercadoLivreService.createSyncHistory(
      accountId,
      syncType
    );

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

      // Processar cada produto
      for (const itemId of itemsResponse.results) {
        try {
          const item = await MercadoLivreService.getItem(itemId, accessToken);

          // Verificar se já existe
          const existingProduct = await prisma.produtoMercadoLivre.findFirst({
            where: {
              mlItemId: itemId,
              mercadoLivreAccountId: accountId,
            },
          });

          const productData = {
            mlTitle: item.title,
            mlPrice: Math.round(item.price * 100), // Converter para centavos
            mlAvailableQuantity: item.available_quantity,
            mlSoldQuantity: item.sold_quantity || 0,
            mlStatus: item.status,
            mlCondition: item.condition,
            mlListingType: item.listing_type_id || "gold_special",
            mlPermalink: item.permalink,
            mlThumbnail: item.thumbnail,
            mlCategoryId: item.category_id,
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
            updatedItems++;
          } else {
            // Criar novo produto sem vinculação por enquanto
            // Primeiro, vamos verificar se existe um produto temporário para esse ML Item
            const tempProduct = await prisma.produto.findFirst({
              where: {
                sku: `ML_${itemId}`,
                userId: user.id,
              },
            });

            let localProductId;

            if (tempProduct) {
              localProductId = tempProduct.id;
            } else {
              // Criar produto temporário no sistema local
              const newLocalProduct = await prisma.produto.create({
                data: {
                  nome: item.title,
                  sku: `ML_${itemId}`,
                  userId: user.id,
                  isKit: false,
                },
              });
              localProductId = newLocalProduct.id;
            }

            // Criar produto ML vinculado ao produto local temporário
            await prisma.produtoMercadoLivre.create({
              data: {
                ...productData,
                produtoId: localProductId,
                mercadoLivreAccountId: accountId,
                mlItemId: itemId,
              },
            });
            newItems++;
          }

          console.log(`[SYNC] Produto ${itemId} processado com sucesso`);
        } catch (itemError) {
          errorItems++;
          const errorMessage = `Erro no produto ${itemId}: ${
            itemError instanceof Error ? itemError.message : "Erro desconhecido"
          }`;
          errors.push(errorMessage);
          console.error(`[SYNC] ${errorMessage}`);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      const syncedItems = newItems + updatedItems;

      // Atualizar histórico
      await MercadoLivreService.updateSyncHistory(syncHistory.id, {
        status: errorItems > 0 ? "partial" : "success",
        totalItems: itemsResponse.results.length,
        syncedItems,
        newItems,
        updatedItems,
        errorItems,
        errors,
        duration,
      });

      console.log(`[SYNC] Sincronização concluída em ${duration}s`);

      return NextResponse.json({
        success: true,
        totalItems: itemsResponse.results.length,
        syncedItems,
        newItems,
        updatedItems,
        errorItems,
        errors,
        duration,
      });
    } catch (syncError) {
      // Marcar sincronização como erro
      await MercadoLivreService.updateSyncHistory(syncHistory.id, {
        status: "error",
        errors: [
          syncError instanceof Error ? syncError.message : "Erro desconhecido",
        ],
        duration: Math.round((Date.now() - startTime) / 1000),
      });

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
