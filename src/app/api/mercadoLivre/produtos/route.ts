import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function GET(request: NextRequest) {
  try {
    console.log("[PRODUTOS_API] 🚀 Iniciando requisição...");

    const user = await verifyUser(request);
    console.log("[PRODUTOS_API] ✅ Usuário verificado:", user.id);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const sortBy = searchParams.get("sortBy") || "smart"; // smart, lastSync, sales, price, stock, name
    const sortOrder = searchParams.get("sortOrder") || "desc";
    const filterStatus = searchParams.get("status") || "all";
    const filterStock = searchParams.get("stock") || "all";

    console.log("[PRODUTOS_API] 📋 Parâmetros:", {
      accountId,
      sortBy,
      sortOrder,
      filterStatus,
      filterStock,
    });

    if (!accountId) {
      console.log("[PRODUTOS_API] ❌ Account ID não fornecido");
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    console.log("[PRODUTOS_API] 🔍 Buscando conta ML...");

    // Verificar se a conta pertence ao usuário
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!account) {
      console.log("[PRODUTOS_API] ❌ Conta não encontrada ou inativa");
      return NextResponse.json(
        { error: "Conta do Mercado Livre não encontrada ou inativa" },
        { status: 404 }
      );
    }

    console.log("[PRODUTOS_API] ✅ Conta encontrada:", account.mlUserId);

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

    // Buscar dados de vendas se necessário (para ordenação por vendas)
    const salesData: Map<string, { quantity: number; revenue: number }> =
      new Map();
    let salesDataPreviousMonth: Map<
      string,
      { quantity: number; revenue: number }
    > = new Map();

    // Declarar datas no escopo correto - CORREÇÃO CRÍTICA de timezone
    const hoje = new Date();
    const inicioEsteMs = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimEsteMs = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0); // Último dia do mês atual

    // Ajustar para final do dia sem problemas de timezone
    fimEsteMs.setHours(23, 59, 59, 999);

    console.log("[PRODUTOS_API] 📊 Verificando se deve buscar vendas...");

    // ✅ CORREÇÃO: Sempre buscar dados de vendas para mostrar informações completas
    if (
      sortBy === "sales" ||
      sortBy === "smart" ||
      filterStatus === "active" ||
      sortBy === "lastSync"
    ) {
      try {
        console.log(
          `[PRODUTOS_API] 🔍 Buscando dados de vendas para ordenação...`
        );

        const accessToken = await MercadoLivreService.getValidToken(accountId);
        console.log("[PRODUTOS_API] ✅ Token obtido para vendas");

        // ✅ CORREÇÃO CRÍTICA: Buscar TODOS os pedidos com paginação completa
        console.log(
          "[PRODUTOS_API] 📦 Buscando TODOS os pedidos com paginação..."
        );

        const allOrders = [];
        let offset = 0;
        const limit = 50;
        let hasMore = true;

        while (hasMore && offset < 1000) {
          // Máximo 1000 pedidos (20 páginas)
          try {
            const batchOrders = await MercadoLivreService.getUserOrders(
              accessToken,
              {
                seller: account.mlUserId,
                offset,
                limit,
                sort: "date_desc",
              }
            );

            allOrders.push(...batchOrders.results);
            console.log(
              `[PRODUTOS_API] Página offset ${offset}: +${batchOrders.results.length} pedidos`
            );

            // Se retornou menos que o limite, chegamos ao fim
            hasMore = batchOrders.results.length === limit;
            offset += limit;

            // Delay para não sobrecarregar a API
            await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (batchError) {
            console.log(
              `[PRODUTOS_API] ❌ Erro na página ${offset}:`,
              batchError
            );
            break;
          }
        }

        const orders = {
          results: allOrders,
          paging: { total: allOrders.length },
        };

        console.log(
          "[PRODUTOS_API] ✅ Pedidos obtidos:",
          orders.results?.length
        );

        // ✅ CORREÇÃO CRÍTICA: Processar vendas DESTE MÊS (não últimos 30 dias)
        // inicioEsteMs e fimEsteMs já declarados no escopo superior

        const validStatuses = [
          "paid",
          "delivered",
          "ready_to_ship",
          "shipped",
          "handling",
        ];

        console.log("[PRODUTOS_API] 📅 Processando vendas DESTE MÊS...");
        console.log(
          `[PRODUTOS_API] 📅 Período: ${inicioEsteMs
            .getDate()
            .toString()
            .padStart(2, "0")}/${(inicioEsteMs.getMonth() + 1)
            .toString()
            .padStart(2, "0")} até ${fimEsteMs
            .getDate()
            .toString()
            .padStart(2, "0")}/${(fimEsteMs.getMonth() + 1)
            .toString()
            .padStart(2, "0")}`
        );
        console.log(
          `[PRODUTOS_API] 📅 Dias no mês: ${fimEsteMs.getDate()} | Hoje: dia ${new Date().getDate()}`
        );

        const validOrders = orders.results.filter((order) => {
          const orderDate = new Date(order.date_created);
          return (
            validStatuses.includes(order.status) &&
            orderDate >= inicioEsteMs &&
            orderDate <= fimEsteMs
          );
        });

        console.log(
          `[PRODUTOS_API] ✅ ${validOrders.length} pedidos válidos DESTE MÊS`
        );

        validOrders.forEach((order) => {
          order.order_items.forEach((item) => {
            const existing = salesData.get(item.item.id);
            // ✅ CORREÇÃO CRÍTICA: item.unit_price da API de pedidos vem com valor reduzido
            // Precisa multiplicar por 100 para ficar compatível com nossos preços em centavos
            const unitPriceInCents = (item.unit_price || 0) * 100;
            const itemRevenue = unitPriceInCents * item.quantity;

            if (existing) {
              existing.quantity += item.quantity;
              existing.revenue += itemRevenue;
            } else {
              salesData.set(item.item.id, {
                quantity: item.quantity,
                revenue: itemRevenue,
              });
            }

            // Debug: Log vendas encontradas com preço correto
            console.log(
              `[PRODUTOS_API] 💰 ${item.item.id}: +${
                item.quantity
              } unid. @ R$ ${(unitPriceInCents / 100).toFixed(
                2
              )} (Revenue: +R$ ${(itemRevenue / 100).toFixed(2)})`
            );
          });
        });

        console.log(
          `[PRODUTOS_API] 📊 Vendas processadas para ${salesData.size} produtos únicos`
        );

        // ✅ NOVO: Buscar dados do MÊS ANTERIOR para comparação
        console.log(
          "[PRODUTOS_API] 📈 Buscando dados do mês anterior para comparação..."
        );

        const inicioMsAnterior = new Date(
          hoje.getFullYear(),
          hoje.getMonth() - 1,
          1
        );
        const fimMsAnterior = new Date(
          hoje.getFullYear(),
          hoje.getMonth(),
          0,
          23,
          59,
          59
        );

        console.log(
          `[PRODUTOS_API] 📅 Mês anterior: ${
            inicioMsAnterior.toISOString().split("T")[0]
          } até ${fimMsAnterior.toISOString().split("T")[0]}`
        );

        // ✅ CORREÇÃO: Usar os pedidos já coletados (evitar busca duplicada)
        console.log(
          `[PRODUTOS_API] 📦 Usando pedidos já coletados: ${allOrders.length}`
        );

        const previousMonthValidOrders = allOrders.filter((order) => {
          const orderDate = new Date(order.date_created);
          return (
            validStatuses.includes(order.status) &&
            orderDate >= inicioMsAnterior &&
            orderDate <= fimMsAnterior
          );
        });

        // Processar vendas do mês anterior
        salesDataPreviousMonth = new Map();

        previousMonthValidOrders.forEach((order) => {
          order.order_items.forEach((item) => {
            const existing = salesDataPreviousMonth.get(item.item.id);
            const unitPriceInCents = (item.unit_price || 0) * 100;
            const itemRevenue = unitPriceInCents * item.quantity;

            if (existing) {
              existing.quantity += item.quantity;
              existing.revenue += itemRevenue;
            } else {
              salesDataPreviousMonth.set(item.item.id, {
                quantity: item.quantity,
                revenue: itemRevenue,
              });
            }
          });
        });

        console.log(
          `[PRODUTOS_API] 📊 Mês anterior: ${previousMonthValidOrders.length} pedidos, ${salesDataPreviousMonth.size} produtos únicos`
        );
      } catch (error) {
        console.warn("Erro ao buscar dados de vendas para ordenação:", error);
      }
    }

    // ✅ DEBUGGING DETALHADO: Verificar dados reais
    const produtosComPromocao = produtosML.filter((p) => p.mlHasPromotion);
    console.log(`[PRODUTOS_API] 🔍 DEBUGGING DETALHADO:`);
    console.log(
      `[PRODUTOS_API] Total de produtos carregados: ${produtosML.length}`
    );
    console.log(
      `[PRODUTOS_API] Produtos com promoção: ${produtosComPromocao.length}`
    );

    if (produtosComPromocao.length > 0) {
      console.log(`[PRODUTOS_API] 🏷️ PRODUTOS COM PROMOÇÃO:`);
      produtosComPromocao.forEach((p) => {
        console.log(
          `[PRODUTOS_API] - ${p.mlItemId}: R$ ${(p.mlPrice / 100).toFixed(
            2
          )} (original: R$ ${(p.mlOriginalPrice / 100).toFixed(2)}) - ${
            p.mlPromotionDiscount
          }% OFF`
        );
      });
    }

    // Debug das vendas também
    console.log(
      `[PRODUTOS_API] 📊 DEBUGGING VENDAS - Data hoje: ${
        new Date().toISOString().split("T")[0]
      }`
    );
    console.log(
      `[PRODUTOS_API] 📊 Período setembro: ${
        inicioEsteMs.toISOString().split("T")[0]
      } até ${fimEsteMs.toISOString().split("T")[0]}`
    );

    // Mapear produtos com informações completas
    const products = produtosML.map((produtoML) => {
      // Calcular estoque local total
      const totalLocalStock =
        produtoML.produto?.estoques.reduce(
          (sum: number, estoque: any) => sum + estoque.quantidade,
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

      // Log de debug para produtos com vendas
      if (sales.quantity > 0) {
        console.log(
          `[PRODUTOS_API] 🛍️ ${produtoML.mlItemId}: ${sales.quantity} vendas neste mês`
        );
      }

      const product = {
        mlItemId: produtoML.mlItemId,
        mlTitle: produtoML.mlTitle,
        mlPrice: produtoML.mlPrice,

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
