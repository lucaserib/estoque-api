import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

interface RestockSuggestion {
  priority: "critical" | "high" | "medium" | "low";
  productId: string;
  mlItemId: string;
  productName: string;
  sku: string;
  currentMLStock: number;
  currentLocalStock: number;
  suggestedRestock: number;
  salesVelocity: number; // vendas por dia
  daysUntilStockout: number;
  totalSold: number;
  lastSaleDate?: string;
  revenue: number;
  mlPrice: number;
  reasons: string[];
  actions: string[];
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const period = parseInt(searchParams.get("period") || "30"); // Período em dias para análise

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

      // Buscar produtos vinculados com consulta otimizada
      const produtosML = await prisma.produtoMercadoLivre.findMany({
        where: {
          mercadoLivreAccountId: accountId,
          produtoId: {
            not: null,
          },
          mlStatus: "active", // Apenas produtos ativos
        },
        include: {
          produto: {
            include: {
              estoques: {
                include: {
                  armazem: true,
                },
              },
              fornecedores: {
                include: {
                  fornecedor: true,
                },
                take: 1, // Apenas o primeiro fornecedor para performance
              },
            },
          },
        },
      });

      // Buscar dados de vendas do período
      const orders = await MercadoLivreService.getUserOrders(accessToken, {
        seller: account.mlUserId,
        limit: 50,
      });

      // Calcular período de análise
      const periodStart = new Date(Date.now() - period * 24 * 60 * 60 * 1000);

      // Processar vendas por produto
      const productSales = new Map<
        string,
        {
          totalSold: number;
          totalRevenue: number;
          lastSaleDate: Date;
          salesDates: Date[];
        }
      >();

      orders.results
        .filter(
          (order) =>
            order.status === "paid" &&
            new Date(order.date_created) >= periodStart
        )
        .forEach((order) => {
          order.order_items.forEach((item) => {
            const existing = productSales.get(item.item.id);
            const saleDate = new Date(order.date_created);

            if (existing) {
              existing.totalSold += item.quantity;
              existing.totalRevenue += item.unit_price * item.quantity;
              existing.salesDates.push(saleDate);
              if (saleDate > existing.lastSaleDate) {
                existing.lastSaleDate = saleDate;
              }
            } else {
              productSales.set(item.item.id, {
                totalSold: item.quantity,
                totalRevenue: item.unit_price * item.quantity,
                lastSaleDate: saleDate,
                salesDates: [saleDate],
              });
            }
          });
        });

      // Gerar sugestões de reposição
      const suggestions: RestockSuggestion[] = [];

      for (const produtoML of produtosML) {
        if (!produtoML.produto) continue;

        const salesData = productSales.get(produtoML.mlItemId);
        const totalLocalStock = produtoML.produto.estoques.reduce(
          (sum, estoque) => sum + estoque.quantidade,
          0
        );

        // Calcular velocidade de vendas
        const salesVelocity = salesData ? salesData.totalSold / period : 0;
        const daysUntilStockout =
          salesVelocity > 0
            ? Math.floor(produtoML.mlAvailableQuantity / salesVelocity)
            : 999;

        const reasons: string[] = [];
        const actions: string[] = [];
        let priority: RestockSuggestion["priority"] = "low";
        let suggestedRestock = 0;

        // Análise de prioridade e razões
        if (produtoML.mlAvailableQuantity === 0) {
          priority = "critical";
          reasons.push("Produto esgotado no ML");
          actions.push("Reabastecer imediatamente");
          suggestedRestock = Math.max(10, Math.ceil(salesVelocity * 7)); // 1 semana de vendas
        } else if (produtoML.mlAvailableQuantity <= 2 && salesVelocity > 0) {
          priority = "critical";
          reasons.push("Estoque criticamente baixo com vendas ativas");
          actions.push("Reposição urgente necessária");
          suggestedRestock = Math.max(5, Math.ceil(salesVelocity * 14)); // 2 semanas
        } else if (produtoML.mlAvailableQuantity <= 5 && salesVelocity > 0.5) {
          priority = "high";
          reasons.push("Estoque baixo com boa velocidade de vendas");
          actions.push("Programar reposição em breve");
          suggestedRestock = Math.ceil(salesVelocity * 21); // 3 semanas
        } else if (daysUntilStockout <= 7 && salesVelocity > 0) {
          priority = "high";
          reasons.push(`Estoque acabará em ${daysUntilStockout} dias`);
          actions.push("Acelerar reposição");
          suggestedRestock = Math.ceil(salesVelocity * 14);
        } else if (
          produtoML.mlAvailableQuantity < totalLocalStock &&
          totalLocalStock > 5
        ) {
          priority = "medium";
          reasons.push("Estoque local maior que ML - possível dessincronia");
          actions.push("Sincronizar estoque");
          suggestedRestock = Math.min(
            totalLocalStock,
            Math.ceil(salesVelocity * 30)
          );
        } else if (salesVelocity > 0 && produtoML.mlAvailableQuantity <= 10) {
          priority = "medium";
          reasons.push("Estoque moderado com vendas regulares");
          actions.push("Monitorar e planejar reposição");
          suggestedRestock = Math.ceil(salesVelocity * 30); // 1 mês
        }

        // Adicionar razões específicas
        if (salesData && salesData.totalSold > 10) {
          reasons.push(
            `Produto popular: ${salesData.totalSold} vendas em ${period} dias`
          );
        }

        if (totalLocalStock > produtoML.mlAvailableQuantity) {
          actions.push(
            `Transferir ${
              totalLocalStock - produtoML.mlAvailableQuantity
            } unidades do estoque local`
          );
        }

        if (produtoML.produto.fornecedores.length > 0) {
          actions.push(
            `Contatar fornecedor: ${produtoML.produto.fornecedores[0].fornecedor.nome}`
          );
        }

        // Apenas incluir produtos que precisam de atenção
        if (reasons.length > 0) {
          suggestions.push({
            priority,
            productId: produtoML.produto.id,
            mlItemId: produtoML.mlItemId,
            productName: produtoML.produto.nome,
            sku: produtoML.produto.sku,
            currentMLStock: produtoML.mlAvailableQuantity,
            currentLocalStock: totalLocalStock,
            suggestedRestock,
            salesVelocity,
            daysUntilStockout,
            totalSold: salesData?.totalSold || 0,
            lastSaleDate: salesData?.lastSaleDate?.toISOString(),
            revenue: salesData?.totalRevenue || 0,
            mlPrice: produtoML.mlPrice / 100, // Converter centavos para reais
            reasons,
            actions,
          });
        }
      }

      // Ordenar por prioridade e então por velocidade de vendas
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      suggestions.sort((a, b) => {
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.salesVelocity - a.salesVelocity;
      });

      // Estatísticas resumidas
      const summary = {
        totalProducts: produtosML.length,
        needsAttention: suggestions.length,
        critical: suggestions.filter((s) => s.priority === "critical").length,
        high: suggestions.filter((s) => s.priority === "high").length,
        medium: suggestions.filter((s) => s.priority === "medium").length,

        totalPotentialRevenue: suggestions.reduce(
          (sum, s) => sum + s.suggestedRestock * s.mlPrice,
          0
        ),
        avgSalesVelocity:
          suggestions.length > 0
            ? suggestions.reduce((sum, s) => sum + s.salesVelocity, 0) /
              suggestions.length
            : 0,

        recommendations: generateTopRecommendations(suggestions),
      };

      return NextResponse.json({
        summary,
        suggestions: suggestions.slice(0, 50), // Limitar a 50 produtos para performance
        period: {
          days: period,
          from: periodStart.toISOString(),
          to: new Date().toISOString(),
        },
      });
    } catch (mlError) {
      console.error("Erro ao buscar dados para reposição:", mlError);
      return NextResponse.json(
        {
          error: "Erro ao conectar com Mercado Livre para análise de reposição",
        },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("Erro na API de sugestões de reposição:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function generateTopRecommendations(
  suggestions: RestockSuggestion[]
): string[] {
  const recommendations = [];

  const critical = suggestions.filter((s) => s.priority === "critical").length;
  const high = suggestions.filter((s) => s.priority === "high").length;
  const fastMoving = suggestions.filter((s) => s.salesVelocity > 1).length;

  if (critical > 0) {
    recommendations.push(
      `${critical} produto(s) com estoque crítico precisam de reposição imediata`
    );
  }

  if (high > 0) {
    recommendations.push(`${high} produto(s) precisam de reposição em breve`);
  }

  if (fastMoving > 0) {
    recommendations.push(
      `${fastMoving} produto(s) têm alta velocidade de vendas`
    );
  }

  const needSync = suggestions.filter(
    (s) => s.currentLocalStock > s.currentMLStock && s.currentLocalStock > 5
  ).length;

  if (needSync > 0) {
    recommendations.push(
      `${needSync} produto(s) podem ser sincronizados com estoque local`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("Todos os produtos estão com estoque adequado");
  }

  return recommendations;
}
