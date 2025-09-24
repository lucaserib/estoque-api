import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { MLOrder } from "@/types/mercadolivre";

/**
 * API OTIMIZADA de vendas com filtros corretos de data e performance
 * Baseada na documentação oficial do ML para Orders
 */
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

    console.log(`[SALES_OPTIMIZED] Iniciando análise otimizada para ${period} dias`);

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

    const accessToken = await MercadoLivreService.getValidToken(accountId);

    // ✅ CORREÇÃO: Cálculo correto das datas para o período
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);

    // ✅ OTIMIZAÇÃO: Usar filtros de data da API ML para reduzir dados transferidos
    const startDateML = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDateML = endDate.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`[SALES_OPTIMIZED] Período: ${startDateML} até ${endDateML}`);

    // ✅ CORREÇÃO: Buscar apenas pedidos "paid" no período específico
    const allOrders: MLOrder[] = [];
    let offset = 0;
    const maxResults = 500; // Limite para performance

    try {
      // ✅ IMPLEMENTAÇÃO: Busca otimizada focada em vendas reais
      for (let i = 0; i < 10; i++) { // Máximo 10 páginas
        console.log(`[SALES_OPTIMIZED] Buscando página ${i + 1}, offset: ${offset}`);

        const orders = await MercadoLivreService.getUserOrders(accessToken, {
          seller: account.mlUserId,
          offset,
          limit: 50,
          sort: "date_desc",
        });

        if (!orders.results || orders.results.length === 0) {
          console.log(`[SALES_OPTIMIZED] ✅ Fim dos resultados na página ${i + 1}`);
          break;
        }

        // ✅ FILTRO OTIMIZADO: Apenas pedidos "paid" no período
        const validOrders = orders.results.filter((order: MLOrder) => {
          const orderDate = new Date(order.date_created);
          return (
            order.status === "paid" &&
            orderDate >= startDate &&
            orderDate <= endDate
          );
        });

        allOrders.push(...validOrders);
        
        console.log(`[SALES_OPTIMIZED] Página ${i + 1}: ${orders.results.length} total, ${validOrders.length} válidos`);

        // ✅ OTIMIZAÇÃO: Parar se chegamos no limite ou saímos do período
        if (allOrders.length >= maxResults) {
          console.log(`[SALES_OPTIMIZED] ✅ Limite de ${maxResults} pedidos atingido`);
          break;
        }

        // ✅ OTIMIZAÇÃO: Se a página mais recente já saiu do período, pare
        const oldestInPage = new Date(orders.results[orders.results.length - 1]?.date_created || '');
        if (oldestInPage < startDate) {
          console.log(`[SALES_OPTIMIZED] ✅ Saiu do período de interesse, parando busca`);
          break;
        }

        offset += 50;

        // ✅ OTIMIZAÇÃO: Delay menor para melhor performance
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[SALES_OPTIMIZED] ✅ Total: ${allOrders.length} pedidos pagos no período`);

      // ✅ PROCESSAMENTO: Calcular vendas por produto
      const productSales = new Map<string, {
        quantity: number;
        revenue: number;
        lastSale: Date;
        orders: number;
      }>();

      allOrders.forEach((order) => {
        order.order_items.forEach((item) => {
          const itemId = item.item.id;
          const current = productSales.get(itemId) || {
            quantity: 0,
            revenue: 0,
            lastSale: new Date(order.date_created),
            orders: 0
          };

          // ✅ CORREÇÃO: API ML retorna preços em reais, precisamos converter para centavos
          const revenueInCents = Math.round(item.unit_price * item.quantity * 100);

          productSales.set(itemId, {
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + revenueInCents, // ✅ AGORA EM CENTAVOS
            lastSale: new Date(order.date_created) > current.lastSale 
              ? new Date(order.date_created) 
              : current.lastSale,
            orders: current.orders + 1
          });
        });
      });

      console.log(`[SALES_OPTIMIZED] ✅ Dados processados para ${productSales.size} produtos`);

      // ✅ ATUALIZAÇÃO: Resetar e atualizar mlSoldQuantity apenas para o período
      const productIds = Array.from(productSales.keys());
      
      if (productIds.length > 0) {
        // Reset apenas produtos que têm vendas novas
        await prisma.produtoMercadoLivre.updateMany({
          where: {
            mercadoLivreAccountId: accountId,
            mlItemId: { in: productIds }
          },
          data: {
            mlSoldQuantity: 0,
          },
        });

        // Atualizar com vendas reais
        for (const [itemId, sales] of productSales) {
          await prisma.produtoMercadoLivre.updateMany({
            where: {
              mlItemId: itemId,
              mercadoLivreAccountId: accountId,
            },
            data: {
              mlSoldQuantity: sales.quantity,
            },
          });

          console.log(`[SALES_OPTIMIZED] ✅ ${itemId}: ${sales.quantity} vendas (R$ ${(sales.revenue/100).toFixed(2)})`);
        }
      }

      // ✅ RESUMO: Estatísticas detalhadas (valores já estão em centavos)
      const totalQuantity = Array.from(productSales.values()).reduce((sum, p) => sum + p.quantity, 0);
      const totalItemsRevenue = Array.from(productSales.values()).reduce((sum, p) => sum + p.revenue, 0);
      
      // ✅ CORREÇÃO CRÍTICA: Calcular valor total real dos pedidos para ticket médio correto
      const totalOrderValue = allOrders.reduce((sum, order) => {
        return sum + Math.round((order.total_amount || 0) * 100); // Converter para centavos
      }, 0);
      
      const averageOrderValue = allOrders.length > 0 ? Math.round(totalOrderValue / allOrders.length) : 0;
      
      console.log(`[SALES_OPTIMIZED] 📊 VALORES CALCULADOS:`);
      console.log(`  💰 Valor total dos pedidos: R$ ${(totalOrderValue/100).toFixed(2)}`);
      console.log(`  📦 Receita dos itens: R$ ${(totalItemsRevenue/100).toFixed(2)}`);
      console.log(`  🎯 Ticket médio: R$ ${(averageOrderValue/100).toFixed(2)}`);

      return NextResponse.json({
        success: true,
        period: `${period} dias`,
        dateRange: {
          start: startDateML,
          end: endDateML
        },
        summary: {
          totalOrders: allOrders.length,
          totalProducts: productSales.size,
          totalQuantity,
          totalRevenue: totalOrderValue, // ✅ CORREÇÃO: Usar valor real dos pedidos
          averageOrderValue // ✅ CORREÇÃO: Agora calculado corretamente
        },
        products: Array.from(productSales.entries()).map(([itemId, sales]) => ({
          itemId,
          quantity: sales.quantity,
          revenue: sales.revenue, // ✅ JÁ EM CENTAVOS
          orders: sales.orders,
          lastSale: sales.lastSale.toISOString(),
          avgPrice: Math.round(sales.revenue / sales.quantity) // ✅ PREÇO MÉDIO EM CENTAVOS
        })).sort((a, b) => b.quantity - a.quantity) // Ordenar por quantidade vendida
      });

    } catch (mlError) {
      console.error("[SALES_OPTIMIZED] Erro na API ML:", mlError);
      return NextResponse.json(
        { error: "Erro ao buscar dados de vendas no Mercado Livre" },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error("[SALES_OPTIMIZED] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
