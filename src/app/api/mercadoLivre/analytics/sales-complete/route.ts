import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { withCache, createCacheKey } from "@/lib/cache";

interface SalesProduct {
  mlItemId: string;
  productName: string;
  sku: string;
  totalSales: number;
  totalRevenue: number;
  averagePrice: number;
  lastSaleDate: string;
  salesCount: number; // número de pedidos diferentes
}

interface SalesAnalytics {
  period: {
    startDate: string;
    endDate: string;
    days: number;
  };
  summary: {
    totalOrders: number;
    totalItems: number;
    totalRevenue: number;
    averageTicket: number;
    averageItemsPerOrder: number;
    conversionRate?: number;
  };
  trends: {
    dailyRevenue: Array<{
      date: string;
      revenue: number;
      orders: number;
      items: number;
    }>;
    topProducts: SalesProduct[];
    salesByHour: Array<{
      hour: number;
      count: number;
      revenue: number;
    }>;
  };
  comparison?: {
    previousPeriod: {
      totalRevenue: number;
      totalOrders: number;
      totalItems: number;
      averageTicket: number;
    };
    growth: {
      revenueGrowth: number;
      ordersGrowth: number;
      itemsGrowth: number;
      ticketGrowth: number;
    };
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const period = parseInt(searchParams.get("period") || "30");
    const includeComparison = searchParams.get("comparison") === "true";

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

      // Definir datas do período
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - period * 24 * 60 * 60 * 1000);

      // Buscar dados com cache
      const cacheKey = createCacheKey("sales-complete", accountId, period.toString());

      const analytics = await withCache(
        cacheKey,
        async (): Promise<SalesAnalytics> => {
          console.log(`[SALES_COMPLETE] Buscando vendas de ${startDate.toISOString()} até ${endDate.toISOString()}`);

          // Buscar pedidos do período - começar com mais pedidos
          let allOrders: any[] = [];
          let offset = 0;
          const limit = 50;
          let hasMore = true;

          // Buscar até 500 pedidos para análise completa
          while (hasMore && offset < 500) {
            try {
              const ordersResponse = await MercadoLivreService.getUserOrders(accessToken, {
                seller: account.mlUserId,
                offset,
                limit,
                sort: "date_desc",
              });

              if (ordersResponse.results && ordersResponse.results.length > 0) {
                allOrders = allOrders.concat(ordersResponse.results);
                offset += limit;
                hasMore = ordersResponse.results.length === limit;
              } else {
                hasMore = false;
              }
            } catch (error) {
              console.warn(`[SALES_COMPLETE] Erro ao buscar pedidos offset ${offset}:`, error);
              hasMore = false;
            }
          }

          console.log(`[SALES_COMPLETE] Total de pedidos obtidos: ${allOrders.length}`);

          // Filtrar pedidos do período e com status válido
          const validStatuses = ["paid", "delivered", "ready_to_ship", "shipped", "handling"];
          const periodOrders = allOrders.filter(order => {
            const orderDate = new Date(order.date_created);
            return orderDate >= startDate &&
                   orderDate <= endDate &&
                   validStatuses.includes(order.status);
          });

          console.log(`[SALES_COMPLETE] Pedidos válidos no período: ${periodOrders.length}`);

          // Processar vendas
          const productSales = new Map<string, SalesProduct>();
          const dailyData = new Map<string, { revenue: number; orders: number; items: number }>();
          const hourlyData = new Map<number, { count: number; revenue: number }>();

          let totalRevenue = 0;
          let totalItems = 0;
          let totalOrders = periodOrders.length;

          periodOrders.forEach(order => {
            const orderDate = new Date(order.date_created);
            const dayKey = orderDate.toISOString().split('T')[0];
            const hour = orderDate.getHours();

            let orderRevenue = 0;
            let orderItems = 0;

            order.order_items.forEach((item: any) => {
              const itemRevenue = item.unit_price * item.quantity;
              const itemCount = item.quantity;

              // Acumular totais
              totalRevenue += itemRevenue;
              totalItems += itemCount;
              orderRevenue += itemRevenue;
              orderItems += itemCount;

              // Dados por produto
              const existing = productSales.get(item.item.id);
              if (existing) {
                existing.totalSales += itemCount;
                existing.totalRevenue += itemRevenue;
                existing.salesCount += 1;
                existing.averagePrice = existing.totalRevenue / existing.totalSales;
                if (orderDate.toISOString() > existing.lastSaleDate) {
                  existing.lastSaleDate = orderDate.toISOString();
                }
              } else {
                productSales.set(item.item.id, {
                  mlItemId: item.item.id,
                  productName: item.item.title,
                  sku: item.item.seller_sku || "N/A",
                  totalSales: itemCount,
                  totalRevenue: itemRevenue,
                  averagePrice: item.unit_price,
                  lastSaleDate: orderDate.toISOString(),
                  salesCount: 1,
                });
              }
            });

            // Dados diários
            const existing = dailyData.get(dayKey);
            if (existing) {
              existing.revenue += orderRevenue;
              existing.orders += 1;
              existing.items += orderItems;
            } else {
              dailyData.set(dayKey, {
                revenue: orderRevenue,
                orders: 1,
                items: orderItems,
              });
            }

            // Dados por hora
            const hourlyExisting = hourlyData.get(hour);
            if (hourlyExisting) {
              hourlyExisting.count += 1;
              hourlyExisting.revenue += orderRevenue;
            } else {
              hourlyData.set(hour, {
                count: 1,
                revenue: orderRevenue,
              });
            }
          });

          // Preparar dados diários ordenados
          const dailyRevenue = Array.from(dailyData.entries())
            .map(([date, data]) => ({
              date,
              revenue: data.revenue,
              orders: data.orders,
              items: data.items,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          // Top produtos ordenados por receita
          const topProducts = Array.from(productSales.values())
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 20);

          // Dados por hora ordenados
          const salesByHour = Array.from(hourlyData.entries())
            .map(([hour, data]) => ({
              hour,
              count: data.count,
              revenue: data.revenue,
            }))
            .sort((a, b) => a.hour - b.hour);

          const analytics: SalesAnalytics = {
            period: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              days: period,
            },
            summary: {
              totalOrders,
              totalItems,
              totalRevenue,
              averageTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
              averageItemsPerOrder: totalOrders > 0 ? totalItems / totalOrders : 0,
            },
            trends: {
              dailyRevenue,
              topProducts,
              salesByHour,
            },
          };

          console.log(`[SALES_COMPLETE] Análise concluída: ${totalOrders} pedidos, ${totalItems} itens, R$ ${totalRevenue.toFixed(2)}`);

          return analytics;
        },
        "300" // Cache por 5 minutos
      );

      // Buscar dados de comparação se solicitado
      if (includeComparison) {
        const prevStartDate = new Date(startDate.getTime() - period * 24 * 60 * 60 * 1000);
        const prevEndDate = startDate;

        const prevCacheKey = createCacheKey("sales-complete-prev", accountId, period.toString());

        const previousPeriodData = await withCache(
          prevCacheKey,
          async () => {
            console.log(`[SALES_COMPLETE] Buscando dados do período anterior: ${prevStartDate.toISOString()} até ${prevEndDate.toISOString()}`);

            let allPrevOrders: any[] = [];
            let offset = 0;
            const limit = 50;
            let hasMore = true;

            while (hasMore && offset < 300) {
              try {
                const ordersResponse = await MercadoLivreService.getUserOrders(accessToken, {
                  seller: account.mlUserId,
                  offset,
                  limit,
                  sort: "date_desc",
                });

                if (ordersResponse.results && ordersResponse.results.length > 0) {
                  allPrevOrders = allPrevOrders.concat(ordersResponse.results);
                  offset += limit;
                  hasMore = ordersResponse.results.length === limit;
                } else {
                  hasMore = false;
                }
              } catch (error) {
                console.warn(`[SALES_COMPLETE] Erro ao buscar pedidos anteriores offset ${offset}:`, error);
                hasMore = false;
              }
            }

            // Filtrar pedidos do período anterior
            const validStatuses = ["paid", "delivered", "ready_to_ship", "shipped", "handling"];
            const prevPeriodOrders = allPrevOrders.filter(order => {
              const orderDate = new Date(order.date_created);
              return orderDate >= prevStartDate &&
                     orderDate <= prevEndDate &&
                     validStatuses.includes(order.status);
            });

            let prevRevenue = 0;
            let prevItems = 0;
            const prevOrders = prevPeriodOrders.length;

            prevPeriodOrders.forEach(order => {
              order.order_items.forEach((item: any) => {
                prevRevenue += item.unit_price * item.quantity;
                prevItems += item.quantity;
              });
            });

            return {
              totalRevenue: prevRevenue,
              totalOrders: prevOrders,
              totalItems: prevItems,
              averageTicket: prevOrders > 0 ? prevRevenue / prevOrders : 0,
            };
          },
          "600" // Cache por 10 minutos
        );

        // Calcular crescimento
        analytics.comparison = {
          previousPeriod: previousPeriodData,
          growth: {
            revenueGrowth: previousPeriodData.totalRevenue > 0
              ? ((analytics.summary.totalRevenue - previousPeriodData.totalRevenue) / previousPeriodData.totalRevenue) * 100
              : 0,
            ordersGrowth: previousPeriodData.totalOrders > 0
              ? ((analytics.summary.totalOrders - previousPeriodData.totalOrders) / previousPeriodData.totalOrders) * 100
              : 0,
            itemsGrowth: previousPeriodData.totalItems > 0
              ? ((analytics.summary.totalItems - previousPeriodData.totalItems) / previousPeriodData.totalItems) * 100
              : 0,
            ticketGrowth: previousPeriodData.averageTicket > 0
              ? ((analytics.summary.averageTicket - previousPeriodData.averageTicket) / previousPeriodData.averageTicket) * 100
              : 0,
          },
        };
      }

      return NextResponse.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      });

    } catch (mlError) {
      console.error("[SALES_COMPLETE] Erro ao conectar com ML:", mlError);
      return NextResponse.json(
        {
          success: false,
          error: "Erro ao conectar com Mercado Livre",
          details: mlError instanceof Error ? mlError.message : "Erro desconhecido",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[SALES_COMPLETE] Erro na API:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}