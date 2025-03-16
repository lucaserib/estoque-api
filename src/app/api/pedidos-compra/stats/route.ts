import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    // Obtém data de 30 dias atrás para cálculos
    const thirtyDaysAgo = subDays(new Date(), 30);

    // Busca número de pedidos pendentes
    const pendingOrdersCount = await prisma.pedidoCompra.count({
      where: {
        userId: user.id,
        status: "pendente",
      },
    });

    // Busca número de pedidos concluídos
    const completedOrdersCount = await prisma.pedidoCompra.count({
      where: {
        userId: user.id,
        status: "confirmado",
      },
    });

    // Busca valor total de pedidos concluídos nos últimos 30 dias
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

    // Calcula o valor total
    let totalValue = 0;

    for (const pedido of recentCompletedOrders) {
      for (const produto of pedido.produtos) {
        const multiplicador = produto.multiplicador || 1;
        totalValue += produto.quantidade * produto.custo * multiplicador;
      }
    }

    // Retorna as estatísticas
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
