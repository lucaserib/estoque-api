import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUserAtivo(request);
    const { id: produtoId } = await params;

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

    const mlProducts = await prisma.produtoMercadoLivre.findMany({
      where: {
        produtoId: produtoId,
      },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlPrice: true,
        mlAvailableQuantity: true,
        mlShippingMode: true,
        mlPermalink: true,
        mlStatus: true,
        mlThumbnail: true,
        lastSyncAt: true,
        mercadoLivreAccount: {
          select: {
            nickname: true,
          },
        },
      },
      orderBy: {
        lastSyncAt: "desc",
      },
    });

    return NextResponse.json({
      products: mlProducts,
      count: mlProducts.length,
    });
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
