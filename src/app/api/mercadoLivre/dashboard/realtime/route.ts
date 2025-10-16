import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { withCache, createCacheKey } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period") || "today"; // today, 7d, 30d
    const forceRefresh = searchParams.get("refresh") === "true";

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID é obrigatório" },
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
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    console.log(`[REALTIME_API] Buscando métricas em tempo real para conta ${accountId}`);

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // ✅ NOVO: Buscar dados em paralelo para dashboard em tempo real
      const [
        salesData,
        stockData,
        activeProductsData,
        recentOrdersData,
        performanceData,
      ] = await Promise.allSettled([
        getSalesMetrics(accessToken, accountId, period, forceRefresh),
        getStockMetrics(accountId),
        getActiveProductsMetrics(accountId),
        getRecentOrdersMetrics(accessToken, accountId, forceRefresh),
        getPerformanceMetrics(accountId),
      ]);

      // Processar resultados
      const resolveResult = <T>(
        result: PromiseSettledResult<T>,
        fallback: T
      ): T => {
        if (result.status === "fulfilled") {
          return result.value;
        } else {
          console.warn("Erro ao buscar dados:", result.reason);
          return fallback;
        }
      };

      const sales = resolveResult(salesData, {
        totalSales: 0,
        totalRevenue: 0,
        averageTicket: 0,
        growthRate: 0,
        topProducts: [],
      });

      const stock = resolveResult(stockData, {
        totalProducts: 0,
        lowStockCount: 0,
        outOfStockCount: 0,
        criticalAlerts: [],
      });

      const activeProducts = resolveResult(activeProductsData, {
        total: 0,
        active: 0,
        paused: 0,
        withPromotion: 0,
      });

      const recentOrders = resolveResult(recentOrdersData, {
        orders: [],
        totalToday: 0,
        pendingCount: 0,
      });

      const performance = resolveResult(performanceData, {
        syncHealthScore: 100,
        lastSyncTime: new Date().toISOString(),
        errorRate: 0,
        cacheHitRate: 0,
      });

      // ✅ NOVO: Métricas calculadas em tempo real
      const realTimeMetrics = {
        // Vendas
        sales: {
          ...sales,
          trend: sales.growthRate > 0 ? "up" : sales.growthRate < 0 ? "down" : "stable",
          color: sales.growthRate > 0 ? "green" : sales.growthRate < 0 ? "red" : "gray",
        },

        // Estoque
        inventory: {
          ...stock,
          healthScore: calculateStockHealthScore(stock),
          alerts: stock.criticalAlerts.slice(0, 5), // Top 5 alertas
        },

        // Produtos
        products: {
          ...activeProducts,
          activeRate: activeProducts.total > 0
            ? Math.round((activeProducts.active / activeProducts.total) * 100)
            : 0,
          promotionRate: activeProducts.total > 0
            ? Math.round((activeProducts.withPromotion / activeProducts.total) * 100)
            : 0,
        },

        // Pedidos recentes
        orders: {
          ...recentOrders,
          recent: recentOrders.orders.slice(0, 10), // 10 mais recentes
          pendingRate: recentOrders.totalToday > 0
            ? Math.round((recentOrders.pendingCount / recentOrders.totalToday) * 100)
            : 0,
        },

        // Performance do sistema
        system: {
          ...performance,
          status: performance.syncHealthScore > 80 ? "healthy" :
                  performance.syncHealthScore > 60 ? "warning" : "critical",
          lastUpdate: new Date().toISOString(),
        },

        // Insights automáticos
        insights: generateInsights({
          sales,
          stock,
          activeProducts,
          recentOrders,
          performance,
        }),

        // Metadata
        metadata: {
          period,
          accountId,
          fromCache: !forceRefresh,
          timestamp: new Date().toISOString(),
          version: "2.0",
        },
      };

      console.log(`[REALTIME_API] Métricas compiladas com sucesso`);

      return NextResponse.json({
        success: true,
        data: realTimeMetrics,
      });
    } catch (error) {
      console.error("[REALTIME_API] Erro ao buscar métricas:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Erro ao buscar métricas em tempo real",
          details: error instanceof Error ? error.message : "Erro desconhecido",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[REALTIME_API] Erro na requisição:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

// ✅ FUNÇÕES AUXILIARES

async function getSalesMetrics(
  accessToken: string,
  accountId: string,
  period: string,
  forceRefresh: boolean
) {
  const cacheKey = createCacheKey("realtime_sales", accountId, period);

  const fetcher = async () => {
    const ordersData = await MercadoLivreService.getCachedUserOrders(
      accessToken,
      accountId,
      {
        status: "paid",
        period: period as any,
        forceRefresh,
      }
    );

    const orders = ordersData.results;
    const totalSales = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Calcular crescimento (comparar com período anterior)
    const growthRate = 0;
    // TODO: Implementar cálculo de crescimento

    // Top produtos mais vendidos
    const productSales = new Map();
    orders.forEach(order => {
      order.order_items?.forEach(item => {
        const current = productSales.get(item.item.id) || { quantity: 0, revenue: 0, title: item.item.title };
        current.quantity += item.quantity;
        current.revenue += item.unit_price * item.quantity;
        productSales.set(item.item.id, current);
      });
    });

    const topProducts = Array.from(productSales.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      totalSales,
      totalRevenue,
      averageTicket,
      growthRate,
      topProducts,
    };
  };

  if (forceRefresh) {
    return await fetcher();
  }

  return await withCache(cacheKey, fetcher, "sales", `realtime_${period}`);
}

async function getStockMetrics(accountId: string) {
  const cacheKey = createCacheKey("realtime_stock", accountId);

  const fetcher = async () => {
    const produtos = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        syncStatus: { not: "ignored" },
      },
      include: {
        produto: {
          include: {
            estoques: true,
          },
        },
      },
    });

    let lowStockCount = 0;
    let outOfStockCount = 0;
    const criticalAlerts = [];

    produtos.forEach(produtoML => {
      const localStock = produtoML.produto?.estoques.reduce(
        (sum, estoque) => sum + estoque.quantidade,
        0
      ) || 0;

      if (produtoML.mlAvailableQuantity === 0) {
        outOfStockCount++;
      } else if (produtoML.mlAvailableQuantity <= 5) {
        lowStockCount++;
      }

      // Alertas críticos
      if (produtoML.mlAvailableQuantity <= 2 && produtoML.mlStatus === "active") {
        criticalAlerts.push({
          mlItemId: produtoML.mlItemId,
          title: produtoML.mlTitle,
          stock: produtoML.mlAvailableQuantity,
          localStock,
          level: "critical",
        });
      }
    });

    return {
      totalProducts: produtos.length,
      lowStockCount,
      outOfStockCount,
      criticalAlerts: criticalAlerts.sort((a, b) => a.stock - b.stock),
    };
  };

  return await withCache(cacheKey, fetcher, "stock", "realtime");
}

async function getActiveProductsMetrics(accountId: string) {
  const cacheKey = createCacheKey("realtime_products", accountId);

  const fetcher = async () => {
    const result = await prisma.produtoMercadoLivre.groupBy({
      by: ["mlStatus", "mlHasPromotion"],
      where: {
        mercadoLivreAccountId: accountId,
        syncStatus: { not: "ignored" },
      },
      _count: true,
    });

    const stats = {
      total: 0,
      active: 0,
      paused: 0,
      withPromotion: 0,
    };

    result.forEach(group => {
      stats.total += group._count;

      if (group.mlStatus === "active") {
        stats.active += group._count;
      } else if (group.mlStatus === "paused") {
        stats.paused += group._count;
      }

      if (group.mlHasPromotion) {
        stats.withPromotion += group._count;
      }
    });

    return stats;
  };

  return await withCache(cacheKey, fetcher, "products", "realtime");
}

async function getRecentOrdersMetrics(
  accessToken: string,
  accountId: string,
  forceRefresh: boolean
) {
  const cacheKey = createCacheKey("realtime_orders", accountId);

  const fetcher = async () => {
    const ordersData = await MercadoLivreService.getCachedUserOrders(
      accessToken,
      accountId,
      {
        period: "today",
        forceRefresh,
      }
    );

    const allOrders = ordersData.results.slice(0, 20); // 20 mais recentes
    const pendingOrders = allOrders.filter(order =>
      ["confirmed", "payment_required", "payment_in_process"].includes(order.status)
    );

    return {
      orders: allOrders,
      totalToday: allOrders.length,
      pendingCount: pendingOrders.length,
    };
  };

  if (forceRefresh) {
    return await fetcher();
  }

  return await withCache(cacheKey, fetcher, "orders", "realtime");
}

async function getPerformanceMetrics(accountId: string) {
  const cacheKey = createCacheKey("realtime_performance", accountId);

  const fetcher = async () => {
    // Verificar última sincronização
    const lastSync = await prisma.produtoMercadoLivre.findFirst({
      where: {
        mercadoLivreAccountId: accountId,
      },
      orderBy: {
        lastSyncAt: "desc",
      },
      select: {
        lastSyncAt: true,
        syncStatus: true,
      },
    });

    // Calcular taxa de erro
    const errorCount = await prisma.produtoMercadoLivre.count({
      where: {
        mercadoLivreAccountId: accountId,
        syncStatus: "error",
      },
    });

    const totalCount = await prisma.produtoMercadoLivre.count({
      where: {
        mercadoLivreAccountId: accountId,
      },
    });

    const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;

    // Score de saúde baseado em última sync e taxa de erro
    const lastSyncAge = lastSync?.lastSyncAt
      ? Date.now() - new Date(lastSync.lastSyncAt).getTime()
      : Date.now();

    const syncHealthScore = Math.max(0, 100 - (errorRate * 2) - Math.min(50, lastSyncAge / (60 * 1000))); // Reduz score baseado em idade da sync

    return {
      syncHealthScore: Math.round(syncHealthScore),
      lastSyncTime: lastSync?.lastSyncAt?.toISOString() || new Date().toISOString(),
      errorRate: Math.round(errorRate * 100) / 100,
      cacheHitRate: 0, // TODO: Implementar métricas de cache
    };
  };

  return await withCache(cacheKey, fetcher, "metrics", "realtime");
}

function calculateStockHealthScore(stock: any): number {
  if (stock.totalProducts === 0) return 100;

  const outOfStockRate = (stock.outOfStockCount / stock.totalProducts) * 100;
  const lowStockRate = (stock.lowStockCount / stock.totalProducts) * 100;

  // Score baseado na proporção de produtos com problemas de estoque
  return Math.max(0, 100 - (outOfStockRate * 2) - lowStockRate);
}

function generateInsights(data: any): string[] {
  const insights = [];

  // Insights de vendas
  if (data.sales.totalSales === 0) {
    insights.push("Nenhuma venda registrada no período selecionado");
  } else if (data.sales.growthRate > 10) {
    insights.push(`Crescimento de vendas de ${data.sales.growthRate.toFixed(1)}% - Excelente performance!`);
  } else if (data.sales.growthRate < -10) {
    insights.push(`Queda de vendas de ${Math.abs(data.sales.growthRate).toFixed(1)}% - Atenção necessária`);
  }

  // Insights de estoque
  if (data.stock.outOfStockCount > 0) {
    insights.push(`${data.stock.outOfStockCount} produtos em falta - Reabastecer urgente`);
  }

  if (data.stock.lowStockCount > 5) {
    insights.push(`${data.stock.lowStockCount} produtos com estoque baixo - Planejar reposição`);
  }

  // Insights de produtos
  const activeRate = data.activeProducts.total > 0
    ? (data.activeProducts.active / data.activeProducts.total) * 100
    : 0;

  if (activeRate < 80) {
    insights.push(`Apenas ${activeRate.toFixed(0)}% dos produtos estão ativos - Revisar produtos pausados`);
  }

  // Insights de performance
  if (data.performance.syncHealthScore < 80) {
    insights.push("Performance de sincronização baixa - Verificar conexão com ML");
  }

  return insights.slice(0, 3); // Máximo 3 insights
}