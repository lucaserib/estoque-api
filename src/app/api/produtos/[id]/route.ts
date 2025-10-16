import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/produtos/[id]
 * Busca detalhes de um produto específico incluindo estoques
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID do produto não fornecido" },
        { status: 400 }
      );
    }

    // Buscar produto com estoques e vinculação ML
    const produto = await prisma.produto.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        estoques: {
          include: {
            armazem: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
        ProdutoMercadoLivre: {
          select: {
            mlItemId: true,
            mlTitle: true,
            mlAvailableQuantity: true,
            mlSoldQuantity: true,
            mlSold90Days: true,
            mlStatus: true,
            mlPrice: true,
            mlPermalink: true,
            mlThumbnail: true,
          },
        },
      },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Converter BigInt para number para serialização JSON
    const produtoSerialized = {
      ...produto,
      custoMedio: Number(produto.custoMedio),
      estoques: produto.estoques.map((estoque) => ({
        ...estoque,
        quantidade: Number(estoque.quantidade),
      })),
      ProdutoMercadoLivre: produto.ProdutoMercadoLivre.map((ml) => ({
        ...ml,
        mlPrice: ml.mlPrice ? Number(ml.mlPrice) : null,
      })),
    };

    return NextResponse.json({
      success: true,
      produto: produtoSerialized,
    });
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao buscar produto",
      },
      { status: 500 }
    );
  }
}
