import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/produtos/pendentes
 * Busca produtos ML sem vínculo local e produtos locais disponíveis
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const mlAccountId = searchParams.get("mlAccountId");

    if (!mlAccountId) {
      return NextResponse.json(
        { error: "ID da conta ML não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se a conta pertence ao usuário
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: mlAccountId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta ML não encontrada" },
        { status: 404 }
      );
    }

    // Buscar produtos ML sem vínculo ou com status pending_link
    const produtosPendentes = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: mlAccountId,
        OR: [
          { produtoId: null },
          { syncStatus: "pending_link" },
        ],
      },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlPrice: true,
        mlAvailableQuantity: true,
        mlThumbnail: true,
        mlPermalink: true,
        mlStatus: true,
        mlShippingMode: true,
      },
      orderBy: {
        mlTitle: "asc",
      },
    });

    // Buscar produtos locais disponíveis para vinculação
    const produtosLocais = await prisma.produto.findMany({
      where: {
        userId: user.id,
        isKit: false,
      },
      select: {
        id: true,
        sku: true,
        nome: true,
        ean: true,
        estoques: {
          select: {
            quantidade: true,
          },
        },
      },
      orderBy: {
        nome: "asc",
      },
    });

    // Calcular estoque total para cada produto
    const produtosComEstoque = produtosLocais.map((produto) => ({
      id: produto.id,
      sku: produto.sku,
      nome: produto.nome,
      ean: produto.ean?.toString() || null,
      estoqueTotal: produto.estoques.reduce(
        (sum, e) => sum + e.quantidade,
        0
      ),
    }));

    return NextResponse.json({
      pendentes: produtosPendentes,
      locais: produtosComEstoque,
      summary: {
        totalPendentes: produtosPendentes.length,
        totalLocais: produtosComEstoque.length,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar produtos pendentes:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
