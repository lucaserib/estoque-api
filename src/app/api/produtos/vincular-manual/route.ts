import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

/**
 * POST /api/produtos/vincular-manual
 * Vincula manualmente um produto local a um anúncio ML
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { mlProductId, localProductId, syncStock = false } = body;

    if (!mlProductId || !localProductId) {
      return NextResponse.json(
        { error: "IDs do produto ML e local são obrigatórios" },
        { status: 400 }
      );
    }

    // Buscar produto ML
    const mlProduct = await prisma.produtoMercadoLivre.findUnique({
      where: { id: mlProductId },
      include: {
        mercadoLivreAccount: true,
      },
    });

    if (!mlProduct) {
      return NextResponse.json(
        { error: "Produto ML não encontrado" },
        { status: 404 }
      );
    }

    // Verificar se a conta ML pertence ao usuário
    if (mlProduct.mercadoLivreAccount.userId !== user.id) {
      return NextResponse.json(
        { error: "Sem permissão para este produto ML" },
        { status: 403 }
      );
    }

    // Buscar produto local
    const localProduct = await prisma.produto.findFirst({
      where: {
        id: localProductId,
        userId: user.id,
      },
      include: {
        estoques: true,
      },
    });

    if (!localProduct) {
      return NextResponse.json(
        { error: "Produto local não encontrado" },
        { status: 404 }
      );
    }

    // Vincular produtos
    await prisma.produtoMercadoLivre.update({
      where: { id: mlProductId },
      data: {
        produtoId: localProductId,
        syncStatus: "synced",
      },
    });

    console.log(`[VINCULAÇÃO] Produto ${localProduct.sku} vinculado a ${mlProduct.mlItemId}`);

    // Sincronizar estoque se solicitado
    let stockSynced = false;
    if (syncStock) {
      try {
        const estoqueTotal = localProduct.estoques.reduce(
          (sum, e) => sum + e.quantidade,
          0
        );

        // Obter token válido do ML
        const accessToken = await MercadoLivreService.getValidToken(
          mlProduct.mercadoLivreAccountId
        );

        // Atualizar estoque no ML
        await MercadoLivreService.updateItemStock(
          mlProduct.mlItemId,
          estoqueTotal,
          accessToken
        );

        stockSynced = true;
        console.log(`[VINCULAÇÃO] Estoque sincronizado: ${estoqueTotal} unidades`);
      } catch (stockError) {
        console.error("[VINCULAÇÃO] Erro ao sincronizar estoque:", stockError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Produto vinculado com sucesso",
      data: {
        localProduct: {
          id: localProduct.id,
          sku: localProduct.sku,
          nome: localProduct.nome,
        },
        mlProduct: {
          id: mlProduct.id,
          mlItemId: mlProduct.mlItemId,
          mlTitle: mlProduct.mlTitle,
        },
        stockSynced,
      },
    });
  } catch (error) {
    console.error("Erro ao vincular produto:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao vincular produto",
      },
      { status: 500 }
    );
  }
}
