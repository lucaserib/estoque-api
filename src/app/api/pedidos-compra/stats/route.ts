import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const thirtyDaysAgo = subDays(new Date(), 30);

    const pendingOrdersCount = await prisma.pedidoCompra.count({
      where: {
        userId: user.id,
        status: "pendente",
      },
    });

    const completedOrdersCount = await prisma.pedidoCompra.count({
      where: {
        userId: user.id,
        status: "confirmado",
      },
    });

    const recentCompletedOrders = await prisma.pedidoCompra.findMany({
      where: {
        userId: user.id,
        status: "confirmado",
        dataConclusao: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        produtos: true,
      },
    });

    let totalValue = 0;

    for (const pedido of recentCompletedOrders) {
      for (const produto of pedido.produtos) {
        const multiplicador = produto.multiplicador || 1;
        totalValue += produto.quantidade * produto.custo * multiplicador;
      }
    }

    return NextResponse.json(
      {
        pendentes: pendingOrdersCount,
        concluidos: completedOrdersCount,
        valorTotal: totalValue,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao buscar estatísticas de pedidos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas de pedidos" },
      { status: 500 }
    );
  }
}
