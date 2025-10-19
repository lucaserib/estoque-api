import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { withCache, createCacheKey } from "@/lib/cache";
import { MLOrder as BaseMLOrder } from "@/types/mercadolivre";

interface MLOrderWithShipping {
  id: string;
  status: string;
  date_created: string;
  total_amount: number;
  total_amount_with_shipping?: number;
  order_items: Array<{
    item: {
      id: string;
      title: string;
    };
    quantity: number;
    unit_price: number;
    full_unit_price: number;
  }>;
  shipping?: {
    id?: string;
    cost: number;
  };
  payments?: Array<{
    transaction_amount?: number;
    shipping_cost?: number;
    total_paid_amount?: number;
  }>;
}

interface RevenueBreakdown {
  totalRevenue: number;
  productRevenue: number;
  shippingRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  averageTicketWithShipping: number;
  averageTicketWithoutShipping: number;
  shippingPercentage: number;
}

interface DailyRevenue {
  date: string;
  totalRevenue: number;
  productRevenue: number;
  shippingRevenue: number;
  orders: number;
  items: number;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const period = parseInt(searchParams.get("period") || "30");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

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

      // Calcular período baseado nos parâmetros
      let calculatedEndDate: Date;
      let calculatedStartDate: Date;

      if (startDate && endDate) {
        calculatedStartDate = new Date(startDate);
        calculatedEndDate = new Date(endDate);
      } else {
        calculatedEndDate = new Date();
        calculatedStartDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);
      }

      console.log(`[REVENUE_COMPLETE] Buscando receita completa de ${calculatedStartDate.toISOString()} até ${calculatedEndDate.toISOString()}`);

      const cacheKey = createCacheKey("revenue", accountId, `${calculatedStartDate.getTime()}-${calculatedEndDate.getTime()}`);

      const revenueData = await withCache(
        cacheKey,
        async () => {
          // Buscar múltiplas páginas de pedidos para análise completa
          const allOrders: MLOrderWithShipping[] = [];
          let offset = 0;
          const maxRequests = 5; // Buscar até 250 pedidos
          const validStatuses = ['paid', 'delivered', 'ready_to_ship', 'shipped', 'handling'];

          console.log(`[REVENUE_COMPLETE] Iniciando busca de pedidos...`);

          for (let page = 0; page < maxRequests; page++) {
            try {
              const orders = await MercadoLivreService.getUserOrders(accessToken, {
                seller: account.mlUserId,
                offset,
                limit: 50,
                sort: 'date_desc'
              });

              if (!orders.results || orders.results.length === 0) {
                break;
              }

              // Filtrar apenas pedidos válidos
              const validOrders = (orders.results as unknown as MLOrderWithShipping[]).filter((order: MLOrderWithShipping) =>
                validStatuses.includes(order.status)
              );

              allOrders.push(...validOrders);
              offset += 50;

              if (orders.results.length < 50) {
                break;
              }

              // Delay para não sobrecarregar a API
              await new Promise(resolve => setTimeout(resolve, 100));

            } catch (pageError) {
              console.warn(`[REVENUE_COMPLETE] Erro ao buscar página ${page}:`, pageError);
              break;
            }
          }

          console.log(`[REVENUE_COMPLETE] Total de pedidos encontrados: ${allOrders.length}`);

          // Filtrar pedidos por período
          const relevantOrders = allOrders.filter(order => {
            const orderDate = new Date(order.date_created);
            return orderDate >= calculatedStartDate && orderDate <= calculatedEndDate;
          });

          console.log(`[REVENUE_COMPLETE] Pedidos no período: ${relevantOrders.length}`);

          // Para cada pedido, buscar detalhes de shipping se disponível
          const ordersWithShipping: MLOrderWithShipping[] = [];

          for (const order of relevantOrders) {
            try {
              let shippingCost = 0;

              // Tentar obter custo de shipping através de diferentes métodos
              if (order.shipping?.id) {
                try {
                  // Método 1: API de shipping costs
                  const shippingResponse = await fetch(
                    `https://api.mercadolibre.com/shipments/${order.shipping.id}/costs`,
                    {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                      }
                    }
                  );

                  if (shippingResponse.ok) {
                    const shippingData = await shippingResponse.json();
                    shippingCost = shippingData.cost || shippingData.gross_amount || 0;
                  }
                } catch (shippingError) {
                  console.warn(`[REVENUE_COMPLETE] Erro ao buscar shipping para pedido ${order.id}:`, shippingError);
                }
              }

              // Método 2: Verificar se tem shipping_cost nos payments
              if (shippingCost === 0 && order.payments && order.payments.length > 0) {
                shippingCost = order.payments.reduce((sum: number, payment: any) =>
                  sum + (payment.shipping_cost || 0), 0);
              }

              // Método 3: Diferença entre total_amount_with_shipping e total_amount
              if (shippingCost === 0 && order.total_amount_with_shipping && order.total_amount) {
                shippingCost = order.total_amount_with_shipping - order.total_amount;
              }

              ordersWithShipping.push({
                ...order,
                shipping: {
                  ...(order.shipping || {}),
                  id: order.shipping?.id || order.id,
                  cost: shippingCost
                } as { id: string; cost: number }
              } as MLOrderWithShipping);

            } catch (orderError) {
              console.warn(`[REVENUE_COMPLETE] Erro ao processar pedido ${order.id}:`, orderError);
              ordersWithShipping.push(order);
            }
          }

          // Calcular métricas de receita
          let totalProductRevenue = 0;
          let totalShippingRevenue = 0;
          const totalOrders = ordersWithShipping.length;
          let totalItems = 0;

          const dailyRevenueMap = new Map<string, DailyRevenue>();

          ordersWithShipping.forEach(order => {
            const orderDate = new Date(order.date_created);
            const dayKey = orderDate.toISOString().split('T')[0];

            // Calcular receita dos produtos
            const orderProductRevenue = order.order_items.reduce((sum: number, item: any) =>
              sum + (item.unit_price * item.quantity), 0);

            // Receita de frete
            const orderShippingRevenue = order.shipping?.cost || 0;

            // Contar itens
            const orderItemsCount = order.order_items.reduce((sum: number, item: any) =>
              sum + item.quantity, 0);

            totalProductRevenue += orderProductRevenue;
            totalShippingRevenue += orderShippingRevenue;
            totalItems += orderItemsCount;

            // Agrupar por dia
            const existing = dailyRevenueMap.get(dayKey);
            if (existing) {
              existing.productRevenue += orderProductRevenue;
              existing.shippingRevenue += orderShippingRevenue;
              existing.totalRevenue += (orderProductRevenue + orderShippingRevenue);
              existing.orders += 1;
              existing.items += orderItemsCount;
            } else {
              dailyRevenueMap.set(dayKey, {
                date: dayKey,
                productRevenue: orderProductRevenue,
                shippingRevenue: orderShippingRevenue,
                totalRevenue: orderProductRevenue + orderShippingRevenue,
                orders: 1,
                items: orderItemsCount
              });
            }
          });

          const totalRevenue = totalProductRevenue + totalShippingRevenue;

          const breakdown: RevenueBreakdown = {
            totalRevenue,
            productRevenue: totalProductRevenue,
            shippingRevenue: totalShippingRevenue,
            totalOrders,
            averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            averageTicketWithShipping: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            averageTicketWithoutShipping: totalOrders > 0 ? totalProductRevenue / totalOrders : 0,
            shippingPercentage: totalRevenue > 0 ? (totalShippingRevenue / totalRevenue) * 100 : 0
          };

          const dailyChart = Array.from(dailyRevenueMap.values())
            .sort((a, b) => a.date.localeCompare(b.date));

          return {
            period: {
              days: Math.ceil((calculatedEndDate.getTime() - calculatedStartDate.getTime()) / (1000 * 60 * 60 * 24)),
              from: calculatedStartDate.toISOString(),
              to: calculatedEndDate.toISOString()
            },
            summary: {
              ...breakdown,
              totalItems,
              averageDailyRevenue: breakdown.totalRevenue / Math.max(1, dailyChart.length)
            },
            dailyChart,
            insights: generateRevenueInsights(breakdown, totalItems, dailyChart.length)
          };
        },
        "10" // Cache por 10 minutos
      );

      return NextResponse.json(revenueData);

    } catch (mlError) {
      console.error("[REVENUE_COMPLETE] Erro ao buscar dados do ML:", mlError);
      return NextResponse.json(
        { error: "Erro ao conectar com Mercado Livre para análise de receita" },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error("[REVENUE_COMPLETE] Erro na API de receita completa:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function generateRevenueInsights(
  breakdown: RevenueBreakdown,
  totalItems: number,
  totalDays: number
): string[] {
  const insights = [];

  // Insight sobre faturamento total
  insights.push(`Faturamento total: R$ ${(breakdown.totalRevenue / 100).toFixed(2)}`);

  // Insight sobre produtos vs frete
  if (breakdown.shippingRevenue > 0) {
    insights.push(
      `Receita de produtos: R$ ${(breakdown.productRevenue / 100).toFixed(2)} ` +
      `(${(100 - breakdown.shippingPercentage).toFixed(1)}%) + ` +
      `Frete: R$ ${(breakdown.shippingRevenue / 100).toFixed(2)} ` +
      `(${breakdown.shippingPercentage.toFixed(1)}%)`
    );
  } else {
    insights.push(`Receita exclusivamente de produtos (sem frete identificado)`);
  }

  // Insight sobre ticket médio
  insights.push(
    `Ticket médio com frete: R$ ${(breakdown.averageTicketWithShipping / 100).toFixed(2)} | ` +
    `Sem frete: R$ ${(breakdown.averageTicketWithoutShipping / 100).toFixed(2)}`
  );

  // Insight sobre performance diária
  if (totalDays > 0) {
    const avgDailyRevenue = breakdown.totalRevenue / totalDays;
    const avgDailyOrders = breakdown.totalOrders / totalDays;
    insights.push(
      `Média diária: R$ ${(avgDailyRevenue / 100).toFixed(2)} ` +
      `(${avgDailyOrders.toFixed(1)} pedidos/dia)`
    );
  }

  // Insight sobre volume
  if (totalItems > 0) {
    const revenuePerItem = breakdown.totalRevenue / totalItems;
    insights.push(
      `${totalItems} itens vendidos com receita média de R$ ${(revenuePerItem / 100).toFixed(2)} por item`
    );
  }

  return insights;
}