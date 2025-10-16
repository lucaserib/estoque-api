import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { withCache, createCacheKey, mlCache } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

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
        { error: "Conta do Mercado Livre não encontrada ou inativa" },
        { status: 404 }
      );
    }

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // Buscar métricas dos produtos ML com consulta otimizada
      const produtosML = await prisma.produtoMercadoLivre.findMany({
        where: {
          mercadoLivreAccountId: accountId,
          syncStatus: { not: { equals: "ignored" } },
        },
        select: {
          id: true,
          mlItemId: true,
          mlStatus: true,
          mlAvailableQuantity: true,
          mlSoldQuantity: true,
          lastSyncAt: true,
          produto: {
            select: {
              nome: true,
              sku: true,
              estoques: {
                select: {
                  quantidade: true,
                },
              },
            },
          },
        },
      });

      // Calcular métricas básicas
      const activeProducts = produtosML.filter(
        (p) => p.mlStatus === "active"
      ).length;
      const pausedProducts = produtosML.filter(
        (p) => p.mlStatus === "paused"
      ).length;
      const lowStockProducts = produtosML.filter(
        (p) => p.mlAvailableQuantity <= 5 && p.mlStatus === "active"
      ).length;

      // Buscar vendas reais do ML (últimos 7 dias)
      let todaySales = 0;
      let weekSales = 0;
      let totalRevenue = 0;
      let pendingOrders = 0;
      let hasRecentSalesData = false;
      let ordersData: any = null; // ✅ CORREÇÃO: Armazenar orders para uso posterior

      try {
        // Buscar pedidos recentes com cache mais inteligente
        const cacheKey = createCacheKey("orders", accountId, "recent");
        // ✅ MELHORIA: Cache mais eficiente para dashboard - balance entre tempo real e performance
        ordersData = await withCache(
          cacheKey,
          async () => {
            console.log(
              `[DASHBOARD_METRICS] Buscando pedidos do ML para métricas...`
            );
            const result = await MercadoLivreService.getUserOrders(
              accessToken,
              {
                // ✅ CORREÇÃO: Parâmetro seller é OBRIGATÓRIO para buscar pedidos do vendedor
                seller: account.mlUserId,
                offset: 0,
                limit: 50, // ✅ CORREÇÃO: Limite máximo da API ML é 50
                sort: "date_desc",
              }
            );
            console.log(
              `[DASHBOARD_METRICS] ${
                result.results?.length || 0
              } pedidos obtidos`
            );
            return result;
          },
          "5" // ✅ CORREÇÃO: String para o cache key
        );

        const today = new Date();
        const todayStart = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
        const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        if (ordersData && ordersData.results) {
          hasRecentSalesData = true;

          ordersData.results.forEach((order: any) => {
            const orderDate = new Date(order.date_created);

            // Status mais abrangentes para vendas confirmadas
            if (
              [
                "paid",
                "delivered",
                "ready_to_ship",
                "shipped",
                "handling",
              ].includes(order.status)
            ) {
              // Calcular quantidades e receita real dos itens
              const orderItemsCount = order.order_items.reduce(
                (sum: number, item: any) => sum + item.quantity,
                0
              );
              const orderRevenue = order.order_items.reduce(
                (sum: number, item: any) =>
                  sum + item.unit_price * item.quantity,
                0
              );

              if (orderDate >= todayStart) {
                todaySales += orderItemsCount;
              }
              if (orderDate >= weekStart) {
                weekSales += orderItemsCount;
                totalRevenue += orderRevenue;
              }
            } else if (
              ["confirmed", "payment_required", "payment_in_process"].includes(
                order.status
              )
            ) {
              pendingOrders++;
            }
          });
        }
      } catch (ordersError) {
        console.warn("Erro ao buscar pedidos ML:", ordersError);

        // Tentar buscar dados de vendas do cache antigo
        const fallbackCacheKey = createCacheKey(
          "orders",
          accountId,
          "fallback"
        );
        const cachedSalesData = mlCache.get<{
          todaySales: number;
          weekSales: number;
          totalRevenue: number;
          pendingOrders: number;
        }>(fallbackCacheKey);

        if (cachedSalesData) {
          console.log("Usando dados de vendas em cache como fallback");
          todaySales = cachedSalesData.todaySales || 0;
          weekSales = cachedSalesData.weekSales || 0;
          totalRevenue = cachedSalesData.totalRevenue || 0;
          pendingOrders = cachedSalesData.pendingOrders || 0;
          hasRecentSalesData = false; // Indica que são dados cached
        } else {
          console.log(
            "Nenhum dado de vendas disponível - usando valores zerados"
          );
          // Usar valores padrão
          todaySales = 0;
          weekSales = 0;
          totalRevenue = 0;
          pendingOrders = 0;
          hasRecentSalesData = false;
        }
      }

      // Verificar se precisa de sincronização (produtos não sincronizados há mais de 1 hora)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const needsSync = produtosML.some(
        (p) => !p.lastSyncAt || p.lastSyncAt < oneHourAgo
      );

      // Última sincronização
      const lastSyncProduct = produtosML
        .filter((p) => p.lastSyncAt)
        .sort((a, b) => b.lastSyncAt!.getTime() - a.lastSyncAt!.getTime())[0];

      // Calcular produtos que precisam de reposição
      const needsRestockProducts = produtosML.filter((p) => {
        if (!p.produto || p.mlStatus !== "active") return false;

        const totalLocalStock = p.produto.estoques.reduce(
          (sum, estoque) => sum + estoque.quantidade,
          0
        );
        const mlStock = p.mlAvailableQuantity;

        // Produto precisa de reposição se:
        // 1. Estoque no ML está baixo (≤ 5)
        // 2. Estoque local é maior que ML (dessincronia)
        // 3. Produto vendeu nas últimas semanas (tem mlSoldQuantity > 0)
        return (
          (mlStock <= 5 && totalLocalStock > mlStock) ||
          (p.mlSoldQuantity > 0 && mlStock <= 5)
        );
      }).length;

      // Salvar dados de vendas no cache de fallback se conseguimos buscar dados recentes
      if (hasRecentSalesData) {
        const fallbackCacheKey = createCacheKey(
          "orders",
          accountId,
          "fallback"
        );
        mlCache.set(
          fallbackCacheKey,
          {
            todaySales,
            weekSales,
            totalRevenue,
            pendingOrders,
            timestamp: new Date().toISOString(),
          },
          "24" // ✅ CORREÇÃO: String para o cache TTL
        ); // Cache por 24 horas
      }

      // ✅ CORREÇÃO: Calcular ticket médio corretamente (receita ÷ itens vendidos)
      let averageTicket = 0;
      const totalItemsSold = weekSales; // weekSales já representa itens vendidos

      try {
        if (totalRevenue > 0 && totalItemsSold > 0) {
          // Ticket médio = receita total ÷ total de itens vendidos
          // ✅ CORREÇÃO: totalRevenue já está em reais (não centavos), então converter para centavos para manter consistência
          averageTicket = Math.round((totalRevenue * 100) / totalItemsSold);

          console.log(
            `[METRICS] 🎯 Ticket médio calculado: R$ ${(averageTicket / 100).toFixed(2)} ` +
            `(${totalItemsSold} itens, R$ ${totalRevenue.toFixed(2)} receita)`
          );
        } else {
          console.log(
            `[METRICS] ⚠️ Dados insuficientes para calcular ticket médio: ` +
            `receita=${totalRevenue}, itens=${totalItemsSold}`
          );
        }
      } catch (error) {
        console.warn("Erro ao calcular ticket médio:", error);
        averageTicket = 0;
      }

      return NextResponse.json({
        // Métricas básicas
        totalProducts: produtosML.length,
        activeProducts,
        pausedProducts,
        lowStockProducts,
        needsRestockProducts,

        // Métricas de vendas
        todaySales,
        weekSales,
        totalRevenue,
        averageTicket,
        pendingOrders,

        // Status de sincronização
        needsSync,
        lastSync: lastSyncProduct?.lastSyncAt?.toISOString() || null,

        // Métricas adicionais para o dashboard
        salesGrowth: weekSales > 0 ? "positive" : "neutral",

        // ✅ MELHORIA: Saúde dos produtos mais clara e detalhada
        productHealth: {
          total: produtosML.length,
          // Produtos "saudáveis" = ativos + com estoque adequado + sem problemas
          healthy: Math.max(
            0,
            activeProducts - lowStockProducts - needsRestockProducts
          ),
          // Produtos que precisam de atenção
          needsAttention:
            lowStockProducts + pausedProducts + needsRestockProducts,
          // Percentual de produtos saudáveis
          healthPercentage:
            produtosML.length > 0
              ? Math.round(
                  (Math.max(
                    0,
                    activeProducts - lowStockProducts - needsRestockProducts
                  ) /
                    produtosML.length) *
                    100
                )
              : 0,

          // ✅ NOVO: Detalhamento dos problemas
          breakdown: {
            active: activeProducts,
            paused: pausedProducts,
            lowStock: lowStockProducts,
            needsRestock: needsRestockProducts,
            withSales: 0, // Será preenchido se houver dados de vendas
          },

          // ✅ NOVO: Explicação clara da métrica
          description:
            "Percentual de produtos ativos, com estoque adequado e sem problemas detectados",
        },

        // Status dos dados
        dataStatus: {
          salesDataFresh: hasRecentSalesData,
          lastSalesUpdate: hasRecentSalesData
            ? new Date().toISOString()
            : "cached_or_historical",
          mlConnectionStatus: "connected",
        },
      });
    } catch (mlError) {
      console.error("Erro ao buscar dados do ML:", mlError);

      // Fallback: retornar apenas métricas do banco local
      const produtosML = await prisma.produtoMercadoLivre.findMany({
        where: {
          mercadoLivreAccountId: accountId,
          syncStatus: { not: { equals: "ignored" } },
        },
      });

      return NextResponse.json({
        totalProducts: produtosML.length,
        activeProducts: produtosML.filter((p) => p.mlStatus === "active")
          .length,
        pausedProducts: produtosML.filter((p) => p.mlStatus === "paused")
          .length,
        lowStockProducts: produtosML.filter((p) => p.mlAvailableQuantity <= 5)
          .length,
        needsRestockProducts: 0,
        todaySales: 0,
        weekSales: 0,
        totalRevenue: 0,
        averageTicket: 0,
        pendingOrders: 0,
        needsSync: true,
        lastSync: null,
        salesGrowth: "neutral",
        productHealth: {
          total: produtosML.length,
          healthy: 0,
          needsAttention: produtosML.length,
        },
        warning: "Dados limitados - erro ao conectar com Mercado Livre",
      });
    }
  } catch (error) {
    console.error("Erro ao buscar métricas do dashboard ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
