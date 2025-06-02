import { NextRequest, NextResponse } from "next/server";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type");

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID é obrigatório" },
        { status: 400 }
      );
    }

    console.log(
      `[API] Analytics request: accountId=${accountId}, type=${type}`
    );

    // Obter token válido para a conta
    const accessToken = await MercadoLivreService.getValidToken(accountId);
    console.log("[API] Valid token obtained");

    if (type === "sync") {
      console.log("[API] Executing SKU synchronization");

      try {
        const syncResult = await MercadoLivreService.syncProductsBySKU(
          accessToken,
          accountId
        );

        console.log("[API] SKU sync completed successfully:", {
          matched: syncResult.matched,
          unmatched: syncResult.unmatched,
          total: syncResult.total,
        });

        return NextResponse.json({
          success: true,
          data: syncResult,
        });
      } catch (syncError) {
        console.error("[API] SKU sync failed:", syncError);

        return NextResponse.json(
          {
            success: false,
            error: "Erro na sincronização",
            details:
              syncError instanceof Error
                ? syncError.message
                : "Erro desconhecido",
          },
          { status: 500 }
        );
      }
    }

    // Tipo padrão: dashboard analytics completo
    console.log("[API] Fetching comprehensive analytics data");

    try {
      // Buscar todas as informações em paralelo para melhor performance
      const [
        userInfo,
        sellerMetrics,
        stockInfo,
        shippingInfo,
        financialInfo,
        salesPerformance,
        marketplaceFees,
      ] = await Promise.allSettled([
        MercadoLivreService.getUserInfo(accessToken),
        MercadoLivreService.getSellerMetrics(accessToken),
        MercadoLivreService.getStockInfo(accessToken),
        MercadoLivreService.getShippingInfo(accessToken),
        MercadoLivreService.getSellerFinancialInfo(accessToken),
        MercadoLivreService.getSalesPerformance(accessToken),
        MercadoLivreService.getMarketplaceFees(accessToken),
      ]);

      // Processar resultados e lidar com falhas parciais
      const resolveResult = <T>(
        result: PromiseSettledResult<T>,
        fallback: T
      ): T => {
        return result.status === "fulfilled" ? result.value : fallback;
      };

      const userData = resolveResult(userInfo, {
        id: 0,
        nickname: "Usuário",
        registration_date: new Date().toISOString(),
        first_name: "Nome",
        last_name: "Sobrenome",
        country_id: "BR",
        email: "",
        identification: { type: "", number: "" },
        address: { state: "", city: "" },
        phone: { area_code: "", number: "", extension: "", verified: false },
        alternative_phone: { area_code: "", number: "", extension: "" },
        user_type: "normal",
        tags: [],
        logo: null,
        points: 0,
        site_id: "MLB",
        permalink: "",
        seller_reputation: {
          level_id: "novo_usuario",
          power_seller_status: "normal",
          transactions: {
            period: "historic",
            total: 0,
            completed: 0,
            canceled: 0,
            ratings: { positive: 0, negative: 0, neutral: 0 },
          },
        },
        status: {
          site_status: "active",
          list: { allow: true, codes: [] },
          buy: { allow: true, codes: [] },
          sell: { allow: true, codes: [] },
          billing: { allow: true, codes: [] },
          mercadopago_tc_accepted: false,
          mercadopago_account_type: "personal",
          mercadoenvios: "not_accepted",
          immediate_payment: false,
        },
      });

      const metricsData = resolveResult(sellerMetrics, {
        totalListings: 0,
        activeListings: 0,
        pausedListings: 0,
        totalViews: 0,
        totalQuestions: 0,
        reputationLevel: "novo_usuario",
        reputationScore: 0,
        powerSellerStatus: null,
        completedTransactions: 0,
        canceledTransactions: 0,
      });

      const stockData = resolveResult(stockInfo, {
        totalProducts: 0,
        totalStock: 0,
        lowStockProducts: [],
        outOfStockProducts: [],
        lowStockThreshold: 5,
      });

      const shippingData = resolveResult(shippingInfo, {
        mercadoEnviosEnabled: false,
        freeShippingEnabled: false,
        totalShippingMethods: 0,
        shippingMethods: [],
        averageShippingCost: 0,
        freeShippingProductsCount: 0,
      });

      const financialData = resolveResult(financialInfo, {
        accountBalance: 0,
        pendingBalance: 0,
        availableBalance: 0,
        totalBalance: 0,
        currency: "BRL",
        lastUpdate: new Date().toISOString(),
      });

      const salesData = resolveResult(salesPerformance, {
        totalSales: 0,
        totalRevenue: 0,
        averageTicket: 0,
        conversionRate: 0,
        topSellingProducts: [],
        salesTrend: "estável",
        period: "N/A",
      });

      const feesData = resolveResult(marketplaceFees, {
        listingFee: 0,
        saleFee: 0.12,
        paymentFee: 0.049,
        shippingFee: 0,
        totalFeeRate: 0.169,
        category: "Geral",
        currency: "BRL",
        estimatedFeesOnPrice: (price: number) => ({
          listingFee: 0,
          saleFee: price * 0.12,
          paymentFee: price * 0.049,
          totalFees: price * 0.169,
          netAmount: price * 0.831,
        }),
      });

      // Estruturar resposta completa
      const analyticsData = {
        userInfo: {
          id: userData.id,
          nickname: userData.nickname,
          email: userData.email,
          country: userData.country_id,
          site: userData.site_id,
          lastUpdate: new Date().toISOString(),
        },

        metrics: {
          listings: {
            total: metricsData.totalListings,
            active: metricsData.activeListings,
            paused: metricsData.pausedListings,
          },
          reputation: {
            level: metricsData.reputationLevel,
            score: metricsData.reputationScore,
            powerSeller: metricsData.powerSellerStatus,
          },
          transactions: {
            completed: metricsData.completedTransactions,
            canceled: metricsData.canceledTransactions,
            successRate:
              metricsData.completedTransactions +
                metricsData.canceledTransactions >
              0
                ? (metricsData.completedTransactions /
                    (metricsData.completedTransactions +
                      metricsData.canceledTransactions)) *
                  100
                : 0,
          },
          engagement: {
            totalViews: metricsData.totalViews,
            totalQuestions: metricsData.totalQuestions,
          },
        },

        stock: {
          summary: {
            totalProducts: stockData.totalProducts,
            totalStock: stockData.totalStock,
            lowStockCount: stockData.lowStockProducts.length,
            outOfStockCount: stockData.outOfStockProducts.length,
            lowStockThreshold: stockData.lowStockThreshold,
          },
          alerts: {
            lowStock: stockData.lowStockProducts,
            outOfStock: stockData.outOfStockProducts,
          },
        },

        shipping: {
          configuration: {
            mercadoEnviosEnabled: shippingData.mercadoEnviosEnabled,
            freeShippingEnabled: shippingData.freeShippingEnabled,
            totalMethods: shippingData.totalShippingMethods,
          },
          methods: shippingData.shippingMethods,
          costs: {
            average: shippingData.averageShippingCost,
            freeShippingProductsCount: shippingData.freeShippingProductsCount,
          },
        },

        financial: {
          balance: {
            available: financialData.availableBalance,
            pending: financialData.pendingBalance,
            total: financialData.totalBalance,
          },
          currency: financialData.currency,
          lastUpdate: financialData.lastUpdate,
        },

        sales: {
          performance: {
            totalSales: salesData.totalSales,
            totalRevenue: salesData.totalRevenue,
            averageTicket: salesData.averageTicket,
            conversionRate: salesData.conversionRate,
            trend: salesData.salesTrend,
          },
          topProducts: salesData.topSellingProducts,
          period: salesData.period,
        },

        fees: {
          structure: {
            listing: feesData.listingFee,
            sale: feesData.saleFee,
            payment: feesData.paymentFee,
            shipping: feesData.shippingFee,
            total: feesData.totalFeeRate,
          },
          currency: feesData.currency,
          category: feesData.category,
          calculator: {
            description:
              "Use esta função para calcular taxas em qualquer preço",
            example: feesData.estimatedFeesOnPrice(100), // Exemplo com R$ 100
          },
        },

        // Métricas adicionais calculadas
        insights: {
          stockHealth:
            stockData.lowStockProducts.length === 0 &&
            stockData.outOfStockProducts.length === 0
              ? "Excelente"
              : stockData.outOfStockProducts.length > 0
              ? "Crítico"
              : "Atenção",

          profitabilityScore:
            salesData.totalRevenue > 0
              ? Math.round(
                  ((salesData.totalRevenue * (1 - feesData.totalFeeRate)) /
                    salesData.totalRevenue) *
                    100
                )
              : 0,

          diversificationIndex:
            metricsData.activeListings > 0
              ? Math.min(
                  Math.round(
                    (stockData.totalProducts / metricsData.activeListings) * 100
                  ),
                  100
                )
              : 0,

          shippingOptimization: shippingData.freeShippingEnabled
            ? "Otimizado"
            : "Pode melhorar",

          reputationStatus:
            metricsData.reputationLevel === "green" ||
            metricsData.reputationLevel.includes("green")
              ? "Excelente"
              : metricsData.reputationLevel === "yellow"
              ? "Bom"
              : metricsData.reputationLevel === "orange" ||
                metricsData.reputationLevel === "red"
              ? "Precisa melhorar"
              : "Novo vendedor",
        },

        // Metadata da consulta
        metadata: {
          timestamp: new Date().toISOString(),
          accountId,
          dataSource: "Mercado Livre API",
          version: "2.0",
        },
      };

      console.log("[API] Analytics data compiled successfully");

      return NextResponse.json({
        success: true,
        data: analyticsData,
      });
    } catch (analyticsError) {
      console.error("[API] Analytics compilation failed:", analyticsError);

      return NextResponse.json(
        {
          success: false,
          error: "Erro ao obter dados de analytics",
          details:
            analyticsError instanceof Error
              ? analyticsError.message
              : "Erro desconhecido",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API] Analytics request failed:", error);

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
