import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const rateLimit = await checkRateLimit("ml-auto-stock", user.id, 5, 300);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const { accountId, syncAll = false } = await request.json();

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
        userId: user.contaId,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta do Mercado Livre não encontrada" },
        { status: 404 }
      );
    }

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // Buscar produtos vinculados que precisam de sincronização
      const whereClause: Record<string, unknown> = {
        mercadoLivreAccountId: accountId,
        produtoId: { not: { equals: null } }, // Apenas produtos vinculados
        mlStatus: "active", // Apenas produtos ativos no ML
        mlAutoStockPausado: false, // Respeita a pausa manual de envio automático
      };

      if (!syncAll) {
        // Se não for sync completo, sincronizar apenas produtos com diferenças de estoque
        // ou que foram vendidos recentemente
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        (whereClause as Record<string, unknown>).OR = [
          { lastSyncAt: { lt: oneHourAgo } }, // Não sincronizado há mais de 1 hora
          { syncStatus: "pending" }, // Marcados para sincronização
        ];
      }

      const produtosML = await prisma.produtoMercadoLivre.findMany({
        where: whereClause,
        include: {
          produto: {
            include: {
              estoques: {
                where: { armazem: { tipo: "LOCAL" } },
                select: { quantidade: true },
              },
              componentes: {
                include: {
                  produto: {
                    include: {
                      estoques: {
                        where: { armazem: { tipo: "LOCAL" } },
                        select: { quantidade: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });


      let syncedItems = 0;
      let updatedItems = 0;
      const errors: string[] = [];
      const ENVIO_MIN_INTERVALO_MS = 10 * 60 * 1000;

      for (const produtoML of produtosML) {
        if (!produtoML.produto) continue;

        // Nunca enviar estoque para anúncio atendido pelo Full (fulfillment)
        const isFulfillment =
          produtoML.mlLogisticType === "fulfillment" ||
          produtoML.mlShippingMode === "fulfillment";
        if (isFulfillment) continue;

        try {
          // Estoque local (apenas armazéns LOCAL, excluindo FULL_ML)
          let computedStock: number;
          if (
            produtoML.produto.isKit &&
            produtoML.produto.componentes.length > 0
          ) {
            computedStock = Math.min(
              ...produtoML.produto.componentes.map((componente) => {
                const estoqueComponente = componente.produto.estoques.reduce(
                  (sum, estoque) => sum + estoque.quantidade,
                  0
                );
                return Math.floor(estoqueComponente / componente.quantidade);
              })
            );
          } else {
            computedStock = produtoML.produto.estoques.reduce(
              (sum, estoque) => sum + estoque.quantidade,
              0
            );
          }

          const currentMLStock = produtoML.mlAvailableQuantity;
          const diff = computedStock - currentMLStock;

          const minutesSinceLastSend = produtoML.mlUltimoEnvioEstoqueEm
            ? Date.now() - produtoML.mlUltimoEnvioEstoqueEm.getTime()
            : Infinity;

          const shouldUpdate =
            diff !== 0 &&
            (syncAll || minutesSinceLastSend > ENVIO_MIN_INTERVALO_MS);

          if (shouldUpdate) {

            // Atualizar estoque no ML (variação correta quando o anúncio tiver variações)
            const updateSuccess = await MercadoLivreService.updateItemStock(
              produtoML.mlItemId,
              computedStock,
              accessToken,
              produtoML.mlVariationId
            );

            if (updateSuccess) {
              // Atualizar no banco local
              await prisma.produtoMercadoLivre.update({
                where: { id: produtoML.id },
                data: {
                  mlAvailableQuantity: computedStock,
                  lastSyncAt: new Date(),
                  mlUltimoEnvioEstoqueEm: new Date(),
                  syncStatus: "synced",
                  syncError: null,
                },
              });

              updatedItems++;
            } else {
              errors.push(`Erro ao atualizar estoque do produto ${produtoML.mlTitle}`);

              // Marcar erro no banco
              await prisma.produtoMercadoLivre.update({
                where: { id: produtoML.id },
                data: {
                  syncStatus: "error",
                  syncError: "Erro na atualização de estoque",
                },
              });
            }
          } else {
            // Apenas atualizar timestamp de sincronização
            await prisma.produtoMercadoLivre.update({
              where: { id: produtoML.id },
              data: {
                lastSyncAt: new Date(),
                syncStatus: "synced",
              },
            });
          }

          syncedItems++;

        } catch (itemError) {
          console.error(`[AUTO_SYNC] Erro ao processar ${produtoML.mlItemId}:`, itemError);
          errors.push(`Erro ao processar produto ${produtoML.mlTitle}: ${itemError}`);

          // Marcar erro no banco
          await prisma.produtoMercadoLivre.update({
            where: { id: produtoML.id },
            data: {
              syncStatus: "error",
              syncError: itemError instanceof Error ? itemError.message : "Erro desconhecido",
            },
          });
        }
      }

      // Salvar histórico de sincronização
      await prisma.mercadoLivreSyncHistory.create({
        data: {
          mercadoLivreAccountId: accountId,
          syncType: syncAll ? "auto_full" : "auto_smart",
          status: errors.length === 0 ? "success" : errors.length < syncedItems ? "partial" : "error",
          totalItems: produtosML.length,
          syncedItems,
          newItems: 0,
          updatedItems,
          errorItems: errors.length,
          errors: errors,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });


      return NextResponse.json({
        success: true,
        syncedItems,
        updatedItems,
        totalProcessed: produtosML.length,
        errors,
        summary: `Sincronização automática concluída: ${updatedItems} produtos atualizados de ${produtosML.length} verificados.`,
      });

    } catch (mlError) {
      console.error("Erro na sincronização automática:", mlError);
      return NextResponse.json(
        { error: "Erro ao conectar com Mercado Livre" },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error("Erro na API de sincronização automática:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// Endpoint GET para verificar status de sincronização automática
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

    // Verificar se a conta pertence ao usuário
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.contaId,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta do Mercado Livre não encontrada" },
        { status: 404 }
      );
    }

    // Buscar produtos que precisam de sincronização
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const [
      totalProducts,
      needsSync,
      errorProducts,
      lastSync
    ] = await Promise.all([
      // Total de produtos vinculados ativos
      prisma.produtoMercadoLivre.count({
        where: {
          mercadoLivreAccountId: accountId,
          produtoId: { not: { equals: null } },
          mlStatus: "active",
        },
      }),

      // Produtos que precisam de sincronização
      prisma.produtoMercadoLivre.count({
        where: {
          mercadoLivreAccountId: accountId,
          produtoId: { not: { equals: null } },
          mlStatus: "active",
          OR: [
            { lastSyncAt: { lt: oneHourAgo } },
            { syncStatus: "pending" },
            { syncStatus: "error" },
          ],
        },
      }),

      // Produtos com erro
      prisma.produtoMercadoLivre.count({
        where: {
          mercadoLivreAccountId: accountId,
          syncStatus: "error",
        },
      }),

      // Última sincronização automática
      prisma.mercadoLivreSyncHistory.findFirst({
        where: {
          mercadoLivreAccountId: accountId,
          syncType: { in: ["auto_full", "auto_smart"] },
        },
        orderBy: { startedAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      totalProducts,
      needsSync,
      errorProducts,
      healthy: totalProducts - needsSync - errorProducts,
      syncHealthPercentage: totalProducts > 0 ?
        Math.round(((totalProducts - needsSync - errorProducts) / totalProducts) * 100) : 100,
      lastAutoSync: lastSync?.startedAt?.toISOString(),
      lastSyncStatus: lastSync?.status,
      recommendations: generateSyncRecommendations(needsSync, errorProducts, totalProducts),
    });

  } catch (error) {
    console.error("Erro ao verificar status de sincronização:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function generateSyncRecommendations(needsSync: number, errorProducts: number, totalProducts: number): string[] {
  const recommendations = [];

  if (needsSync > totalProducts * 0.3) {
    recommendations.push("Muitos produtos desatualizados - execute sincronização completa");
  } else if (needsSync > 0) {
    recommendations.push("Execute sincronização inteligente para atualizar produtos pendentes");
  }

  if (errorProducts > 0) {
    recommendations.push(`${errorProducts} produto(s) com erro - verifique a conectividade`);
  }

  if (totalProducts > 0 && needsSync === 0 && errorProducts === 0) {
    recommendations.push("Todos os produtos estão sincronizados");
  }

  return recommendations;
}