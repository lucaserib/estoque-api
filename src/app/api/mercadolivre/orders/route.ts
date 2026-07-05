// src/app/api/mercadolivre/orders/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const orderId = searchParams.get("orderId");
    const status = searchParams.get("status");
    const offset = parseInt(searchParams.get("offset") || "0");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sort = searchParams.get("sort") || "date_desc";

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
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    try {
      const accessToken = await MercadoLivreService.getValidToken(accountId);

      if (orderId) {
        // Buscar pedido específico
        const order = await MercadoLivreService.getOrder(orderId, accessToken);
        return NextResponse.json(order);
      } else {
        // Buscar lista de pedidos
        const orders = await MercadoLivreService.getUserOrders(accessToken, {
          seller: account.mlUserId,
          status: status || undefined,
          offset,
          limit,
          sort,
        });

        return NextResponse.json(orders);
      }
    } catch (error) {
      console.error("Erro ao buscar pedidos ML:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Erro ao buscar pedidos",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Erro na rota de pedidos ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
