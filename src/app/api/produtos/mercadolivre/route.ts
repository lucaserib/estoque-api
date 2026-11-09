import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    const { searchParams } = new URL(request.url);
    const produtoId = searchParams.get("produtoId");

    if (!produtoId) {
      return NextResponse.json(
        { error: "ID do produto não fornecido" },
        { status: 400 }
      );
    }

    const produto = await prisma.produto.findFirst({
      where: {
        id: produtoId,
        userId: user.contaId,
      },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const produtosMl = await prisma.produtoMercadoLivre.findMany({
      where: {
        produtoId,
        mercadoLivreAccount: {
          userId: user.contaId,
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
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao buscar produtos ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
