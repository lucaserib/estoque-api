import { NextRequest, NextResponse } from "next/server";
import { StatusVendaCanal } from "@prisma/client";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { inicioDoMes, fimDoMes } from "@/modules/financeiro/dominio/periodo";

export async function GET(request: NextRequest) {
  try {

    const user = await verifyUser(request);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const sortBy = searchParams.get("sortBy") || "smart"; // smart, lastSync, sales, price, stock, name
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const filterStatus = searchParams.get("status") || "all";
    const filterStock = searchParams.get("stock") || "all";


    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }


    // Verificar se a conta pertence ao usuário
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


    // Construir filtros where
    const whereClause: Record<string, unknown> = {
      mercadoLivreAccountId: accountId,
      syncStatus: { not: { equals: "ignored" } },
    };

    if (filterStatus !== "all") {
      whereClause.mlStatus = filterStatus;
    }

    // Buscar produtos ML vinculados com consulta otimizada
    const produtosML = await prisma.produtoMercadoLivre.findMany({
      where: whereClause,
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlPrice: true,
        mlOriginalPrice: true, // ✅ NOVO: Preço original
        mlBasePrice: true, // ✅ NOVO: Preço base
        mlHasPromotion: true, // ✅ NOVO: Se tem promoção
        mlPromotionDiscount: true, // ✅ NOVO: % desconto
        mlAvailableQuantity: true,
        mlSoldQuantity: true,
        mlStatus: true,
        mlThumbnail: true,
        mlPermalink: true,
        lastSyncAt: true,
        syncStatus: true,
        mlAutoStockPausado: true,
        produto: {
          select: {
            id: true,
            nome: true,
            sku: true,
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

    // Mapear produtos com informações completas
    const products = produtosML.map((produtoML) => {
      // Calcular estoque local total
      const totalLocalStock =
        produtoML.produto?.estoques.reduce(
          (sum: number, estoque: { quantidade: number }) =>
            sum + estoque.quantidade,
          0
        ) || 0;

      // Calcular status do estoque
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

      // ✅ CORREÇÃO: Dados de vendas deste mês e mês anterior
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

        // ✅ NOVO: Informações de preços promocionais
        mlOriginalPrice: produtoML.mlOriginalPrice,
        mlBasePrice: produtoML.mlBasePrice,
        mlHasPromotion: produtoML.mlHasPromotion || false,
        mlPromotionDiscount: produtoML.mlPromotionDiscount,
        // Calcular economia se há promoção
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
        localStock: totalLocalStock,
        stockStatus,
        lastSync: produtoML.lastSyncAt?.toISOString() || "",
        syncStatus: produtoML.syncStatus,
        salesData: {
          // Este mês
          quantityThisMonth: sales.quantity,
          revenueThisMonth: sales.revenue,
          salesVelocity: sales.quantity / new Date().getDate(), // ✅ CORREÇÃO: Dias transcorridos (20), não total do mês (30)
          daysInMonth: fimEsteMs.getDate(),

          // Mês anterior
          quantityPreviousMonth: salesPreviousMonth.quantity,
          revenuePreviousMonth: salesPreviousMonth.revenue,

          // Comparações (% de variação)
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

          // Para comparação e debug
          totalHistoricalSales: produtoML.mlSoldQuantity || 0,
        },
      };

      return product;
    });

    // Aplicar filtros de estoque
    let filteredProducts = products;
    if (filterStock !== "all") {
      filteredProducts = products.filter((p) => p.stockStatus === filterStock);
    }

    // ✅ MELHORIA: Priorização inteligente otimizada
    if (sortBy === "smart") {
      filteredProducts.sort((a, b) => {
        // 0. PRIORIDADE ABSOLUTA: Produtos ativos com promoção e vendas
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

        // 1. PRIORIDADE MÁXIMA: Produtos ativos com vendas recentes (hot sellers)
        const aHotSeller =
          a.mlStatus === "active" && a.salesData.quantityThisMonth > 0;
        const bHotSeller =
          b.mlStatus === "active" && b.salesData.quantityThisMonth > 0;

        if (aHotSeller && !bHotSeller) return -1;
        if (!aHotSeller && bHotSeller) return 1;

        // 2. Entre hot sellers, priorizar por urgência de estoque
        if (aHotSeller && bHotSeller) {
          // Produtos vendendo MAS com estoque crítico = URGENTE
          const aCritical =
            (a.stockStatus === "low" || a.stockStatus === "out") &&
            a.salesData.salesVelocity > 0.1;
          const bCritical =
            (b.stockStatus === "low" || b.stockStatus === "out") &&
            b.salesData.salesVelocity > 0.1;

          if (aCritical && !bCritical) return -1;
          if (!aCritical && bCritical) return 1;

          // Depois por vendas (mais vendidos primeiro)
          const salesDiff =
            b.salesData.quantityThisMonth - a.salesData.quantityThisMonth;
          if (salesDiff !== 0) return salesDiff;
        }

        // 3. Produtos ativos (sem vendas) vêm antes de pausados
        if (a.mlStatus === "active" && b.mlStatus !== "active") return -1;
        if (a.mlStatus !== "active" && b.mlStatus === "active") return 1;

        // 4. Entre produtos ativos sem vendas, priorizar vinculados
        if (a.mlStatus === "active" && b.mlStatus === "active") {
          const aLinked = !!a.localProduct;
          const bLinked = !!b.localProduct;
          if (aLinked && !bLinked) return -1;
          if (!aLinked && bLinked) return 1;

          // Por estoque baixo (precisam atenção)
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

        // 5. Produtos não ativos: priorizar pausados com promoção
        if (a.mlStatus !== "active" && b.mlStatus !== "active") {
          // Entre produtos não ativos, promoção vem primeiro
          if (a.mlHasPromotion && !b.mlHasPromotion) return -1;
          if (!a.mlHasPromotion && b.mlHasPromotion) return 1;
        }

        // 6. Produtos não ativos por status (paused antes de closed)
        const statusPriority: Record<string, number> = {
          active: 1,
          paused: 2,
          closed: 3,
          under_review: 4,
        };
        const statusDiff =
          (statusPriority[a.mlStatus] || 5) - (statusPriority[b.mlStatus] || 5);
        if (statusDiff !== 0) return statusDiff;

        // 6. Por última atualização (mais recente primeiro)
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
      return { mlSoldQuantity: direction }; // Fallback para vendas totais do ML
    default:
      return { lastSyncAt: "desc" };
  }
}
