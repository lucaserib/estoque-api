import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { MLOrder } from "@/types/mercadolivre";

/**
 * GET /api/produtos/vendas-ml
 * Calcula vendas dos últimos 90 dias por produto do Mercado Livre
 */
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

    console.log(
      `[VENDAS_ML] Buscando vendas de ${startDate.toLocaleDateString(
        "pt-BR"
      )} até ${endDate.toLocaleDateString("pt-BR")} (${diasPeriodo} dias)`
    );

    // Buscar pedidos do ML
    const allOrders: MLOrder[] = [];
    let offset = 0;
    const maxPages = 20;

    const validStatuses = [
      "paid",
      "delivered",
      "ready_to_ship",
      "shipped",
      "handling",
      "confirmed",
    ];

    for (let page = 0; page < maxPages; page++) {
      try {
        const orders = await MercadoLivreService.getUserOrders(accessToken, {
          seller: mlAccount.mlUserId,
          offset,
          limit: 50,
          sort: "date_desc",
        });

        if (!orders.results || orders.results.length === 0) {
          break;
        }

        const validOrders = orders.results.filter(
          (order: MLOrder) =>
            validStatuses.includes(order.status) &&
            new Date(order.date_created) >= startDate &&
            new Date(order.date_created) <= endDate
        );

        allOrders.push(...validOrders);
        offset += 50;

        // Se a data do último pedido é anterior ao período, parar
        const lastOrder = orders.results[orders.results.length - 1];
        if (
          lastOrder &&
          new Date(lastOrder.date_created) < startDate
        ) {
          console.log(
            `[VENDAS_ML] Último pedido fora do período, finalizando busca`
          );
          break;
        }
      } catch (pageError) {
        console.error(`[VENDAS_ML] Erro na página ${page + 1}:`, pageError);
        break;
      }
    }

    console.log(`[VENDAS_ML] Total de pedidos encontrados: ${allOrders.length}`);

    // Agrupar vendas por produto
    const vendasPorProduto: { [key: string]: number } = {};

    for (const order of allOrders) {
      if (order.order_items) {
        for (const item of order.order_items) {
          const mlItemId = item.item.id;
          const quantity = item.quantity;

          // Buscar produto local vinculado
          const produtoML = await prisma.produtoMercadoLivre.findFirst({
            where: {
              mlItemId,
              mercadoLivreAccountId: mlAccount.id,
            },
            select: {
              produtoId: true,
            },
          });

          if (produtoML?.produtoId) {
            vendasPorProduto[produtoML.produtoId] =
              (vendasPorProduto[produtoML.produtoId] || 0) + quantity;
          }
        }
      }
    }

    console.log(
      `[VENDAS_ML] Produtos com vendas: ${Object.keys(vendasPorProduto).length}`
    );

    // Buscar estoque Full ATUAL direto da API do ML (tempo real)
    console.log(`[VENDAS_ML] Buscando estoque Full em tempo real da API do ML...`);
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

    console.log(
      `[VENDAS_ML] Verificando ${produtosMLVinculados.length} produtos vinculados...`
    );

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

          console.log(
            `[VENDAS_ML] ✅ Full: ${produtoML.mlItemId} - ${item.available_quantity} unidades`
          );
        }
      } catch (itemError) {
        console.error(
          `[VENDAS_ML] Erro ao buscar item ${produtoML.mlItemId}:`,
          itemError
        );
      }
    }

    console.log(
      `[VENDAS_ML] Produtos com estoque Full: ${
        Object.keys(estoqueFullPorProduto).length
      }`
    );

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
      vendasPorProduto,
      estoqueFullPorProduto,
    });
  } catch (error) {
    console.error("Erro ao buscar vendas ML:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao buscar vendas do Mercado Livre",
      },
      { status: 500 }
    );
  }
}
