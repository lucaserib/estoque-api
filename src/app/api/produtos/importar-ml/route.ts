import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { resolverCustoProduto } from "@/lib/custo";
import { pickMlImageUrl } from "@/lib/imageUrl";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta ML não fornecido" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
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

    const accessToken = await MercadoLivreService.getValidToken(accountId);
    const mlItems = await MercadoLivreService.getUserItems(accessToken);

    const existingProducts = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
      },
      select: {
        mlItemId: true,
        produto: {
          select: {
            id: true,
            nome: true,
            sku: true,
          },
        },
      },
    });

    const existingMLIds = new Set(existingProducts.map(p => p.mlItemId));

    const newProducts = [];
    const existingProductsDetails = [];

    for (const itemId of mlItems.results) {
      try {
        const item = await MercadoLivreService.getItem(itemId, accessToken);
        
        const productData = {
          mlItemId: itemId,
          title: item.title,
          price: item.price,
          thumbnail: pickMlImageUrl(item),
          status: item.status,
          category: item.category_id,
          permalink: item.permalink,
          isFull: item.shipping?.logistic_type === "fulfillment",
          logisticType: item.shipping?.logistic_type || "custom",
          freeShipping: item.shipping?.free_shipping || false,
          condition: item.condition,
          availableQuantity: item.available_quantity,
          soldQuantity: item.sold_quantity || 0,
        };

        if (existingMLIds.has(itemId)) {
          const existingProduct = existingProducts.find(p => p.mlItemId === itemId);
          existingProductsDetails.push({
            ...productData,
            localProduct: existingProduct?.produto,
          });
        } else {
          newProducts.push(productData);
        }
      } catch (error) {
        console.error(`Erro ao buscar produto ${itemId}:`, error);
      }
    }

    return NextResponse.json({
      total: mlItems.results.length,
      newProducts,
      existingProducts: existingProductsDetails,
      summary: {
        total: mlItems.results.length,
        new: newProducts.length,
        existing: existingProductsDetails.length,
        fullProducts: newProducts.filter(p => p.isFull).length,
        flexProducts: newProducts.filter(p => !p.isFull).length,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar produtos ML para importação:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { accountId, selectedItems, defaultValues } = body;

    if (!accountId || !selectedItems || !Array.isArray(selectedItems)) {
      return NextResponse.json(
        { error: "Dados de importação inválidos" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
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

    const accessToken = await MercadoLivreService.getValidToken(accountId);
    const importedProducts = [];
    const errors = [];

    for (const itemId of selectedItems) {
      try {
        const existingMLProduct = await prisma.produtoMercadoLivre.findFirst({
          where: {
            mlItemId: itemId,
            mercadoLivreAccountId: accountId,
          },
        });

        if (existingMLProduct) {
          continue;
        }

        const item = await MercadoLivreService.getItem(itemId, accessToken);

        const baseSku = `ML_${itemId}`;
        let sku = baseSku;
        let counter = 1;

        while (
          await prisma.produto.findFirst({
            where: { sku, userId: user.id },
          })
        ) {
          sku = `${baseSku}_${counter}`;
          counter++;
        }

        const resultadoCusto = await resolverCustoProduto({
          sku,
          userId: user.id,
        });
        const imagemUrl = pickMlImageUrl(item);

        const localProduct = await prisma.produto.create({
          data: {
            nome: item.title,
            sku: sku,
            isKit: false,
            userId: user.id,
            custoMedio: resultadoCusto.custoMedio,
            custoOrigem: resultadoCusto.custoOrigem,
            custoAtualizadoEm:
              resultadoCusto.custoMedio !== null ? new Date() : null,
            ean: null,
            imagemUrl,
          },
        });

        const mlProduct = await prisma.produtoMercadoLivre.create({
          data: {
            produtoId: localProduct.id,
            mercadoLivreAccountId: accountId,
            mlItemId: itemId,
            mlTitle: item.title,
            mlPrice: Math.round(item.price * 100),
            mlAvailableQuantity: item.available_quantity,
            mlSoldQuantity: item.sold_quantity || 0,
            mlStatus: item.status,
            mlCondition: item.condition,
            mlListingType: item.listing_type_id || "gold_special",
            mlPermalink: item.permalink,
            mlThumbnail: imagemUrl,
            mlCategoryId: item.category_id,
            mlShippingMode: item.shipping?.logistic_type || "custom",
            mlAcceptsMercadoPago: item.accepts_mercadopago,
            mlFreeShipping: item.shipping?.free_shipping || false,
            lastSyncAt: new Date(),
            syncStatus: "imported",
          },
        });

        importedProducts.push({
          localProduct,
          mlProduct,
          isFull: item.shipping?.logistic_type === "fulfillment",
        });

      } catch (error) {
        console.error(`Erro ao importar produto ${itemId}:`, error);
        errors.push({
          itemId,
          error: error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedProducts.length,
      errors: errors.length,
      products: importedProducts,
      errorDetails: errors,
    });

  } catch (error) {
    console.error("Erro ao importar produtos ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}