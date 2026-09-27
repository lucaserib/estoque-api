import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { normalizeImageUrl } from "@/lib/imageUrl";

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
        fornecedores: {
          include: {
            fornecedor: {
              select: { id: true, nome: true, cnpj: true, contato: true },
            },
          },
          orderBy: { principal: "desc" },
        },
        pedidos: {
          include: {
            pedido: {
              select: {
                id: true,
                status: true,
                dataConclusao: true,
                fornecedor: { select: { nome: true } },
              },
            },
          },
          orderBy: { id: "desc" },
          take: 20,
        },
        detalhesSaida: {
          include: {
            saida: {
              select: { id: true, data: true },
            },
          },
          orderBy: { id: "desc" },
          take: 20,
        },
      },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const produtoSerialized = {
      ...produto,
      imagemUrl: normalizeImageUrl(produto.imagemUrl),
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
      { error: "Erro ao buscar produto" },
      { status: 500 }
    );
  }
}
