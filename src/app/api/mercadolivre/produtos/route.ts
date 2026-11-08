import { NextRequest, NextResponse } from "next/server";
import { StatusVendaCanal } from "@prisma/client";
import { descreverComposicao, INCLUDE_COMPOSICAO } from "@/modules/catalogo/vinculos";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { inicioDoMes, fimDoMes } from "@/modules/financeiro/dominio/periodo";

export async function GET(request: NextRequest) {
  try {

    const user = await verifyUser(request);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const sortBy = searchParams.get("sortBy") || "smart";
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const filterStatus = searchParams.get("status") || "all";
    const filterStock = searchParams.get("stock") || "all";

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.contaId,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta do Mercado Livre não encontrada ou inativa" },
        { status: 404 }
      );
    }

    const whereClause: Record<string, unknown> = {
      mercadoLivreAccountId: accountId,
      syncStatus: { not: { equals: "ignored" } },
    };

    if (filterStatus !== "all") {
      whereClause.mlStatus = filterStatus;
    }

    const produtosML = await prisma.produtoMercadoLivre.findMany({
      where: whereClause,
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlPrice: true,
        mlOriginalPrice: true,
        mlBasePrice: true,
        mlHasPromotion: true,
        mlPromotionDiscount: true,
        mlAvailableQuantity: true,
        mlSoldQuantity: true,
        mlStatus: true,
        mlThumbnail: true,
        mlPermalink: true,
        lastSyncAt: true,
        syncStatus: true,
        mlAutoStockPausado: true,
        mlSellerSku: true,
        produto: {
          select: {
            id: true,
            nome: true,
            sku: true,
            isKit: true,
            ...INCLUDE_COMPOSICAO,
            estoques: {
              select: {
                quantidade: true,
              },
            },
          },
        },
      },
      orderBy:
        sortBy === "smart"
          ? { lastSyncAt: "desc" }
          : sortBy === "name"
          ? { mlTitle: sortOrder as "asc" | "desc" }
          : sortBy === "price"
          ? { mlPrice: sortOrder as "asc" | "desc" }
          : sortBy === "stock"
          ? { mlAvailableQuantity: sortOrder as "asc" | "desc" }
          : { lastSyncAt: sortOrder as "asc" | "desc" },
    });

    const salesData: Map<string, { quantity: number; revenue: number }> = new Map();
    const salesDataPreviousMonth: Map<string, { quantity: number; revenue: number }> = new Map();

    const hoje = new Date();
    const inicioEsteMs = inicioDoMes(hoje);
    const fimEsteMs = fimDoMes(hoje);
    const mesAnteriorRef = new Date(inicioEsteMs.getTime() - 1);
    const DIA_MS = 24 * 60 * 60 * 1000;
    const diasNoMes = Math.round((fimEsteMs.getTime() + 1 - inicioEsteMs.getTime()) / DIA_MS);
    const diasDecorridosNoMes = Math.max(1, Math.ceil((hoje.getTime() - inicioEsteMs.getTime()) / DIA_MS));
    const inicioMsAnterior = inicioDoMes(mesAnteriorRef);
    const fimMsAnterior = fimDoMes(mesAnteriorRef);

    const itensVendidos = await prisma.vendaCanalItem.findMany({
      where: {
        venda: {
          userId: user.contaId,
          canal: "MERCADO_LIVRE",
          status: { in: [StatusVendaCanal.PAGA, StatusVendaCanal.DEVOLVIDA_PARCIAL, StatusVendaCanal.EM_MEDIACAO] },
          dataVenda: { gte: inicioMsAnterior, lte: fimEsteMs },
        },
      },
      select: {
        anuncioExternoId: true,
        quantidade: true,
        precoUnitario: true,
        venda: { select: { dataVenda: true } },
      },
    });

    for (const item of itensVendidos) {
      const estaNesteMes = item.venda.dataVenda >= inicioEsteMs && item.venda.dataVenda <= fimEsteMs;
      const mapa = estaNesteMes ? salesData : salesDataPreviousMonth;
      const atual = mapa.get(item.anuncioExternoId) ?? { quantity: 0, revenue: 0 };
      atual.quantity += item.quantidade;
      atual.revenue += item.precoUnitario * item.quantidade;
      mapa.set(item.anuncioExternoId, atual);
    }

    const products = produtosML.map((produtoML) => {
      const totalLocalStock =
        produtoML.produto?.estoques.reduce(
          (sum: number, estoque: { quantidade: number }) =>
            sum + estoque.quantidade,
          0
        ) || 0;

      let stockStatus = "unlinked";
      if (produtoML.produto && !produtoML.produto.sku.startsWith("ML_")) {
        if (produtoML.mlAvailableQuantity === 0) {
          stockStatus = "out";
        } else if (produtoML.mlAvailableQuantity <= 5) {
          stockStatus = "low";
        } else {
          stockStatus = "ok";
        }
      }

      const sales = salesData.get(produtoML.mlItemId) || {
        quantity: 0,
        revenue: 0,
      };

      const salesPreviousMonth = salesDataPreviousMonth?.get(
        produtoML.mlItemId
      ) || {
        quantity: 0,
        revenue: 0,
      };

      const product = {
        id: produtoML.id,
        mlItemId: produtoML.mlItemId,
        mlTitle: produtoML.mlTitle,
        mlPrice: produtoML.mlPrice,
        mlAutoStockPausado: produtoML.mlAutoStockPausado,

        mlOriginalPrice: produtoML.mlOriginalPrice,
        mlBasePrice: produtoML.mlBasePrice,
        mlHasPromotion: produtoML.mlHasPromotion || false,
        mlPromotionDiscount: produtoML.mlPromotionDiscount,
        mlSavings:
          produtoML.mlHasPromotion && produtoML.mlOriginalPrice
            ? produtoML.mlOriginalPrice - produtoML.mlPrice
            : 0,

        mlAvailableQuantity: produtoML.mlAvailableQuantity,
        mlSoldQuantity: produtoML.mlSoldQuantity,
        mlStatus: produtoML.mlStatus,
        mlThumbnail: produtoML.mlThumbnail,
        mlPermalink: produtoML.mlPermalink,
        localProduct:
          produtoML.produto && !produtoML.produto.sku.startsWith("ML_")
            ? {
                id: produtoML.produto.id,
                nome: produtoML.produto.nome,
                sku: produtoML.produto.sku,
              }
            : null,
        mlSellerSku: produtoML.mlSellerSku,
        composicao: produtoML.produto ? descreverComposicao(produtoML.produto) : null,
        localStock: totalLocalStock,
        stockStatus,
        lastSync: produtoML.lastSyncAt?.toISOString() || "",
        syncStatus: produtoML.syncStatus,
        salesData: {
          quantityThisMonth: sales.quantity,
          revenueThisMonth: sales.revenue,
          salesVelocity: sales.quantity / diasDecorridosNoMes,
          daysInMonth: diasNoMes,

          quantityPreviousMonth: salesPreviousMonth.quantity,
          revenuePreviousMonth: salesPreviousMonth.revenue,

          quantityGrowth:
            salesPreviousMonth.quantity > 0
              ? ((sales.quantity - salesPreviousMonth.quantity) /
                  salesPreviousMonth.quantity) *
                100
              : sales.quantity > 0
              ? 100
              : 0,
          revenueGrowth:
            salesPreviousMonth.revenue > 0
              ? ((sales.revenue - salesPreviousMonth.revenue) /
                  salesPreviousMonth.revenue) *
                100
              : sales.revenue > 0
              ? 100
              : 0,

          totalHistoricalSales: produtoML.mlSoldQuantity || 0,
        },
      };

      return product;
    });

    let filteredProducts = products;
    if (filterStock !== "all") {
      filteredProducts = products.filter((p) => p.stockStatus === filterStock);
    }

    if (sortBy === "smart") {
      filteredProducts.sort((a, b) => {
        const aActivePromo =
          a.mlStatus === "active" &&
          a.mlHasPromotion &&
          a.salesData.quantityThisMonth > 0;
        const bActivePromo =
          b.mlStatus === "active" &&
          b.mlHasPromotion &&
          b.salesData.quantityThisMonth > 0;

        if (aActivePromo && !bActivePromo) return -1;
        if (!aActivePromo && bActivePromo) return 1;

        const aHotSeller =
          a.mlStatus === "active" && a.salesData.quantityThisMonth > 0;
        const bHotSeller =
          b.mlStatus === "active" && b.salesData.quantityThisMonth > 0;

        if (aHotSeller && !bHotSeller) return -1;
        if (!aHotSeller && bHotSeller) return 1;

        if (aHotSeller && bHotSeller) {
          const aCritical =
            (a.stockStatus === "low" || a.stockStatus === "out") &&
            a.salesData.salesVelocity > 0.1;
          const bCritical =
            (b.stockStatus === "low" || b.stockStatus === "out") &&
            b.salesData.salesVelocity > 0.1;

          if (aCritical && !bCritical) return -1;
          if (!aCritical && bCritical) return 1;

          const salesDiff =
            b.salesData.quantityThisMonth - a.salesData.quantityThisMonth;
          if (salesDiff !== 0) return salesDiff;
        }

        if (a.mlStatus === "active" && b.mlStatus !== "active") return -1;
        if (a.mlStatus !== "active" && b.mlStatus === "active") return 1;

        if (a.mlStatus === "active" && b.mlStatus === "active") {
          const aLinked = !!a.localProduct;
          const bLinked = !!b.localProduct;
          if (aLinked && !bLinked) return -1;
          if (!aLinked && bLinked) return 1;

          if (a.stockStatus !== b.stockStatus) {
            const stockPriority: Record<string, number> = {
              low: 1,
              ok: 2,
              out: 3,
              unlinked: 4,
            };
            return (
              (stockPriority[a.stockStatus] || 5) -
              (stockPriority[b.stockStatus] || 5)
            );
          }
        }

        if (a.mlStatus !== "active" && b.mlStatus !== "active") {
          if (a.mlHasPromotion && !b.mlHasPromotion) return -1;
          if (!a.mlHasPromotion && b.mlHasPromotion) return 1;
        }

        const statusPriority: Record<string, number> = {
          active: 1,
          paused: 2,
          closed: 3,
          under_review: 4,
        };
        const statusDiff =
          (statusPriority[a.mlStatus] || 5) - (statusPriority[b.mlStatus] || 5);
        if (statusDiff !== 0) return statusDiff;

        return new Date(b.lastSync).getTime() - new Date(a.lastSync).getTime();
      });
    } else if (sortBy === "sales") {
      filteredProducts.sort((a, b) => {
        const aValue = a.salesData.quantityThisMonth;
        const bValue = b.salesData.quantityThisMonth;
        return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
      });
    } else if (sortBy === "revenue") {
      filteredProducts.sort((a, b) => {
        const aValue = a.salesData.revenueThisMonth;
        const bValue = b.salesData.revenueThisMonth;
        return sortOrder === "desc" ? bValue - aValue : aValue - bValue;
      });
    }

    return NextResponse.json({
      products: filteredProducts,
      total: filteredProducts.length,
      filters: {
        sortBy,
        sortOrder,
        status: filterStatus,
        stock: filterStock,
      },
      summary: {
        total: products.length,
        active: products.filter((p) => p.mlStatus === "active").length,
        paused: products.filter((p) => p.mlStatus === "paused").length,
        closed: products.filter((p) => p.mlStatus === "closed").length,
        underReview: products.filter((p) => p.mlStatus === "under_review")
          .length,
        lowStock: products.filter((p) => p.stockStatus === "low").length,
        outOfStock: products.filter((p) => p.stockStatus === "out").length,
        unlinked: products.filter((p) => p.stockStatus === "unlinked").length,
        withSales: products.filter((p) => p.salesData.quantityThisMonth > 0)
          .length,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar produtos ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

function getOrderBy(sortBy: string, sortOrder: string) {
  const direction = sortOrder === "desc" ? "desc" : "asc";

  switch (sortBy) {
    case "name":
      return { mlTitle: direction };
    case "price":
      return { mlPrice: direction };
    case "stock":
      return { mlAvailableQuantity: direction };
    case "lastSync":
      return { lastSyncAt: direction };
    case "sales":
      return { mlSoldQuantity: direction };
    default:
      return { lastSyncAt: "desc" };
  }
}
