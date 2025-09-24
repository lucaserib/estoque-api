import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

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
        { error: "Conta do Mercado Livre não encontrada" },
        { status: 404 }
      );
    }

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      // Buscar métricas do vendedor
      const sellerMetrics = await MercadoLivreService.getSellerMetrics(accessToken);

      // Buscar informações de estoque
      const stockInfo = await MercadoLivreService.getStockInfo(accessToken);

      // Buscar informações de envio
      const shippingInfo = await MercadoLivreService.getShippingInfo(accessToken);

      // Buscar performance de vendas dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Primeiro obter o seller ID
      const userInfo = await MercadoLivreService.getUserInfo(accessToken);
      const sellerId = userInfo.id.toString();
      
      const salesPerformance = await MercadoLivreService.getSalesPerformance(
        accessToken,
        sellerId,
        thirtyDaysAgo.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );

      // Buscar taxas do marketplace
      const marketplaceFees = await MercadoLivreService.getMarketplaceFees(accessToken);

      // Calcular produtos com baixo estoque vs vendas
      const lowStockHighSales = stockInfo.lowStockProducts.filter(product => {
        const productSales = salesPerformance.topSellingProducts.find(
          sales => sales.id === product.id
        );
        return productSales && productSales.soldQuantity > 0;
      });

      // Métricas de conversão e performance
      const conversionMetrics = {
        totalListings: sellerMetrics.totalListings,
        activeListings: sellerMetrics.activeListings,
        pausedListings: sellerMetrics.pausedListings,

        // Taxa de produtos ativos
        activeRate: sellerMetrics.totalListings > 0 ?
          (sellerMetrics.activeListings / sellerMetrics.totalListings * 100) : 0,

        // Produtos com vendas vs total
        productsWithSales: salesPerformance.topSellingProducts.length,
        salesConversionRate: sellerMetrics.activeListings > 0 ?
          (salesPerformance.topSellingProducts.length / sellerMetrics.activeListings * 100) : 0,

        // Estoque crítico
        criticalStockProducts: lowStockHighSales.length,

        // Score de health baseado em múltiplos fatores
        healthScore: calculateHealthScore({
          activeRate: sellerMetrics.totalListings > 0 ? (sellerMetrics.activeListings / sellerMetrics.totalListings) : 0,
          stockHealth: stockInfo.totalProducts > 0 ?
            ((stockInfo.totalProducts - stockInfo.outOfStockProducts.length) / stockInfo.totalProducts) : 0,
          reputationScore: sellerMetrics.reputationScore / 100,
          salesTrend: salesPerformance.salesTrend === 'crescendo' ? 1 : 0.5,
        }),
      };

      // Recomendações baseadas nos dados
      const recommendations = generateRecommendations({
        stockInfo,
        salesPerformance,
        shippingInfo,
        sellerMetrics,
        lowStockHighSales,
      });

      return NextResponse.json({
        overview: {
          reputationLevel: sellerMetrics.reputationLevel,
          reputationScore: sellerMetrics.reputationScore,
          powerSellerStatus: sellerMetrics.powerSellerStatus,
          completedTransactions: sellerMetrics.completedTransactions,
          canceledTransactions: sellerMetrics.canceledTransactions,
          healthScore: conversionMetrics.healthScore,
        },

        inventory: {
          ...stockInfo,
          lowStockHighSalesProducts: lowStockHighSales,
          inventoryTurnover: calculateInventoryTurnover(stockInfo, salesPerformance),
        },

        sales: {
          ...salesPerformance,
          conversionRate: conversionMetrics.salesConversionRate,
          activeProductsRate: conversionMetrics.activeRate,
        },

        shipping: shippingInfo,

        fees: {
          ...marketplaceFees,
          estimatedMonthlyCost: calculateMonthlyCosts(salesPerformance, marketplaceFees),
        },

        recommendations,

        performance: conversionMetrics,
      });

    } catch (mlError) {
      console.error("Erro ao buscar performance do ML:", mlError);
      return NextResponse.json(
        { error: "Erro ao conectar com o Mercado Livre" },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error("Erro na API de performance ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function calculateHealthScore(metrics: {
  activeRate: number;
  stockHealth: number;
  reputationScore: number;
  salesTrend: number;
}): number {
  const weights = {
    activeRate: 0.25,
    stockHealth: 0.3,
    reputationScore: 0.25,
    salesTrend: 0.2,
  };

  const score = (
    metrics.activeRate * weights.activeRate +
    metrics.stockHealth * weights.stockHealth +
    metrics.reputationScore * weights.reputationScore +
    metrics.salesTrend * weights.salesTrend
  ) * 100;

  return Math.round(score);
}

function calculateInventoryTurnover(stockInfo: any, salesPerformance: any): number {
  if (stockInfo.totalStock === 0) return 0;

  const totalSold = salesPerformance.topSellingProducts.reduce(
    (sum: number, product: any) => sum + product.soldQuantity, 0
  );

  // Turnover simples: vendido / estoque atual (mensal)
  return totalSold / stockInfo.totalStock;
}

function calculateMonthlyCosts(salesPerformance: any, fees: any): number {
  if (salesPerformance.totalRevenue === 0) return 0;

  return salesPerformance.totalRevenue * fees.totalFeeRate;
}

function generateRecommendations(data: {
  stockInfo: any;
  salesPerformance: any;
  shippingInfo: any;
  sellerMetrics: any;
  lowStockHighSales: any[];
}): Array<{
  type: 'warning' | 'success' | 'info' | 'critical';
  title: string;
  message: string;
  action?: string;
}> {
  const recommendations = [];

  // Recomendações de estoque
  if (data.lowStockHighSales.length > 0) {
    recommendations.push({
      type: 'critical' as const,
      title: 'Produtos com estoque crítico',
      message: `${data.lowStockHighSales.length} produtos vendendo bem estão com estoque baixo`,
      action: 'Reabastecer urgentemente',
    });
  }

  if (data.stockInfo.outOfStockProducts.length > 0) {
    recommendations.push({
      type: 'warning' as const,
      title: 'Produtos esgotados',
      message: `${data.stockInfo.outOfStockProducts.length} produtos estão sem estoque`,
      action: 'Revisar disponibilidade',
    });
  }

  // Recomendações de envio
  if (!data.shippingInfo.freeShippingEnabled) {
    recommendations.push({
      type: 'info' as const,
      title: 'Frete grátis',
      message: 'Considere habilitar frete grátis para aumentar conversões',
      action: 'Configurar frete grátis',
    });
  }

  // Recomendações de produtos
  if (data.sellerMetrics.pausedListings > data.sellerMetrics.activeListings * 0.2) {
    recommendations.push({
      type: 'warning' as const,
      title: 'Muitos produtos pausados',
      message: 'Você tem muitos produtos pausados que poderiam estar vendendo',
      action: 'Reativar produtos',
    });
  }

  // Recomendações de vendas
  if (data.salesPerformance.conversionRate < 1) {
    recommendations.push({
      type: 'info' as const,
      title: 'Taxa de conversão baixa',
      message: 'Optimize títulos e fotos dos produtos para aumentar vendas',
      action: 'Melhorar anúncios',
    });
  }

  // Recomendação positiva
  if (data.salesPerformance.salesTrend === 'crescendo') {
    recommendations.push({
      type: 'success' as const,
      title: 'Vendas em crescimento',
      message: 'Suas vendas estão crescendo! Continue o bom trabalho',
    });
  }

  return recommendations;
}