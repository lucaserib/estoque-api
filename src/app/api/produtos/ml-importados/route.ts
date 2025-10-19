import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'pending', 'configured', 'all'

    // Buscar produtos importados do ML
    const products = await prisma.produto.findMany({
      where: {
        userId: user.id,
        ProdutoMercadoLivre: {
          some: {}, // Tem vinculação com ML
        },
      },
      include: {
        ProdutoMercadoLivre: {
          include: {
            mercadoLivreAccount: {
              select: {
                nickname: true,
                siteId: true,
              },
            },
          },
        },
        fornecedores: {
          include: {
            fornecedor: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
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
      },
    });

    // Classificar produtos por status de configuração
    const processedProducts = products.map((product) => {
      const mlProduct = product.ProdutoMercadoLivre[0];
      const hasCost = product.custoMedio && product.custoMedio > 0;
      const hasSupplier = product.fornecedores.length > 0;

      const configurationStatus = hasCost ? "configured" : "pending";

      return {
        id: product.id,
        nome: product.nome,
        sku: product.sku,
        custoMedio: product.custoMedio,
        isKit: product.isKit,
        configurationStatus,
        hasCost,
        hasSupplier,
        needsConfiguration: !hasCost,
        mlData: mlProduct
          ? {
              mlItemId: mlProduct.mlItemId,
              mlTitle: mlProduct.mlTitle,
              mlPrice: mlProduct.mlPrice / 100, // Converter de centavos
              mlStatus: mlProduct.mlStatus,
              mlThumbnail: mlProduct.mlThumbnail,
              mlPermalink: mlProduct.mlPermalink,
              isFull: mlProduct.mlShippingMode === "fulfillment",
              lastSyncAt: mlProduct.lastSyncAt,
              account: mlProduct.mercadoLivreAccount,
            }
          : null,
        suppliers: product.fornecedores.map((pf) => pf.fornecedor),
        warehouses: product.estoques.map((e) => ({
          ...e.armazem,
          quantidade: e.quantidade,
        })),
      };
    });

    // Filtrar por status se especificado
    const filteredProducts =
      status && status !== "all"
        ? processedProducts.filter((p) => p.configurationStatus === status)
        : processedProducts;

    // Estatísticas
    const stats = {
      total: processedProducts.length,
      pending: processedProducts.filter(
        (p) => p.configurationStatus === "pending"
      ).length,
      configured: processedProducts.filter(
        (p) => p.configurationStatus === "configured"
      ).length,
      fullProducts: processedProducts.filter((p) => p.mlData?.isFull).length,
      flexProducts: processedProducts.filter(
        (p) => p.mlData && !p.mlData.isFull
      ).length,
    };

    return NextResponse.json({
      products: filteredProducts,
      stats,
    });
  } catch (error) {
    console.error("Erro ao buscar produtos ML importados:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { productId, updates } = body;

    if (!productId) {
      return NextResponse.json(
        { error: "ID do produto não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se o produto pertence ao usuário
    const existingProduct = await prisma.produto.findFirst({
      where: {
        id: productId,
        userId: user.id,
      },
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    // Preparar dados para atualização
    const updateData: any = {};

    if (updates.nome !== undefined) updateData.nome = updates.nome;
    if (updates.sku !== undefined) updateData.sku = updates.sku;
    if (updates.custoMedio !== undefined) {
      updateData.custoMedio = Math.round(updates.custoMedio * 100); // Converter para centavos
    }
    if (updates.ean !== undefined) updateData.ean = updates.ean;

    // Atualizar produto
    const updatedProduct = await prisma.produto.update({
      where: { id: productId },
      data: updateData,
      include: {
        ProdutoMercadoLivre: {
          include: {
            mercadoLivreAccount: {
              select: {
                nickname: true,
                siteId: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
