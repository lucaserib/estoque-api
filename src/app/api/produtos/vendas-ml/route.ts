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

    console.log(
      `[VENDAS_ML] Anúncios ML com vendas nos últimos 90 dias: ${Object.keys(vendasPorAnuncio).length}`
    );

    // Log detalhado das vendas por anúncio
    Object.entries(vendasPorAnuncio).forEach(([mlItemId, quantidade]) => {
      console.log(`[VENDAS_ML] Anúncio ${mlItemId}: ${quantidade} unidades vendidas (90 dias)`);
    });

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

    // Atualizar mlSold90Days no banco POR ANÚNCIO (mlItemId)
    // IMPORTANTE: Cada anúncio tem suas próprias vendas!
    console.log(`[VENDAS_ML] Atualizando vendas dos últimos 90 dias no banco de dados (por anúncio)...`);
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

        console.log(`[VENDAS_ML] ✅ Anúncio ${mlItemId} atualizado: ${quantidadeVendida} vendas (90d) - ${updateResult.count} registros atualizados`);
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

      console.log(`[VENDAS_ML] ✅ ${zeradosResult.count} anúncios sem vendas foram zerados`);
    } catch (zeroError) {
      console.error(`[VENDAS_ML] Erro ao zerar anúncios sem vendas:`, zeroError);
    }

    console.log(`[VENDAS_ML] ✅ Vendas atualizadas no banco de dados!`);

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
