import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchOrdersWithFallback, PartialOrdersError } from "@/lib/mlOrders";
import { MLOrder } from "@/types/mercadolivre";

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

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.contaId,
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

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);

    const startDateML = startDate.toISOString().split("T")[0];
    const endDateML = endDate.toISOString().split("T")[0];

    try {
      const { orders: fetchedOrders, parcial, pedidosFaltantes } =
        await fetchOrdersWithFallback({
          accessToken,
          sellerId: account.mlUserId,
          dateFrom: startDate,
          dateTo: endDate,
        });

      const allOrders: MLOrder[] = fetchedOrders.filter((order) => {
        const orderDate = new Date(order.date_created);
        return (
          order.status === "paid" &&
          orderDate >= startDate &&
          orderDate <= endDate
        );
      });
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

          const revenueInCents = Math.round(item.unit_price * item.quantity * 100);

          productSales.set(itemId, {
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + revenueInCents,
            lastSale: new Date(order.date_created) > current.lastSale 
              ? new Date(order.date_created) 
              : current.lastSale,
            orders: current.orders + 1
          });
        });
      });


      const productIds = Array.from(productSales.keys());
      
      if (productIds.length > 0) {
        await prisma.produtoMercadoLivre.updateMany({
          where: {
            mercadoLivreAccountId: accountId,
            mlItemId: { in: productIds }
          },
          data: {
            mlSoldQuantity: 0,
          },
        });

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

        }
      }

      const totalQuantity = Array.from(productSales.values()).reduce((sum, p) => sum + p.quantity, 0);
      const totalItemsRevenue = Array.from(productSales.values()).reduce((sum, p) => sum + p.revenue, 0);
      
      const totalOrderValue = allOrders.reduce((sum, order) => {
        return sum + Math.round((order.total_amount || 0) * 100);
      }, 0);
      
      const averageOrderValue = allOrders.length > 0 ? Math.round(totalOrderValue / allOrders.length) : 0;
      

      return NextResponse.json({
        success: true,
        period: `${period} dias`,
        dateRange: {
          start: startDateML,
          end: endDateML
        },
        parcial,
        pedidosFaltantes,
        summary: {
          totalOrders: allOrders.length,
          totalProducts: productSales.size,
          totalQuantity,
          totalRevenue: totalOrderValue,
          averageOrderValue
        },
        products: Array.from(productSales.entries()).map(([itemId, sales]) => ({
          itemId,
          quantity: sales.quantity,
          revenue: sales.revenue,
          orders: sales.orders,
          lastSale: sales.lastSale.toISOString(),
          avgPrice: Math.round(sales.revenue / sales.quantity)
        })).sort((a, b) => b.quantity - a.quantity)
      });

    } catch (mlError) {
      if (mlError instanceof PartialOrdersError) {
        throw mlError;
      }

      console.error("[SALES_OPTIMIZED] Erro na API ML:", mlError);
      return NextResponse.json(
        { error: "Erro ao buscar dados de vendas no Mercado Livre" },
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

    console.error("[SALES_OPTIMIZED] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
