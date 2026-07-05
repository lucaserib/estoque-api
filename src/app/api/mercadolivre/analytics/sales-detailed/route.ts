import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

interface MLOrder {
  id: string;
  status: string;
  date_created: string;
  total_amount: number;
  order_items: Array<{
    item: {
      id: string;
      title: string;
      price?: number;
    };
    quantity: number;
    unit_price: number;
  }>;
}

interface ProductAnalysis {
  itemId: string;
  title: string;
  totalQuantitySold: number;
  totalRevenue: number;
  totalOrders: number;
  averagePrice: number;
  highestPrice: number;
  lowestPrice: number;
  lastSaleDate: Date;
  salesByDay: Map<string, number>;
  priceHistory: Array<{ date: string; price: number; quantity: number }>;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const period = parseInt(searchParams.get("period") || "30");

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

      const endDate = new Date();
      const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

      console.log(`[DETAILED_SALES] Buscando vendas detalhadas de ${startDate.toISOString()} até ${endDate.toISOString()}`);

      // Buscar múltiplas páginas de pedidos para obter dados mais completos
      const allOrders: MLOrder[] = [];
      let offset = 0;
      const maxRequests = 3; // Reduzido para 3 páginas (150 pedidos max) para melhor performance
      const validStatuses = ['paid', 'delivered', 'ready_to_ship', 'shipped'];

      for (let page = 0; page < maxRequests; page++) {
        try {
          const orders = await MercadoLivreService.getUserOrders(accessToken, {
            seller: account.mlUserId,
            offset,
            limit: 50,
          });

          if (!orders.results || orders.results.length === 0) {
            break; // Não há mais resultados
          }

          // Filtrar apenas pedidos válidos na busca para economizar processamento
          const validOrders = orders.results.filter((order: MLOrder) =>
            validStatuses.includes(order.status)
          );

          allOrders.push(...validOrders);
          offset += 50;

          // Se retornou menos que o limite, não há mais páginas
          if (orders.results.length < 50) {
            break;
          }

          // Delay reduzido mas mantido para não sobrecarregar a API
          await new Promise(resolve => setTimeout(resolve, 50));

        } catch (pageError) {
          console.warn(`Erro ao buscar página ${page}:`, pageError);
          break;
        }
      }

      console.log(`[DETAILED_SALES] Total de pedidos encontrados: ${allOrders.length}`);

      // Filtrar pedidos relevantes por período (já foram filtrados por status)
      const relevantOrders = allOrders.filter(order => {
        const orderDate = new Date(order.date_created);
        return orderDate >= startDate && orderDate <= endDate;
      });

      console.log(`[DETAILED_SALES] Pedidos no período: ${relevantOrders.length}`);

      // Análise detalhada por produto
      const productAnalysis = new Map<string, ProductAnalysis>();

      // Processar vendas detalhadamente
      relevantOrders.forEach(order => {
        const orderDate = new Date(order.date_created);
        const dayKey = orderDate.toISOString().split('T')[0];

        order.order_items.forEach(item => {
          const itemId = item.item.id;
          const quantity = item.quantity;
          const unitPrice = item.unit_price;

          let analysis = productAnalysis.get(itemId);

          if (!analysis) {
            analysis = {
              itemId,
              title: item.item.title,
              totalQuantitySold: 0,
              totalRevenue: 0,
              totalOrders: 0,
              averagePrice: 0,
              highestPrice: unitPrice,
              lowestPrice: unitPrice,
              lastSaleDate: orderDate,
              salesByDay: new Map(),
              priceHistory: [],
            };
            productAnalysis.set(itemId, analysis);
          }

          // Atualizar estatísticas
          analysis.totalQuantitySold += quantity;
          analysis.totalRevenue += unitPrice * quantity;
          analysis.totalOrders += 1;
          analysis.averagePrice = analysis.totalRevenue / analysis.totalQuantitySold;

          if (unitPrice > analysis.highestPrice) {
            analysis.highestPrice = unitPrice;
          }
          if (unitPrice < analysis.lowestPrice) {
            analysis.lowestPrice = unitPrice;
          }

          if (orderDate > analysis.lastSaleDate) {
            analysis.lastSaleDate = orderDate;
          }

          // Vendas por dia
          const currentDaySales = analysis.salesByDay.get(dayKey) || 0;
          analysis.salesByDay.set(dayKey, currentDaySales + quantity);

          // Histórico de preços
          analysis.priceHistory.push({
            date: orderDate.toISOString(),
            price: unitPrice,
            quantity,
          });
        });
      });

      // Calcular métricas gerais
      const totalItemsSold = Array.from(productAnalysis.values())
        .reduce((sum, product) => sum + product.totalQuantitySold, 0);

      const totalRevenue = Array.from(productAnalysis.values())
        .reduce((sum, product) => sum + product.totalRevenue, 0);

      const averageOrderValue = relevantOrders.length > 0 ?
        totalRevenue / relevantOrders.length : 0;

      // Top produtos com mais detalhes
      const topProducts = Array.from(productAnalysis.values())
        .sort((a, b) => b.totalQuantitySold - a.totalQuantitySold)
        .slice(0, 20)
        .map(product => ({
          ...product,
          salesVelocity: product.totalQuantitySold / period,
          priceVariation: product.highestPrice - product.lowestPrice,
          priceVariationPercentage: product.lowestPrice > 0 ?
            ((product.highestPrice - product.lowestPrice) / product.lowestPrice * 100) : 0,
          daysSinceLastSale: Math.floor((Date.now() - product.lastSaleDate.getTime()) / (1000 * 60 * 60 * 24)),
          salesByDay: Object.fromEntries(product.salesByDay),
          recentPriceHistory: product.priceHistory
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10),
        }));

      // Vendas por dia para gráfico
      const dailySalesChart = new Map<string, { date: string; items: number; revenue: number; orders: number }>();

      relevantOrders.forEach(order => {
        const dayKey = new Date(order.date_created).toISOString().split('T')[0];
        const existing = dailySalesChart.get(dayKey);

        const orderItems = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
        const orderRevenue = order.order_items.reduce((sum, item) =>
          sum + (item.unit_price * item.quantity), 0);

        if (existing) {
          existing.items += orderItems;
          existing.revenue += orderRevenue;
          existing.orders += 1;
        } else {
          dailySalesChart.set(dayKey, {
            date: dayKey,
            items: orderItems,
            revenue: orderRevenue,
            orders: 1,
          });
        }
      });

      const salesChart = Array.from(dailySalesChart.values())
        .sort((a, b) => a.date.localeCompare(b.date));

      return NextResponse.json({
        period: {
          days: period,
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
        summary: {
          totalOrdersFound: allOrders.length,
          relevantOrders: relevantOrders.length,
          totalItemsSold,
          totalRevenue,
          averageOrderValue,
          uniqueProductsSold: productAnalysis.size,
          averageDailySales: totalItemsSold / period,
        },
        topProducts,
        salesChart,
        insights: generateInsights(topProducts, period, totalItemsSold),
      });

    } catch (mlError) {
      console.error("Erro ao buscar vendas detalhadas:", mlError);
      return NextResponse.json(
        { error: "Erro ao conectar com Mercado Livre para análise detalhada" },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error("Erro na API de vendas detalhadas:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function generateInsights(
  products: Array<{
    title: string;
    totalQuantitySold: number;
    priceVariationPercentage: number;
    daysSinceLastSale: number;
  }>,
  period: number,
  totalSales: number
): string[] {
  const insights = [];

  // Produto mais vendido
  if (products.length > 0) {
    const topProduct = products[0];
    insights.push(`Produto mais vendido: "${topProduct.title}" com ${topProduct.totalQuantitySold} unidades`);
  }

  // Produtos com maior variação de preço
  const highVariationProducts = products.filter(p => p.priceVariationPercentage > 20);
  if (highVariationProducts.length > 0) {
    insights.push(`${highVariationProducts.length} produto(s) com variação de preço superior a 20%`);
  }

  // Produtos vendidos recentemente
  const recentSales = products.filter(p => p.daysSinceLastSale <= 3);
  if (recentSales.length > 0) {
    insights.push(`${recentSales.length} produto(s) venderam nos últimos 3 dias`);
  }

  // Velocidade média de vendas
  const avgVelocity = totalSales / period;
  if (avgVelocity > 1) {
    insights.push(`Velocidade média de ${avgVelocity.toFixed(1)} vendas por dia`);
  }

  return insights;
}