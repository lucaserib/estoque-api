import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { accountId, mlItemId, localProductId } = body;

    if (!accountId || !mlItemId || !localProductId) {
      return NextResponse.json(
        { error: "Dados obrigatórios não fornecidos" },
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
        { error: "Conta do Mercado Livre não encontrada ou inativa" },
        { status: 404 }
      );
    }

    // Verificar se o produto local pertence ao usuário
    const localProduct = await prisma.produto.findFirst({
      where: {
        id: localProductId,
        userId: user.id,
      },
    });

    if (!localProduct) {
      return NextResponse.json(
        { error: "Produto local não encontrado" },
        { status: 404 }
      );
    }

    // Obter dados atualizados do produto ML
    let accessToken;
    try {
      accessToken = await MercadoLivreService.getValidToken(accountId);
    } catch (error) {
      console.error("Erro ao obter token de acesso:", error);
      return NextResponse.json(
        { error: "Token de acesso inválido. Reconecte sua conta do Mercado Livre." },
        { status: 401 }
      );
    }

    let mlItem;
    try {
      mlItem = await MercadoLivreService.getItem(mlItemId, accessToken);
    } catch (error) {
      console.error("Erro ao buscar produto do ML:", error);
      return NextResponse.json(
        { error: "Produto não encontrado no Mercado Livre." },
        { status: 404 }
      );
    }

    // Verificar se já existe vinculação
    const existingML = await prisma.produtoMercadoLivre.findFirst({
      where: {
        mlItemId: mlItemId,
        mercadoLivreAccountId: accountId,
      },
    });

    const productData = {
      mlTitle: mlItem.title,
      mlPrice: Math.round(mlItem.price * 100),
      mlAvailableQuantity: mlItem.available_quantity,
      mlSoldQuantity: mlItem.sold_quantity || 0,
      mlStatus: mlItem.status,
      mlCondition: mlItem.condition,
      mlListingType: mlItem.listing_type_id || "gold_special",
      mlPermalink: mlItem.permalink,
      mlThumbnail: mlItem.thumbnail,
      mlCategoryId: mlItem.category_id,
      mlLastUpdated: new Date(mlItem.last_updated || new Date()),
      lastSyncAt: new Date(),
      syncStatus: "synced",
      syncError: null,
    };

    if (existingML) {
      // Atualizar vinculação existente
      await prisma.produtoMercadoLivre.update({
        where: { id: existingML.id },
        data: {
          ...productData,
          produtoId: localProductId,
        },
      });
    } else {
      // Criar nova vinculação
      await prisma.produtoMercadoLivre.create({
        data: {
          ...productData,
          produtoId: localProductId,
          mercadoLivreAccountId: accountId,
          mlItemId: mlItemId,
        },
      });
    }

    // Sincronizar estoque do produto local para o ML
    try {
      const estoqueTotal = await prisma.estoque.aggregate({
        where: {
          produtoId: localProductId,
        },
        _sum: {
          quantidade: true,
        },
      });

      const quantidadeLocal = estoqueTotal._sum.quantidade || 0;

      // Atualizar quantidade no ML se diferente
      if (quantidadeLocal !== mlItem.available_quantity) {
        await MercadoLivreService.updateItemStock(mlItemId, quantidadeLocal, accessToken);
      }
    } catch (error) {
      console.warn("Erro ao sincronizar estoque:", error);
      // Não falhar a vinculação por causa da sincronização de estoque
    }

    return NextResponse.json({
      success: true,
      message: "Produto vinculado com sucesso",
      linkedProduct: {
        mlItemId,
        localProductId,
        localProductName: localProduct.nome,
        localProductSku: localProduct.sku,
      },
    });

  } catch (error) {
    console.error("Erro ao vincular produto:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}