import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const mlAccountId = searchParams.get("mlAccountId");

    const account = mlAccountId
      ? await prisma.mercadoLivreAccount.findFirst({
          where: { id: mlAccountId, userId: user.contaId, isActive: true },
        })
      : await prisma.mercadoLivreAccount.findFirst({
          where: { userId: user.contaId, isActive: true },
          orderBy: { createdAt: "desc" },
        });

    if (!account) {
      return NextResponse.json(
        { error: "Nenhuma conta do Mercado Livre ativa encontrada" },
        { status: 404 }
      );
    }

    const produtosPendentes = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: account.id,
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

    const produtosLocais = await prisma.produto.findMany({
      where: {
        userId: user.contaId,
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
