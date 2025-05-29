// src/app/api/produtos/mercadolivre/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const produtoId = searchParams.get("produtoId");

    if (!produtoId) {
      return NextResponse.json(
        { error: "ID do produto não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se o produto pertence ao usuário
    const produto = await prisma.produto.findFirst({
      where: {
        id: produtoId,
        userId: user.id,
      },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Buscar produtos ML vinculados
    const produtosMl = await prisma.produtoMercadoLivre.findMany({
      where: {
        produtoId,
        mercadoLivreAccount: {
          userId: user.id,
          isActive: true,
        },
      },
      include: {
        mercadoLivreAccount: {
          select: {
            nickname: true,
            siteId: true,
          },
        },
      },
      orderBy: {
        lastSyncAt: "desc",
      },
    });

    return NextResponse.json(produtosMl);
  } catch (error) {
    console.error("Erro ao buscar produtos ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
