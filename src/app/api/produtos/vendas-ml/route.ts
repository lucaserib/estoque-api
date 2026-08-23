import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchAllOrdersOrThrow, PartialOrdersError } from "@/lib/mlOrders";
import { FULL_ARMAZEM_NOME } from "@/lib/estoque";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    // Buscar conta ML ativa do usuário
    const mlAccount = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (!mlAccount) {
      return NextResponse.json(
        { error: "Conta do Mercado Livre não encontrada" },
        { status: 404 }
      );
    }

    const accessToken = await MercadoLivreService.getValidToken(mlAccount.id);

    // Definir período: últimos 90 dias
    const endDate = new Date();
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const diasPeriodo = Math.floor(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const validStatuses = [
      "paid",
      "delivered",
      "ready_to_ship",
      "shipped",
      "handling",
      "confirmed",
    ];

    const fetchedOrders = await fetchAllOrdersOrThrow({
      accessToken,
      sellerId: mlAccount.mlUserId,
    });

    const allOrders = fetchedOrders.filter(
      (order) =>
        validStatuses.includes(order.status) &&
        new Date(order.date_created) >= startDate &&
        new Date(order.date_created) <= endDate
    );


    // Agrupar vendas POR ANÚNCIO ML (mlItemId)
    // Importante: cada anúncio tem suas próprias vendas
    const vendasPorAnuncio: { [mlItemId: string]: number } = {};

    for (const order of allOrders) {
      if (order.order_items) {
        for (const item of order.order_items) {
          const mlItemId = item.item.id;
          const quantity = item.quantity;

          // Somar vendas por mlItemId (não por produtoId!)
          vendasPorAnuncio[mlItemId] =
            (vendasPorAnuncio[mlItemId] || 0) + quantity;
        }
      }
    }

    const estoqueFullPorProduto: { [key: string]: number } = {};

    const produtosMLVinculados = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: mlAccount.id,
        produtoId: { not: null },
      },
      select: {
        produtoId: true,
        mlItemId: true,
      },
    });


    // Buscar dados atualizados de cada item do ML em tempo real
    for (const produtoML of produtosMLVinculados) {
      try {
        const item = await MercadoLivreService.getItem(
          produtoML.mlItemId,
          accessToken
        );

        // Verificar se é Full (logistic_type = fulfillment)
        if (
          item.shipping?.logistic_type === "fulfillment" &&
          produtoML.produtoId
        ) {
          estoqueFullPorProduto[produtoML.produtoId] =
            (estoqueFullPorProduto[produtoML.produtoId] || 0) +
            item.available_quantity;

        }
      } catch (itemError) {
        console.error(
          `[VENDAS_ML] Erro ao buscar item ${produtoML.mlItemId}:`,
          itemError
        );
      }
    }


    const produtosComFull = Object.entries(estoqueFullPorProduto);
    if (produtosComFull.length > 0) {
      const armazemFull =
        (await prisma.armazem.findFirst({
          where: { userId: user.id, nome: FULL_ARMAZEM_NOME },
        })) ??
        (await prisma.armazem.create({
          data: { nome: FULL_ARMAZEM_NOME, userId: user.id },
        }));

      for (const [produtoId, quantidade] of produtosComFull) {
        try {
          const estoqueAtual = await prisma.estoque.findUnique({
            where: {
              produtoId_armazemId: { produtoId, armazemId: armazemFull.id },
            },
          });

          if (estoqueAtual?.quantidade === quantidade) continue;

          await prisma.$transaction([
            prisma.estoque.upsert({
              where: {
                produtoId_armazemId: {
                  produtoId,
                  armazemId: armazemFull.id,
                },
              },
              create: { produtoId, armazemId: armazemFull.id, quantidade },
              update: { quantidade },
            }),
            prisma.estoqueMovimentacao.create({
              data: {
                userId: user.id,
                produtoId,
                armazemId: armazemFull.id,
                quantidadeAnterior: estoqueAtual?.quantidade ?? 0,
                quantidadeNova: quantidade,
                origem: "SINCRONIZACAO_FULL_ML",
              },
            }),
          ]);
        } catch (fullSyncError) {
          console.error(
            `[VENDAS_ML] Erro ao sincronizar estoque Full do produto ${produtoId}:`,
            fullSyncError
          );
        }
      }
    }

    // Atualizar mlSold90Days no banco POR ANÚNCIO (mlItemId)
    // IMPORTANTE: Cada anúncio tem suas próprias vendas!
    for (const [mlItemId, quantidadeVendida] of Object.entries(vendasPorAnuncio)) {
      try {
        const updateResult = await prisma.produtoMercadoLivre.updateMany({
          where: {
            mlItemId: mlItemId, // Atualizar pelo mlItemId específico!
            mercadoLivreAccountId: mlAccount.id,
          },
          data: {
            mlSold90Days: quantidadeVendida, // IMPORTANTE: Vendas APENAS dos últimos 90 dias DESTE anúncio
          },
        });

      } catch (updateError) {
        console.error(`[VENDAS_ML] ❌ Erro ao atualizar vendas do anúncio ${mlItemId}:`, updateError);
      }
    }

    // Também zerar anúncios sem vendas (para não usar dados antigos)
    try {
      const anunciosComVendas = Object.keys(vendasPorAnuncio);
      const zeradosResult = await prisma.produtoMercadoLivre.updateMany({
        where: {
          mercadoLivreAccountId: mlAccount.id,
          mlItemId: { notIn: anunciosComVendas },
        },
        data: {
          mlSold90Days: 0,
        },
      });

    } catch (zeroError) {
      console.error(`[VENDAS_ML] Erro ao zerar anúncios sem vendas:`, zeroError);
    }


    return NextResponse.json({
      success: true,
      periodo: {
        inicio: startDate.toISOString(),
        fim: endDate.toISOString(),
        dias: diasPeriodo,
        descricao: `${startDate.toLocaleDateString(
          "pt-BR"
        )} até ${endDate.toLocaleDateString("pt-BR")}`,
      },
      totalPedidos: allOrders.length,
      vendasPorAnuncio, // Vendas por anúncio ML
      estoqueFullPorProduto,
    });
  } catch (error) {
    if (error instanceof PartialOrdersError) {
      return NextResponse.json(
        {
          code: error.code,
          error:
            "Não foi possível carregar todos os pedidos do Mercado Livre. Tente novamente em instantes.",
        },
        { status: 503 }
      );
    }

    console.error("Erro ao buscar vendas ML:", error);
    return NextResponse.json(
      { error: "Erro ao buscar vendas do Mercado Livre" },
      { status: 500 }
    );
  }
}
