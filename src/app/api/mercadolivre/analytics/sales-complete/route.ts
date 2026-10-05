import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { withCache, createCacheKey } from "@/lib/cache";
import { fetchOrdersWithFallback, PartialOrdersError } from "@/lib/mlOrders";

interface SalesProduct {
  mlItemId: string;
  productName: string;
  sku: string;
  totalSales: number;
  totalRevenue: number;
  averagePrice: number;
  lastSaleDate: string;
  salesCount: number;
  saleFees: number;
  custoMedio?: number | null;
  estimatedProfit?: number | null;
}

interface CancelledOrder {
  orderId: string;
  date_created: string;
  total_amount: number;
  items_count: number;
  buyer_nickname: string;
  cancellation_reason?: string;
}

interface CancelledProduct {
  mlItemId: string;
  productName: string;
  sku: string;
  totalCancelled: number;
  totalCancelledRevenue: number;
  cancellationCount: number;
  cancellationRate: number;
  lastCancellationDate: string;
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
    totalProductRevenue: number;
    totalShippingRevenue: number;
    averageTicket: number;
    averageItemsPerOrder: number;
    totalSaleFees: number;
    netRevenue: number;
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
    salesByDayBlock: Array<{
      day: number;
      block: number;
      count: number;
    }>;
    soldItemIds: string[];
  };
  cancelled: {
    totalCancelledOrders: number;
    totalCancelledItems: number;
    totalCancelledRevenue: number;
    cancellationRate: number;
    orders: CancelledOrder[];
    topCancelledProducts: CancelledProduct[];
  };
  skusWithoutSales?: {
    count: number;
    items: Array<{ mlItemId: string; title: string }>;
  };
  parcial: boolean;
  pedidosFaltantes: number;
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
    const customStartDate = searchParams.get("startDate");
    const customEndDate = searchParams.get("endDate");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

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

      let startDate: Date;
      let endDate: Date;
      let actualPeriod: number;

      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        actualPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        endDate = new Date();
        startDate = new Date(endDate.getTime() - period * 24 * 60 * 60 * 1000);
        actualPeriod = period;
      }

      const cacheKeySuffix = customStartDate && customEndDate 
        ? `${customStartDate}-${customEndDate}`
        : actualPeriod.toString();
      
      const cacheKey = createCacheKey(
        "sales-complete-v2",
        accountId,
        cacheKeySuffix
      );

      const analytics = await withCache(
        cacheKey,
        async (): Promise<SalesAnalytics> => {
          const { orders: allOrders, parcial, pedidosFaltantes } =
            await fetchOrdersWithFallback({
              accessToken,
              sellerId: account.mlUserId,
              dateFrom: startDate,
              dateTo: endDate,
            });

          const validStatuses = [
            "paid",
            "delivered",
            "ready_to_ship",
            "shipped",
            "handling",
          ];
          
          const excludedStatuses = [
            "cancelled",
            "invalid",
            "refunded",
            "payment_rejected",
            "pending",
            "returned",
          ];
          
          const periodOrders = allOrders.filter((order) => {
            const orderDate = new Date(order.date_created);
            return (
              orderDate >= startDate &&
              orderDate <= endDate &&
              validStatuses.includes(order.status) &&
              !excludedStatuses.includes(order.status)
            );
          });

          const cancelledOrders = allOrders.filter((order) => {
            const orderDate = new Date(order.date_created);
            return (
              orderDate >= startDate &&
              orderDate <= endDate &&
              excludedStatuses.includes(order.status)
            );
          });


          const productSales = new Map<string, SalesProduct>();
          const dailyData = new Map<
            string,
            { revenue: number; orders: number; items: number }
          >();
          const hourlyData = new Map<
            number,
            { count: number; revenue: number }
          >();
          const dayBlockData = new Map<string, number>();

          let totalRevenue = 0;
          let totalProductRevenue = 0;
          let totalSaleFees = 0;
          let totalItems = 0;
          const totalOrders = periodOrders.length;

          periodOrders.forEach((order) => {
            const orderDate = new Date(order.date_created);
            const dayKey = orderDate.toISOString().split("T")[0];
            const hour = orderDate.getHours();

            let orderProductRevenue = 0;
            let orderItems = 0;

            order.order_items.forEach((item: { unit_price: number; quantity: number; sale_fee?: number; item: { id: string; title: string; seller_sku?: string } }) => {
              const itemRevenue = item.unit_price * item.quantity;
              const itemCount = item.quantity;
              const itemFees = (item.sale_fee || 0) * item.quantity;

              orderProductRevenue += itemRevenue;
              totalSaleFees += itemFees;
              totalItems += itemCount;
              orderItems += itemCount;

              const existing = productSales.get(item.item.id);
              if (existing) {
                existing.totalSales += itemCount;
                existing.totalRevenue += itemRevenue;
                existing.saleFees += itemFees;
                existing.salesCount += 1;
                existing.averagePrice =
                  existing.totalRevenue / existing.totalSales;
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
                  saleFees: itemFees,
                });
              }
            });

            const orderTotalAmount = order.total_amount || 0;
            const orderShippingCost = orderTotalAmount - orderProductRevenue;
            
            totalRevenue += orderTotalAmount;
            totalProductRevenue += orderProductRevenue;

            const existing = dailyData.get(dayKey);
            if (existing) {
              existing.revenue += orderTotalAmount;
              existing.orders += 1;
              existing.items += orderItems;
            } else {
              dailyData.set(dayKey, {
                revenue: orderTotalAmount,
                orders: 1,
                items: orderItems,
              });
            }

            const dayOfWeek = orderDate.getDay();
            const block = Math.floor(hour / 4);
            const dayBlockKey = `${dayOfWeek}-${block}`;
            dayBlockData.set(
              dayBlockKey,
              (dayBlockData.get(dayBlockKey) || 0) + 1
            );

            const hourlyExisting = hourlyData.get(hour);
            if (hourlyExisting) {
              hourlyExisting.count += 1;
              hourlyExisting.revenue += orderTotalAmount;
            } else {
              hourlyData.set(hour, {
                count: 1,
                revenue: orderTotalAmount,
              });
            }
          });

          const totalShippingRevenue = totalRevenue - totalProductRevenue;

          const dailyRevenue = Array.from(dailyData.entries())
            .map(([date, data]) => ({
              date,
              revenue: data.revenue,
              orders: data.orders,
              items: data.items,
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

          const topProducts = Array.from(productSales.values())
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 20);

          const salesByDayBlock = Array.from(dayBlockData.entries()).map(
            ([key, count]) => {
              const [day, block] = key.split("-").map(Number);
              return { day, block, count };
            }
          );

          const salesByHour = Array.from(hourlyData.entries())
            .map(([hour, data]) => ({
              hour,
              count: data.count,
              revenue: data.revenue,
            }))
            .sort((a, b) => a.hour - b.hour);

          let totalCancelledRevenue = 0;
          let totalCancelledItems = 0;
          const cancelledOrdersData: CancelledOrder[] = [];
          const cancelledProductsMap = new Map<string, {
            mlItemId: string;
            productName: string;
            sku: string;
            totalCancelled: number;
            totalCancelledRevenue: number;
            cancellationCount: number;
            lastCancellationDate: string;
          }>();

          cancelledOrders.forEach((order) => {
            const orderRevenue = order.total_amount || 0;
            let orderItems = 0;
            const orderDate = new Date(order.date_created);

            order.order_items.forEach((item: { unit_price: number; quantity: number; item: { id: string; title: string; seller_sku?: string } }) => {
              const itemQuantity = item.quantity;
              const itemRevenue = item.unit_price * item.quantity;
              orderItems += itemQuantity;

              const existing = cancelledProductsMap.get(item.item.id);
              if (existing) {
                existing.totalCancelled += itemQuantity;
                existing.totalCancelledRevenue += itemRevenue;
                existing.cancellationCount += 1;
                if (orderDate.toISOString() > existing.lastCancellationDate) {
                  existing.lastCancellationDate = orderDate.toISOString();
                }
              } else {
                cancelledProductsMap.set(item.item.id, {
                  mlItemId: item.item.id,
                  productName: item.item.title,
                  sku: item.item.seller_sku || "N/A",
                  totalCancelled: itemQuantity,
                  totalCancelledRevenue: itemRevenue,
                  cancellationCount: 1,
                  lastCancellationDate: orderDate.toISOString(),
                });
              }
            });

            totalCancelledRevenue += orderRevenue;
            totalCancelledItems += orderItems;

            cancelledOrdersData.push({
              orderId: order.id.toString(),
              date_created: order.date_created,
              total_amount: orderRevenue,
              items_count: orderItems,
              buyer_nickname: (order.buyer as { nickname?: string })?.nickname || "N/A",
              cancellation_reason:
                (order.status_detail as { description?: string })?.description ||
                (order.status_detail as string) ||
                order.status,
            });
          });

          const cancelledProductsList = Array.from(cancelledProductsMap.values())
            .map(product => {
              const salesData = productSales.get(product.mlItemId);
              const totalSold = salesData?.totalSales || 0;
              const totalWithCancelled = totalSold + product.totalCancelled;
              const cancellationRate = totalWithCancelled > 0
                ? (product.totalCancelled / totalWithCancelled) * 100
                : 100;

              return {
                ...product,
                cancellationRate,
              };
            })
            .sort((a, b) => b.totalCancelled - a.totalCancelled)
            .slice(0, 20);

          const totalOrdersIncludingCancelled =
            periodOrders.length + cancelledOrders.length;
          const cancellationRate =
            totalOrdersIncludingCancelled > 0
              ? (cancelledOrders.length / totalOrdersIncludingCancelled) * 100
              : 0;

          const analytics: SalesAnalytics = {
            period: {
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              days: actualPeriod,
            },
            summary: {
              totalOrders,
              totalItems,
              totalRevenue,
              totalProductRevenue,
              totalShippingRevenue,
              averageTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
              averageItemsPerOrder:
                totalOrders > 0 ? totalItems / totalOrders : 0,
              totalSaleFees,
              netRevenue: totalProductRevenue - totalSaleFees,
            },
            trends: {
              dailyRevenue,
              topProducts,
              salesByHour,
              salesByDayBlock,
              soldItemIds: Array.from(productSales.keys()),
            },
            cancelled: {
              totalCancelledOrders: cancelledOrders.length,
              totalCancelledItems,
              totalCancelledRevenue,
              cancellationRate,
              orders: cancelledOrdersData.slice(0, 50),
              topCancelledProducts: cancelledProductsList,
            },
            parcial,
            pedidosFaltantes,
          };

          return analytics;
        },
        "sales"
      );

      if (includeComparison) {
        const prevStartDate = new Date(
          startDate.getTime() - actualPeriod * 24 * 60 * 60 * 1000
        );
        const prevEndDate = startDate;

        const prevCacheKey = createCacheKey(
          "sales-complete-prev",
          accountId,
          `${prevStartDate.toISOString()}-${prevEndDate.toISOString()}`
        );

        const previousPeriodData = await withCache(
          prevCacheKey,
          async () => {
            const { orders: allPrevOrders } = await fetchOrdersWithFallback({
              accessToken,
              sellerId: account.mlUserId,
              dateFrom: prevStartDate,
              dateTo: prevEndDate,
            });

            const validStatuses = [
              "paid",
              "delivered",
              "ready_to_ship",
              "shipped",
              "handling",
            ];
            
            const excludedStatuses = [
              "cancelled",
              "invalid",
              "refunded",
              "payment_rejected",
              "pending",
              "returned",
            ];
            
            const prevPeriodOrders = allPrevOrders.filter((order) => {
              const orderDate = new Date(order.date_created);
              return (
                orderDate >= prevStartDate &&
                orderDate <= prevEndDate &&
                validStatuses.includes(order.status) &&
                !excludedStatuses.includes(order.status)
              );
            });

            let prevRevenue = 0;
            let prevProductRevenue = 0;
            let prevItems = 0;
            const prevOrders = prevPeriodOrders.length;

            prevPeriodOrders.forEach((order) => {
              let orderProductRevenue = 0;
              
              order.order_items.forEach((item: { unit_price: number; quantity: number; item: { id: string; title: string; seller_sku?: string } }) => {
                prevItems += item.quantity;
                orderProductRevenue += item.unit_price * item.quantity;
              });
              
              const orderTotal = order.total_amount || 0;
              prevRevenue += orderTotal;
              prevProductRevenue += orderProductRevenue;
            });

            const prevShippingRevenue = prevRevenue - prevProductRevenue;

            return {
              totalRevenue: prevRevenue,
              totalProductRevenue: prevProductRevenue,
              totalShippingRevenue: prevShippingRevenue,
              totalOrders: prevOrders,
              totalItems: prevItems,
              averageTicket: prevOrders > 0 ? prevRevenue / prevOrders : 0,
            };
          },
          "sales"
        );

        analytics.comparison = {
          previousPeriod: previousPeriodData,
          growth: {
            revenueGrowth:
              previousPeriodData.totalRevenue > 0
                ? ((analytics.summary.totalRevenue -
                    previousPeriodData.totalRevenue) /
                    previousPeriodData.totalRevenue) *
                  100
                : 0,
            ordersGrowth:
              previousPeriodData.totalOrders > 0
                ? ((analytics.summary.totalOrders -
                    previousPeriodData.totalOrders) /
                    previousPeriodData.totalOrders) *
                  100
                : 0,
            itemsGrowth:
              previousPeriodData.totalItems > 0
                ? ((analytics.summary.totalItems -
                    previousPeriodData.totalItems) /
                    previousPeriodData.totalItems) *
                  100
                : 0,
            ticketGrowth:
              previousPeriodData.averageTicket > 0
                ? ((analytics.summary.averageTicket -
                    previousPeriodData.averageTicket) /
                    previousPeriodData.averageTicket) *
                  100
                : 0,
          },
        };
      }

      const soldIds = new Set(analytics.trends.soldItemIds);

      const [vinculados, semVenda] = await Promise.all([
        prisma.produtoMercadoLivre.findMany({
          where: {
            mercadoLivreAccountId: accountId,
            mlItemId: { in: analytics.trends.topProducts.map((p) => p.mlItemId) },
          },
          select: {
            mlItemId: true,
            produto: { select: { custoMedio: true } },
          },
        }),
        prisma.produtoMercadoLivre.findMany({
          where: {
            mercadoLivreAccountId: accountId,
            mlStatus: "active",
          },
          select: { mlItemId: true, mlTitle: true },
        }),
      ]);

      const custoPorItem = new Map(
        vinculados.map((v) => [v.mlItemId, v.produto?.custoMedio ?? null])
      );

      analytics.trends.topProducts = analytics.trends.topProducts.map(
        (product) => {
          const custoMedio = custoPorItem.get(product.mlItemId) ?? null;
          const custoEmReais =
            custoMedio !== null ? custoMedio / 100 : null;
          return {
            ...product,
            custoMedio: custoEmReais,
            estimatedProfit:
              custoEmReais !== null && custoEmReais > 0
                ? product.totalRevenue -
                  product.saleFees -
                  custoEmReais * product.totalSales
                : null,
          };
        }
      );

      const naoVendidos = semVenda.filter(
        (item) => !soldIds.has(item.mlItemId)
      );
      analytics.skusWithoutSales = {
        count: naoVendidos.length,
        items: naoVendidos
          .slice(0, 50)
          .map((item) => ({ mlItemId: item.mlItemId, title: item.mlTitle })),
      };

      return NextResponse.json({
        success: true,
        data: analytics,
        timestamp: new Date().toISOString(),
      });
    } catch (mlError) {
      if (mlError instanceof PartialOrdersError) {
        throw mlError;
      }

      console.error("[SALES_COMPLETE] Erro ao conectar com ML:", mlError);
      return NextResponse.json(
        {
          success: false,
          error: "Erro ao conectar com Mercado Livre",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    if (error instanceof PartialOrdersError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error:
            "Não foi possível carregar os pedidos do Mercado Livre. Tente novamente em instantes.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Erro interno do servidor",
      },
      { status: 500 }
    );
  }
}
