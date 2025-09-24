import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { MLOrder } from "@/types/mercadolivre";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const period = searchParams.get("period") || "30"; // Padrão 30 dias

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
        { error: "Conta do Mercado Livre não encontrada" },
        { status: 404 }
      );
    }

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // Definir período de consulta
      const endDate = dateTo ? new Date(dateTo) : new Date();
      const startDate = dateFrom
        ? new Date(dateFrom)
        : new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);

      console.log(
        `[SALES_API] Buscando vendas de ${startDate.toISOString()} até ${endDate.toISOString()}`
      );

      // ✅ CORREÇÃO ROBUSTA: Implementação mais eficiente para buscar vendas
      const allOrders: MLOrder[] = [];
      let offset = 0;
      const maxPages = 20; // ✅ AUMENTO: Buscar até 1000 pedidos (20 * 50)

      // ✅ CORREÇÃO: Status mais abrangentes baseados na documentação oficial do ML
      const validStatuses = [
        "paid", // Pago
        "delivered", // Entregue
        "ready_to_ship", // Pronto para envio
        "shipped", // Enviado
        "handling", // Em preparação
        "confirmed", // Confirmado (aguardando pagamento)
      ];

      console.log(
        `[SALES_API] Iniciando busca robusta de pedidos com ${validStatuses.length} status válidos...`
      );

      for (let page = 0; page < maxPages; page++) {
        try {
          console.log(
            `[SALES_API] Buscando página ${
              page + 1
            }/${maxPages} (offset: ${offset})`
          );

          const orders = await MercadoLivreService.getUserOrders(accessToken, {
            // ✅ CORREÇÃO: Parâmetro seller é OBRIGATÓRIO para buscar pedidos do vendedor
            seller: account.mlUserId,
            offset,
            limit: 50,
            sort: "date_desc", // Mais recentes primeiro
          });

          if (!orders.results || orders.results.length === 0) {
            console.log(
              `[SALES_API] Nenhum resultado na página ${
                page + 1
              }, finalizando busca`
            );
            break;
          }

          // Filtrar apenas pedidos válidos para economizar processamento
          const validOrders = orders.results.filter((order: MLOrder) =>
            validStatuses.includes(order.status)
          );

          allOrders.push(...validOrders);
          offset += 50;

          console.log(
            `[SALES_API] Página ${page + 1}: ${
              orders.results.length
            } pedidos, ${validOrders.length} válidos`
          );

          // Se retornou menos que 50, não há mais páginas
          if (orders.results.length < 50) {
            console.log(
              `[SALES_API] Última página alcançada (${orders.results.length} < 50)`
            );
            break;
          }

          // ✅ MELHORIA: Delay inteligente baseado no número de resultados
          if (orders.results.length > 40) {
            await new Promise((resolve) => setTimeout(resolve, 200)); // Mais delay se há muitos resultados
          } else {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } catch (pageError) {
          console.error(`[SALES_API] Erro na página ${page + 1}:`, pageError);

          // ✅ TRATAMENTO ROBUSTO: Diferentes tipos de erro
          if (pageError instanceof Error) {
            if (
              pageError.message.includes("401") ||
              pageError.message.includes("Invalid OAuth")
            ) {
              console.error(`[SALES_API] Token inválido - interrompendo busca`);
              throw new Error(
                "Token de acesso inválido. Refaça a autenticação."
              );
            }

            if (
              pageError.message.includes("429") ||
              pageError.message.includes("rate limit")
            ) {
              console.warn(
                `[SALES_API] Rate limit atingido - aguardando e continuando...`
              );
              await new Promise((resolve) => setTimeout(resolve, 5000)); // 5s de delay
              continue; // Tenta novamente
            }

            if (
              pageError.message.includes("503") ||
              pageError.message.includes("502")
            ) {
              console.warn(
                `[SALES_API] Erro temporário do ML - tentando próxima página...`
              );
              continue; // Pula esta página
            }
          }

          // Para outros erros, continua mas registra
          console.warn(
            `[SALES_API] Erro na página ${page + 1}, continuando com próxima...`
          );
        }
      }

      console.log(
        `[SALES_API] Total de pedidos válidos encontrados: ${allOrders.length}`
      );

      // ✅ MELHORIA: Logging detalhado por status para debug
      const statusCount = allOrders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log(`[SALES_API] Breakdown por status:`, statusCount);

      // ✅ CORREÇÃO: Atualizar vendas baseado em pedidos PAGOS no período
      const productSalesFromOrders = new Map<string, number>();

      // ✅ CORREÇÃO: Processar pedidos com status válidos no período especificado
      const validOrderStatuses = [
        "paid",
        "delivered",
        "ready_to_ship",
        "shipped",
        "handling",
      ];
      const paidOrdersInPeriod = allOrders.filter((order) => {
        const orderDate = new Date(order.date_created);
        return (
          validOrderStatuses.includes(order.status) &&
          orderDate >= startDate &&
          orderDate <= endDate
        );
      });

      console.log(
        `[SALES_API] Processando ${paidOrdersInPeriod.length} pedidos pagos no período`
      );

      paidOrdersInPeriod.forEach((order) => {
        order.order_items.forEach((item) => {
          const itemId = item.item.id;
          const currentSold = productSalesFromOrders.get(itemId) || 0;
          productSalesFromOrders.set(itemId, currentSold + item.quantity);
        });
      });

      console.log(
        `[SALES_API] Atualizando mlSoldQuantity para ${productSalesFromOrders.size} produtos...`
      );

      // ✅ CORREÇÃO: Resetar vendas antes de atualizar com dados reais
      await prisma.produtoMercadoLivre.updateMany({
        where: {
          mercadoLivreAccountId: accountId,
        },
        data: {
          mlSoldQuantity: 0, // Reset para recalcular corretamente
        },
      });

      // Atualizar com vendas reais do período
      for (const [itemId, soldQuantity] of productSalesFromOrders) {
        try {
          await prisma.produtoMercadoLivre.updateMany({
            where: {
              mlItemId: itemId,
              mercadoLivreAccountId: accountId,
            },
            data: {
              mlSoldQuantity: soldQuantity,
            },
          });
          console.log(
            `[SALES_API] ✅ ${itemId}: ${soldQuantity} vendas atualizadas`
          );
        } catch (updateError) {
          console.error(
            `[SALES_API] ❌ Erro ao atualizar ${itemId}:`,
            updateError
          );
        }
      }

      // ✅ CORREÇÃO: Filtrar pedidos com status válidos por período especificado
      const paidOrders = allOrders.filter((order) => {
        const orderDate = new Date(order.date_created);
        return (
          validStatuses.includes(order.status) &&
          orderDate >= startDate &&
          orderDate <= endDate
        );
      });

      console.log(
        `[SALES_API] Pedidos no período ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}: ${
          paidOrders.length
        }`
      );

      // ✅ NOVO: Log detalhado dos pedidos encontrados
      if (paidOrders.length > 0) {
        const firstOrder = paidOrders[0];
        const lastOrder = paidOrders[paidOrders.length - 1];
        console.log(
          `[SALES_API] Primeiro pedido: ${firstOrder.id} (${firstOrder.date_created})`
        );
        console.log(
          `[SALES_API] Último pedido: ${lastOrder.id} (${lastOrder.date_created})`
        );

        const totalItems = paidOrders.reduce(
          (sum, order) =>
            sum +
            order.order_items.reduce(
              (itemSum, item) => itemSum + item.quantity,
              0
            ),
          0
        );
        console.log(`[SALES_API] Total de itens vendidos: ${totalItems}`);
      }

      // ✅ CORREÇÃO CRÍTICA: Calcular métricas corretamente
      let totalSales = 0; // Total de itens vendidos
      let totalRevenue = 0; // Receita total dos itens (em centavos)
      let totalOrderValue = 0; // Valor total dos pedidos (em centavos) - PARA TICKET MÉDIO

      paidOrders.forEach((order) => {
        // ✅ CORREÇÃO: Usar total_amount do pedido para ticket médio correto
        const orderTotalInCents = Math.round((order.total_amount || 0) * 100);
        totalOrderValue += orderTotalInCents;

        order.order_items.forEach((item) => {
          totalSales += item.quantity;
          // Receita dos itens (para análise de produtos)
          const itemTotal = Math.round(item.unit_price * item.quantity * 100);
          totalRevenue += itemTotal;
        });
      });

      // ✅ TICKET MÉDIO CORRETO = Valor total dos pedidos ÷ Número de pedidos
      const averageTicket =
        paidOrders.length > 0
          ? Math.round(totalOrderValue / paidOrders.length)
          : 0;

      console.log(`[SALES_API] 📊 MÉTRICAS CALCULADAS:`);
      console.log(
        `  💰 Valor total dos pedidos: R$ ${(totalOrderValue / 100).toFixed(2)}`
      );
      console.log(`  📦 Total de pedidos: ${paidOrders.length}`);
      console.log(`  🎯 Ticket médio: R$ ${(averageTicket / 100).toFixed(2)}`);
      console.log(`  📈 Total de itens: ${totalSales}`);
      console.log(
        `  💵 Receita dos itens: R$ ${(totalRevenue / 100).toFixed(2)}`
      );

      // Agrupar vendas por produto
      const productSales = new Map<
        string,
        {
          itemId: string;
          title: string;
          quantity: number;
          revenue: number;
          orders: number;
          averagePrice: number;
          originalPrice: number;
          discountPercentage: number;
        }
      >();

      paidOrders.forEach((order) => {
        order.order_items.forEach((item) => {
          const key = item.item.id;
          const existing = productSales.get(key);

          // ✅ CORREÇÃO: Calcular desconto e converter preços para centavos
          const originalPrice = item.item.price || item.unit_price;
          const finalPrice = item.unit_price;
          const discountPercentage =
            originalPrice > finalPrice
              ? ((originalPrice - finalPrice) / originalPrice) * 100
              : 0;

          // ✅ CONVERSÃO: Para centavos
          const finalPriceCents = Math.round(finalPrice * 100);
          const originalPriceCents = Math.round(originalPrice * 100);
          const revenueCents = Math.round(finalPrice * item.quantity * 100);

          if (existing) {
            existing.quantity += item.quantity;
            existing.revenue += revenueCents;
            existing.orders += 1;
            existing.averagePrice = existing.revenue / existing.quantity;
          } else {
            productSales.set(key, {
              itemId: item.item.id,
              title: item.item.title,
              quantity: item.quantity,
              revenue: revenueCents,
              orders: 1,
              averagePrice: finalPriceCents,
              originalPrice: originalPriceCents,
              discountPercentage,
            });
          }
        });
      });

      // Ordenar produtos por vendas
      const topSellingProducts = Array.from(productSales.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Agrupar vendas por dia para gráfico
      const dailySales = new Map<
        string,
        { date: string; sales: number; revenue: number; orders: number }
      >();

      paidOrders.forEach((order) => {
        const dateKey = new Date(order.date_created)
          .toISOString()
          .split("T")[0];
        const existing = dailySales.get(dateKey);

        // ✅ CORREÇÃO: Calcular receita em centavos
        const orderRevenue = order.order_items.reduce(
          (sum, item) =>
            sum + Math.round(item.unit_price * item.quantity * 100),
          0
        );

        // Calcular total de itens vendidos no pedido
        const orderItems = order.order_items.reduce(
          (sum, item) => sum + item.quantity,
          0
        );

        if (existing) {
          existing.sales += orderItems;
          existing.revenue += orderRevenue;
          existing.orders += 1;
        } else {
          dailySales.set(dateKey, {
            date: dateKey,
            sales: orderItems,
            revenue: orderRevenue,
            orders: 1,
          });
        }
      });

      const salesChart = Array.from(dailySales.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      // Calcular crescimento (comparar com período anterior)
      const previousPeriodEnd = new Date(
        startDate.getTime() - 24 * 60 * 60 * 1000
      );
      const previousPeriodStart = new Date(
        previousPeriodEnd.getTime() - (endDate.getTime() - startDate.getTime())
      );

      // ✅ CORREÇÃO: Buscar pedidos do período anterior também com paginação
      const previousOrders = await MercadoLivreService.getUserOrders(
        accessToken,
        {
          // ✅ CORREÇÃO: Parâmetro seller é OBRIGATÓRIO
          seller: account.mlUserId,
          offset: 0,
          limit: 100, // Buscar mais pedidos para comparação
          sort: "date_desc",
        }
      );

      const previousPaidOrders = previousOrders.results.filter((order) => {
        const orderDate = new Date(order.date_created);
        return (
          validStatuses.includes(order.status) &&
          orderDate >= previousPeriodStart &&
          orderDate <= previousPeriodEnd
        );
      });

      // ✅ CORREÇÃO CRÍTICA: Usar valor total dos pedidos para comparação correta
      const previousOrderValue = previousPaidOrders.reduce((sum, order) => {
        return sum + Math.round((order.total_amount || 0) * 100);
      }, 0);

      const revenueGrowth =
        previousOrderValue > 0
          ? ((totalOrderValue - previousOrderValue) / previousOrderValue) * 100
          : totalOrderValue > 0
          ? 100
          : 0; // 100% se não havia vendas antes

      console.log(`[SALES_API] 📈 CRESCIMENTO:`);
      console.log(
        `  📊 Período anterior: R$ ${(previousOrderValue / 100).toFixed(2)}`
      );
      console.log(
        `  📊 Período atual: R$ ${(totalOrderValue / 100).toFixed(2)}`
      );
      console.log(`  📈 Crescimento: ${revenueGrowth.toFixed(1)}%`);

      // Estatísticas por categoria de produto
      const categoryStats = new Map<
        string,
        { revenue: number; quantity: number }
      >();

      for (const product of topSellingProducts) {
        try {
          const itemDetails = await MercadoLivreService.getItem(
            product.itemId,
            accessToken
          );
          const categoryId = itemDetails.category_id;

          const existing = categoryStats.get(categoryId);
          if (existing) {
            existing.revenue += product.revenue;
            existing.quantity += product.quantity;
          } else {
            categoryStats.set(categoryId, {
              revenue: product.revenue,
              quantity: product.quantity,
            });
          }
        } catch (error) {
          console.warn(
            `Erro ao buscar categoria do produto ${product.itemId}:`,
            error
          );
        }
      }

      return NextResponse.json({
        period: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
          days: Math.ceil(
            (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
          ),
        },
        summary: {
          totalSales, // Total de itens vendidos
          totalRevenue: totalOrderValue, // ✅ CORREÇÃO: Usar valor real dos pedidos (com taxas, fretes, etc.)
          averageTicket, // ✅ JÁ CORRIGIDO: Agora está correto
          revenueGrowth,
          totalOrders: paidOrders.length,
        },
        topSellingProducts,
        salesChart,
        categoryBreakdown: Array.from(categoryStats.entries()).map(
          ([categoryId, stats]) => ({
            categoryId,
            revenue: stats.revenue,
            quantity: stats.quantity,
          })
        ),
        recentOrders: paidOrders.slice(0, 10).map((order) => ({
          id: order.id,
          date: order.date_created,
          total: order.total_amount,
          status: order.status,
          itemsCount: order.order_items.length,
        })),
      });
    } catch (mlError) {
      console.error("Erro ao buscar dados de vendas do ML:", mlError);

      // ✅ TRATAMENTO ROBUSTO: Resposta mais informativa baseada no tipo de erro
      let errorMessage = "Erro ao conectar com Mercado Livre";
      let shouldRetry = true;

      if (mlError instanceof Error) {
        if (mlError.message.includes("Token de acesso inválido")) {
          errorMessage =
            "Token de acesso expirado. Reconecte sua conta do Mercado Livre.";
          shouldRetry = false;
        } else if (mlError.message.includes("rate limit")) {
          errorMessage =
            "Limite de requisições atingido. Tente novamente em alguns minutos.";
        } else if (
          mlError.message.includes("502") ||
          mlError.message.includes("503")
        ) {
          errorMessage =
            "Mercado Livre temporariamente indisponível. Tente novamente em alguns minutos.";
        }
      }

      // Retornar dados parciais mesmo com erro do ML
      return NextResponse.json(
        {
          error: errorMessage,
          shouldRetry,
          summary: {
            totalSales: 0,
            totalRevenue: 0,
            averageTicket: 0,
            revenueGrowth: 0,
            totalOrders: 0,
          },
          topSellingProducts: [],
          salesChart: [],
          categoryBreakdown: [],
          recentOrders: [],
          offline: true,
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      ); // 200 com dados parciais ao invés de 502
    }
  } catch (error) {
    console.error("Erro na API de vendas ML:", error);

    // Log detalhado do erro para debugging
    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }

    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : "Unknown error"
            : undefined,
      },
      { status: 500 }
    );
  }
}
