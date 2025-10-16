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
  cancellationRate: number; // % de cancelamento em relação ao total vendido
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
    totalRevenue: number; // Total incluindo frete
    totalProductRevenue: number; // Total só dos produtos
    totalShippingRevenue: number; // Total só do frete
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
  cancelled: {
    totalCancelledOrders: number;
    totalCancelledItems: number;
    totalCancelledRevenue: number;
    cancellationRate: number;
    orders: CancelledOrder[];
    topCancelledProducts: CancelledProduct[]; // Produtos com mais cancelamentos
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
    const customStartDate = searchParams.get("startDate");
    const customEndDate = searchParams.get("endDate");

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

      // Definir datas do período (usar datas customizadas se fornecidas)
      let startDate: Date;
      let endDate: Date;
      let actualPeriod: number;

      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        
        // Normalizar datas
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        
        // Calcular período em dias
        actualPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Usar período padrão
        endDate = new Date();
        startDate = new Date(endDate.getTime() - period * 24 * 60 * 60 * 1000);
        actualPeriod = period;
      }

      // Buscar dados com cache (incluir datas customizadas na chave se houver)
      const cacheKeySuffix = customStartDate && customEndDate 
        ? `${customStartDate}-${customEndDate}`
        : actualPeriod.toString();
      
      const cacheKey = createCacheKey(
        "sales-complete",
        accountId,
        cacheKeySuffix
      );

      const analytics = await withCache(
        cacheKey,
        async (): Promise<SalesAnalytics> => {
          console.log(
            `[SALES_COMPLETE] Buscando vendas de ${startDate.toISOString()} até ${endDate.toISOString()} (${actualPeriod} dias${customStartDate ? ' - DATAS CUSTOMIZADAS' : ''})`
          );

          // Buscar pedidos do período - começar com mais pedidos
          const allOrders: Array<Record<string, unknown>> = [];
          let offset = 0;
          const limit = 50;
          let hasMore = true;

          // Buscar até 500 pedidos para análise completa
          while (hasMore && offset < 500) {
            try {
              const ordersResponse = await MercadoLivreService.getUserOrders(
                accessToken,
                {
                  seller: account.mlUserId,
                  offset,
                  limit,
                  sort: "date_desc",
                }
              );

              if (ordersResponse.results && ordersResponse.results.length > 0) {
                allOrders = allOrders.concat(ordersResponse.results);
                offset += limit;
                hasMore = ordersResponse.results.length === limit;
              } else {
                hasMore = false;
              }
            } catch (error) {
              console.warn(
                `[SALES_COMPLETE] Erro ao buscar pedidos offset ${offset}:`,
                error
              );
              hasMore = false;
            }
          }

          console.log(
            `[SALES_COMPLETE] Total de pedidos obtidos: ${allOrders.length}`
          );

          // Filtrar pedidos do período e com status válido
          // Incluímos apenas vendas confirmadas e pagas, excluindo cancelamentos, devoluções e status inválidos
          const validStatuses = [
            "paid",           // Pago
            "delivered",      // Entregue
            "ready_to_ship",  // Pronto para envio
            "shipped",        // Enviado
            "handling",       // Em preparação
          ];
          
          // Status que devem ser EXCLUÍDOS (vendas que não devem contar como receita)
          const excludedStatuses = [
            "cancelled",       // Cancelado
            "invalid",         // Inválido
            "refunded",        // Reembolsado
            "payment_rejected", // Pagamento rejeitado
            "pending",         // Pendente (não confirmado)
            "returned",        // Devolvido
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

          // Filtrar pedidos cancelados/devolvidos do período (todos os status excluídos)
          const cancelledOrders = allOrders.filter((order) => {
            const orderDate = new Date(order.date_created);
            return (
              orderDate >= startDate &&
              orderDate <= endDate &&
              excludedStatuses.includes(order.status)
            );
          });

          console.log(
            `[SALES_COMPLETE] Pedidos válidos no período: ${periodOrders.length}`
          );
          console.log(
            `[SALES_COMPLETE] Pedidos cancelados no período: ${cancelledOrders.length}`
          );

          // Processar vendas
          const productSales = new Map<string, SalesProduct>();
          const dailyData = new Map<
            string,
            { revenue: number; orders: number; items: number }
          >();
          const hourlyData = new Map<
            number,
            { count: number; revenue: number }
          >();

          let totalRevenue = 0; // Total com frete
          let totalProductRevenue = 0; // Total só produtos
          let totalItems = 0;
          const totalOrders = periodOrders.length;

          periodOrders.forEach((order) => {
            const orderDate = new Date(order.date_created);
            const dayKey = orderDate.toISOString().split("T")[0];
            const hour = orderDate.getHours();

            // Calcular receita de produtos do pedido
            let orderProductRevenue = 0;
            let orderItems = 0;

            order.order_items.forEach((item: any) => {
              const itemRevenue = item.unit_price * item.quantity;
              const itemCount = item.quantity;

              orderProductRevenue += itemRevenue;
              totalItems += itemCount;
              orderItems += itemCount;

              // Dados por produto
              const existing = productSales.get(item.item.id);
              if (existing) {
                existing.totalSales += itemCount;
                existing.totalRevenue += itemRevenue;
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
                });
              }
            });

            // Calcular valor total do pedido e frete
            const orderTotalAmount = order.total_amount || 0;
            const orderShippingCost = orderTotalAmount - orderProductRevenue;
            
            // Acumular totais
            totalRevenue += orderTotalAmount;
            totalProductRevenue += orderProductRevenue;

            // Dados diários (usar total com frete)
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

            // Dados por hora (usar total com frete)
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

          // Calcular frete total
          const totalShippingRevenue = totalRevenue - totalProductRevenue;

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

          // Processar pedidos cancelados/devolvidos (receita perdida)
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
            // Usar o valor total do pedido (inclui frete)
            const orderRevenue = order.total_amount || 0;
            let orderItems = 0;
            const orderDate = new Date(order.date_created);

            // Processar itens cancelados
            order.order_items.forEach((item: any) => {
              const itemQuantity = item.quantity;
              const itemRevenue = item.unit_price * item.quantity;
              orderItems += itemQuantity;

              // Rastrear produtos cancelados
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
              buyer_nickname: order.buyer?.nickname || "N/A",
              cancellation_reason:
                order.status_detail?.description || 
                order.status_detail ||
                order.status, // Incluir o status se não tiver detalhe
            });
          });

          // Preparar lista de produtos cancelados com taxa de cancelamento
          const cancelledProductsList = Array.from(cancelledProductsMap.values())
            .map(product => {
              // Buscar dados de vendas do produto para calcular taxa
              const salesData = productSales.get(product.mlItemId);
              const totalSold = salesData?.totalSales || 0;
              const totalWithCancelled = totalSold + product.totalCancelled;
              const cancellationRate = totalWithCancelled > 0
                ? (product.totalCancelled / totalWithCancelled) * 100
                : 100; // Se só tem cancelamentos, 100%

              return {
                ...product,
                cancellationRate,
              };
            })
            .sort((a, b) => b.totalCancelled - a.totalCancelled) // Ordenar por quantidade cancelada
            .slice(0, 20); // Top 20 produtos

          // Calcular taxa de cancelamento
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
              totalRevenue, // Total incluindo frete
              totalProductRevenue, // Total só produtos
              totalShippingRevenue, // Total só frete
              averageTicket: totalOrders > 0 ? totalRevenue / totalOrders : 0,
              averageItemsPerOrder:
                totalOrders > 0 ? totalItems / totalOrders : 0,
            },
            trends: {
              dailyRevenue,
              topProducts,
              salesByHour,
            },
            cancelled: {
              totalCancelledOrders: cancelledOrders.length,
              totalCancelledItems,
              totalCancelledRevenue,
              cancellationRate,
              orders: cancelledOrdersData.slice(0, 50), // Limitar a 50 pedidos cancelados mais recentes
              topCancelledProducts: cancelledProductsList, // Top 20 produtos com mais cancelamentos
            },
          };

          console.log(
            `[SALES_COMPLETE] Análise concluída: ${totalOrders} pedidos, ${totalItems} itens`
          );
          console.log(
            `[SALES_COMPLETE] Receita - Produtos: R$ ${totalProductRevenue.toFixed(2)} | Frete: R$ ${totalShippingRevenue.toFixed(2)} | Total: R$ ${totalRevenue.toFixed(2)}`
          );
          console.log(
            `[SALES_COMPLETE] Cancelamentos: ${
              cancelledOrders.length
            } pedidos, ${totalCancelledItems} itens, R$ ${totalCancelledRevenue.toFixed(
              2
            )} (${cancellationRate.toFixed(2)}%)`
          );
          console.log(
            `[SALES_COMPLETE] Produtos cancelados: ${cancelledProductsList.length} produtos diferentes`
          );
          if (cancelledProductsList.length > 0) {
            console.log(
              `[SALES_COMPLETE] Top 3 produtos cancelados:`,
              cancelledProductsList.slice(0, 3).map(p => ({
                nome: p.productName,
                quantidade: p.totalCancelled,
                taxa: `${p.cancellationRate.toFixed(1)}%`
              }))
            );
          }

          return analytics;
        },
        "300" // Cache por 5 minutos
      );

      // Buscar dados de comparação se solicitado
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
            console.log(
              `[SALES_COMPLETE] Buscando dados do período anterior: ${prevStartDate.toISOString()} até ${prevEndDate.toISOString()}`
            );

            let allPrevOrders: any[] = [];
            let offset = 0;
            const limit = 50;
            let hasMore = true;

            while (hasMore && offset < 300) {
              try {
                const ordersResponse = await MercadoLivreService.getUserOrders(
                  accessToken,
                  {
                    seller: account.mlUserId,
                    offset,
                    limit,
                    sort: "date_desc",
                  }
                );

                if (
                  ordersResponse.results &&
                  ordersResponse.results.length > 0
                ) {
                  allPrevOrders = allPrevOrders.concat(ordersResponse.results);
                  offset += limit;
                  hasMore = ordersResponse.results.length === limit;
                } else {
                  hasMore = false;
                }
              } catch (error) {
                console.warn(
                  `[SALES_COMPLETE] Erro ao buscar pedidos anteriores offset ${offset}:`,
                  error
                );
                hasMore = false;
              }
            }

            // Filtrar pedidos do período anterior (mesmos critérios)
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

            let prevRevenue = 0; // Total com frete
            let prevProductRevenue = 0; // Total só produtos
            let prevItems = 0;
            const prevOrders = prevPeriodOrders.length;

            prevPeriodOrders.forEach((order) => {
              let orderProductRevenue = 0;
              
              // Contar itens e calcular receita de produtos
              order.order_items.forEach((item: any) => {
                prevItems += item.quantity;
                orderProductRevenue += item.unit_price * item.quantity;
              });
              
              // Usar total_amount (inclui frete)
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
          "600" // Cache por 10 minutos
        );

        // Calcular crescimento
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
          details:
            mlError instanceof Error ? mlError.message : "Erro desconhecido",
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
