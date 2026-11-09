import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { podeVer, permissaoErrorResponse } from "@/lib/permissoes";


export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);

    const thirtyDaysAgo = subDays(new Date(), 30);

    const pendingOrdersCount = await prisma.pedidoCompra.count({
      where: {
        userId: user.contaId,
        status: "pendente",
      },
    });

    const completedOrdersCount = await prisma.pedidoCompra.count({
      where: {
        userId: user.contaId,
        status: "confirmado",
      },
    });

    const recentCompletedOrders = await prisma.pedidoCompra.findMany({
      where: {
        userId: user.contaId,
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
        valorTotal: podeVer(user.role, "VER_CUSTO") ? totalValue : null,
      },
      { status: 200 }
    );
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao buscar estatísticas de pedidos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estatísticas de pedidos" },
      { status: 500 }
    );
  }
}
