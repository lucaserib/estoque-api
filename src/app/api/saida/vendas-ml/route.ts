// src/app/api/saida/vendas-ml/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchAllOrdersOrThrow, PartialOrdersError } from "@/lib/mlOrders";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);

    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");


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

    const allOrders = await fetchAllOrdersOrThrow({
      accessToken,
      sellerId: mlAccount.mlUserId,
    });

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
        payments: (
          order.payments as { payment_type_id: string; status: string }[] | undefined
        )?.map((p) => ({
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


    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof PartialOrdersError) {
      return NextResponse.json(
        {
          code: error.code,
          error:
            "Não foi possível carregar todos os pedidos do Mercado Livre. Tente novamente em instantes.",
          vendas: [],
          total: 0,
          totalItems: 0,
          totalRevenue: 0,
        },
        { status: 503 }
      );
    }

    console.error("[VENDAS_ML_SAIDA] Erro ao buscar vendas:", error);

    return NextResponse.json(
      {
        error: "Erro ao buscar vendas do Mercado Livre",
        vendas: [],
        total: 0,
        totalItems: 0,
        totalRevenue: 0,
      },
      { status: 500 }
    );
  }
}
