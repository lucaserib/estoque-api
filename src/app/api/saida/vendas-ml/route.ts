// src/app/api/saida/vendas-ml/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    console.log(
      "[VENDAS_ML_SAIDA] Buscando vendas do Mercado Livre para usuário:",
      user.id
    );

    // Buscar conta ativa do Mercado Livre do usuário
    const mlAccount = await prisma.mercadoLivreAccount.findFirst({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    if (!mlAccount) {
      return NextResponse.json(
        {
          vendas: [],
          total: 0,
          totalItems: 0,
          totalRevenue: 0,
          message: "Nenhuma conta do Mercado Livre conectada",
        },
        { status: 200 }
      );
    }

    // Obter token válido
    const accessToken = await MercadoLivreService.getValidToken(mlAccount.id);

    // Definir período de busca
    const endDate = dateTo ? new Date(dateTo) : new Date();
    const startDate = dateFrom
      ? new Date(dateFrom)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 dias por padrão

    console.log(
      `[VENDAS_ML_SAIDA] Buscando vendas de ${startDate.toISOString()} até ${endDate.toISOString()}`
    );

    // Status válidos para vendas confirmadas (excluindo cancelamentos, devoluções, etc)
    const validStatuses = [
      "paid",
      "delivered",
      "ready_to_ship",
      "shipped",
      "handling",
      "confirmed",
    ];

    // Status excluídos (não devem contar como vendas)
    const excludedStatuses = [
      "cancelled",
      "invalid",
      "refunded",
      "payment_rejected",
      "pending",
      "returned",
    ];

    // Buscar pedidos do Mercado Livre
    const allOrders = [];
    let currentOffset = 0;
    const maxPages = 20; // Limite de segurança

    console.log(`[VENDAS_ML_SAIDA] Iniciando busca de pedidos...`);

    for (let page = 0; page < maxPages; page++) {
      try {
        const orders = await MercadoLivreService.getUserOrders(accessToken, {
          seller: mlAccount.mlUserId,
          offset: currentOffset,
          limit: 50,
          sort: "date_desc",
        });

        if (!orders.results || orders.results.length === 0) {
          console.log(
            `[VENDAS_ML_SAIDA] Nenhum resultado na página ${
              page + 1
            }, finalizando`
          );
          break;
        }

        console.log(
          `[VENDAS_ML_SAIDA] Página ${page + 1}: ${
            orders.results.length
          } pedidos encontrados`
        );

        // IMPORTANTE: Não filtrar por status aqui, vamos filtrar depois junto com o período
        allOrders.push(...orders.results);
        currentOffset += 50;

        if (orders.results.length < 50) {
          console.log(
            `[VENDAS_ML_SAIDA] Última página alcançada (${orders.results.length} < 50)`
          );
          break;
        }

        // Delay para evitar rate limit
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`[VENDAS_ML_SAIDA] Erro na página ${page + 1}:`, error);
        break;
      }
    }

    console.log(
      `[VENDAS_ML_SAIDA] Total de pedidos carregados: ${allOrders.length}`
    );

    // Log de exemplo de pedido para debug
    if (allOrders.length > 0) {
      const sampleOrder = allOrders[0];
      console.log(`[VENDAS_ML_SAIDA] Exemplo de pedido:`, {
        id: sampleOrder.id,
        date_created: sampleOrder.date_created,
        status: sampleOrder.status,
        total_amount: sampleOrder.total_amount,
        hasOrderItems: !!sampleOrder.order_items,
        itemsCount: sampleOrder.order_items?.length || 0,
      });
    }

    // Filtrar por período E status ao mesmo tempo
    const ordersInPeriod = allOrders.filter((order) => {
      // Verificar se a ordem tem data válida
      if (!order.date_created) {
        console.warn(`[VENDAS_ML_SAIDA] Pedido sem data: ${order.id}`);
        return false;
      }

      try {
        const orderDate = new Date(order.date_created);

        // Verificar se a data é válida
        if (isNaN(orderDate.getTime())) {
          console.warn(
            `[VENDAS_ML_SAIDA] Data inválida para pedido ${order.id}: ${order.date_created}`
          );
          return false;
        }

        const isInPeriod = orderDate >= startDate && orderDate <= endDate;

        // Se status foi especificado, filtrar por ele, caso contrário usar status válidos
        const hasValidStatus = status
          ? order.status === status
          : validStatuses.includes(order.status);

        // Sempre excluir status inválidos (cancelados, devolvidos, etc)
        const isNotExcluded = !excludedStatuses.includes(order.status);

        return isInPeriod && hasValidStatus && isNotExcluded;
      } catch (error) {
        console.error(
          `[VENDAS_ML_SAIDA] Erro ao processar data do pedido ${order.id}:`,
          error
        );
        return false;
      }
    });

    console.log(
      `[VENDAS_ML_SAIDA] Total de pedidos válidos no período: ${ordersInPeriod.length}`
    );
    console.log(
      `[VENDAS_ML_SAIDA] Período: ${startDate.toISOString()} até ${endDate.toISOString()}`
    );

    // Log dos status encontrados
    if (ordersInPeriod.length > 0) {
      const statusBreakdown = ordersInPeriod.reduce(
        (acc: Record<string, number>, order) => {
          acc[order.status] = (acc[order.status] || 0) + 1;
          return acc;
        },
        {}
      );
      console.log(`[VENDAS_ML_SAIDA] Status breakdown:`, statusBreakdown);

      // Log das primeiras e últimas datas
      const firstOrder = ordersInPeriod[0];
      const lastOrder = ordersInPeriod[ordersInPeriod.length - 1];
      console.log(
        `[VENDAS_ML_SAIDA] Primeira venda: ${firstOrder.date_created} (${firstOrder.status})`
      );
      console.log(
        `[VENDAS_ML_SAIDA] Última venda: ${lastOrder.date_created} (${lastOrder.status})`
      );
    }

    // Buscar produtos locais vinculados para obter SKUs
    const produtosML = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: mlAccount.id,
      },
      include: {
        produto: {
          select: {
            sku: true,
            nome: true,
          },
        },
      },
    });

    console.log(
      `[VENDAS_ML_SAIDA] Produtos ML vinculados: ${produtosML.length}`
    );

    // Criar mapa de mlItemId -> SKU local
    const mlItemToSku = new Map(
      produtosML.map((p) => [
        p.mlItemId,
        {
          sku: p.produto?.sku,
          nome: p.produto?.nome,
        },
      ])
    );

    // Formatar vendas para o formato da aba de saídas
    console.log(
      `[VENDAS_ML_SAIDA] Formatando ${
        ordersInPeriod.length
      } vendas (slice: ${offset} to ${offset + limit})...`
    );

    const vendas = ordersInPeriod.slice(offset, offset + limit).map((order) => {
      const items = order.order_items.map((item) => {
        const localInfo = mlItemToSku.get(item.item.id);

        return {
          id: item.item.id,
          mlItemId: item.item.id,
          title: item.item.title,
          sku: localInfo?.sku,
          nomeProdutoLocal: localInfo?.nome,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity,
          thumbnail: item.item.thumbnail,
        };
      });

      return {
        id: order.id.toString(),
        orderId: order.id.toString(),
        date_created: order.date_created,
        status: order.status,
        status_detail: order.status_detail || "",
        total_amount: order.total_amount,
        paid_amount: order.paid_amount || order.total_amount,
        currency_id: order.currency_id || "BRL",
        buyer: {
          id: order.buyer.id,
          nickname: order.buyer.nickname,
          first_name: order.buyer.first_name,
          last_name: order.buyer.last_name,
        },
        items,
        shipping: order.shipping
          ? {
              status: order.shipping.status,
              tracking_number: order.shipping.tracking_number,
            }
          : undefined,
        payments: (order.payments as any)?.map?.((p: any) => ({
          payment_type: p.payment_type_id,
          status: p.status,
        })),
      };
    });

    // Calcular métricas
    const totalItems = ordersInPeriod.reduce(
      (sum, order) =>
        sum +
        order.order_items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0
    );

    const totalRevenue = ordersInPeriod.reduce(
      (sum, order) => sum + (order.total_amount || 0),
      0
    );

    const response = {
      vendas,
      total: ordersInPeriod.length,
      totalItems,
      totalRevenue: Math.round(totalRevenue * 100), // Converter para centavos
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
      },
      mlAccount: {
        id: mlAccount.id,
        nickname: mlAccount.nickname,
        siteId: mlAccount.siteId,
      },
    };

    console.log(`[VENDAS_ML_SAIDA] Retornando resposta:`, {
      totalVendas: response.vendas.length,
      total: response.total,
      totalItems: response.totalItems,
      totalRevenue: response.totalRevenue,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[VENDAS_ML_SAIDA] Erro ao buscar vendas:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar vendas do Mercado Livre",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        vendas: [],
        total: 0,
        totalItems: 0,
        totalRevenue: 0,
      },
      { status: 500 }
    );
  }
}
