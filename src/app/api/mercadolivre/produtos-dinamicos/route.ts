import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { prisma } from "@/lib/prisma";
import { pickMlImageUrl } from "@/lib/imageUrl";
import { fetchMlWithBackoff } from "@/lib/mlFetch";


// Cache simples em memória com TTL de 3 minutos
interface MLPrice {
  type?: string;
  amount?: number;
  regular_amount?: number;
  conditions?: { context_restrictions?: string[] };
}

interface CachedResult {
  products: unknown[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

interface SalesData {
  quantityThisMonth: number;
  revenueThisMonth: number;
  salesVelocity: number;
  daysInMonth: number;
}

const cache = new Map<string, { data: CachedResult; timestamp: number }>();
const CACHE_TTL = 3 * 60 * 1000; // 3 minutos

function getCacheKey(accountId: string, filters: Record<string, string>): string {
  return `produtos_${accountId}_${JSON.stringify(filters)}`;
}

function setCache(key: string, data: CachedResult): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

function getCache(key: string): CachedResult | null {
  const cached = cache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

// ✅ HELPER: Verificar usuário para API routes
async function verifyUserForAPI(request: Request) {
  try {

    // Criar um NextRequest simulado para getToken
    const url = new URL(request.url);
    const headers = new Headers(request.headers);

    // Detectar se é HTTPS
    const isSecure =
      url.protocol === "https:" || headers.get("x-forwarded-proto") === "https";

    const token = await getToken({
      req: request as unknown as NextRequest, // Next.js pode lidar com Request regular
      secret: process.env.NEXTAUTH_SECRET,
      secureCookie: isSecure,
      cookieName: isSecure
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
    });

    if (!token || !token.id) {
      throw new Error("Token inválido ou ausente");
    }

    const userId = token.id as string;

    // Verificar/criar usuário no banco
    let user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      if (!token.email) {
        throw new Error("Email necessário para criar usuário");
      }

      user = await prisma.user.create({
        data: {
          id: userId,
          email: token.email,
          name: token.name || "Usuário",
        },
      });
    }

    return user;
  } catch (error) {
    throw error;
  }
}

export async function GET(request: Request) {
  try {

    // Verificar autenticação
    let user;
    try {
      user = await verifyUserForAPI(request);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: "Acesso não autorizado. Token ausente." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    const sortBy = url.searchParams.get("sortBy") || "smart";
    const sortOrder = url.searchParams.get("sortOrder") || "desc";
    const filterStatus = url.searchParams.get("status") || "all";
    const filterStock = url.searchParams.get("stock") || "all";

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "Account ID é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar cache
    const cacheKey = getCacheKey(accountId, {
      sortBy,
      sortOrder,
      filterStatus,
      filterStock,
    });
    const cachedData = getCache(cacheKey);

    if (cachedData) {
      return NextResponse.json({
        success: true,
        products: cachedData.products,
        pagination: cachedData.pagination,
        cached: true,
      });
    }

    // Buscar conta do ML
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: "Conta ML não encontrada" },
        { status: 404 }
      );
    }

    const accessToken = account.accessToken;

    // 1. BUSCAR TODOS OS PRODUTOS DO ML EM TEMPO REAL

    const allMLProducts = [];
    let offset = 0;
    const limit = 50;

    while (offset < 200) {
      // Máximo 200 produtos (4 páginas)
      try {
        const userItemsResponse = await fetchMlWithBackoff(
          `https://api.mercadolibre.com/users/${account.mlUserId}/items/search?offset=${offset}&limit=${limit}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!userItemsResponse.ok) {
          break;
        }

        const userItemsData = await userItemsResponse.json();
        allMLProducts.push(...userItemsData.results);


        if (userItemsData.results.length < limit) break;
        offset += limit;

        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        break;
      }
    }


    // 2. BUSCAR DETALHES DE CADA PRODUTO EM TEMPO REAL

    const produtos = [];

    const BATCH_SIZE = 5;
    for (let i = 0; i < Math.min(50, allMLProducts.length); i += BATCH_SIZE) {
      const batch = allMLProducts.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (itemId) => {
        try {
          // Buscar dados básicos do item
          const itemResponse = await fetchMlWithBackoff(
            `https://api.mercadolibre.com/items/${itemId}`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!itemResponse.ok) {
            return null;
          }

          const item = await itemResponse.json();

          // Aplicar filtros em tempo real
          if (filterStatus !== "all" && item.status !== filterStatus) {
            return null;
          }

          if (filterStock === "low" && item.available_quantity > 10) {
            return null;
          }

          if (filterStock === "out" && item.available_quantity > 0) {
            return null;
          }

          // Buscar preços promocionais em tempo real
          let currentPrice = Math.round(item.price * 100);
          let originalPrice = item.original_price
            ? Math.round(item.original_price * 100)
            : null;
          let hasPromotion = false;
          let promotionDiscount = 0;

          try {
            const pricesResponse = await fetchMlWithBackoff(
              `https://api.mercadolibre.com/items/${itemId}/prices`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );

            if (pricesResponse.ok) {
              const pricesData = await pricesResponse.json();

              const promotionPrice = pricesData.prices?.find(
                (p: MLPrice) =>
                  p.type === "promotion" &&
                  p.conditions?.context_restrictions?.includes(
                    "channel_marketplace"
                  )
              );

              if (promotionPrice && promotionPrice.regular_amount) {
                currentPrice = Math.round(promotionPrice.amount * 100);
                originalPrice = Math.round(promotionPrice.regular_amount * 100);
                hasPromotion = true;
                promotionDiscount = Math.round(
                  ((originalPrice - currentPrice) / originalPrice) * 100
                );
              }
            }
          } catch (priceError) {
            console.error(
              `[PRODUTOS_DINAMICOS_API] Erro ao buscar preços do item ${itemId}:`,
              priceError
            );
          }

          // Buscar vinculação com produto local (se existir)
          let produtoLocal = null;
          try {
            const produtoML = await prisma.produtoMercadoLivre.findFirst({
              where: {
                mlItemId: itemId,
                mercadoLivreAccountId: accountId,
              },
              include: {
                produto: {
                  include: {
                    estoques: true,
                  },
                },
              },
            });

            if (produtoML?.produto) {
              const estoqueTotal = produtoML.produto.estoques.reduce(
                (total, estoque) => total + estoque.quantidade,
                0
              );

              produtoLocal = {
                id: produtoML.produto.id,
                nome: produtoML.produto.nome,
                sku: produtoML.produto.sku,
                estoqueLocal: estoqueTotal,
              };
            }
          } catch (localError) {
            console.error(
              `[PRODUTOS_DINAMICOS_API] Erro ao buscar produto local do item ${itemId}:`,
              localError
            );
          }

          return {
            mlItemId: itemId,
            mlTitle: item.title,
            mlPrice: currentPrice,
            mlOriginalPrice: originalPrice,
            mlHasPromotion: hasPromotion,
            mlPromotionDiscount: promotionDiscount,
            mlAvailableQuantity: item.available_quantity,
            mlSoldQuantity: item.sold_quantity || 0,
            mlStatus: item.status,
            mlThumbnail: pickMlImageUrl(item),
            mlPermalink: item.permalink,
            produto: produtoLocal,
            lastSyncAt: new Date().toISOString(),
            salesData: null as SalesData | null,
          };
        } catch (error) {
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      produtos.push(...batchResults.filter(Boolean));


      // Delay entre lotes
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // 3. BUSCAR DADOS DE VENDAS EM TEMPO REAL (se necessário para ordenação)
    if (sortBy === "sales" || sortBy === "smart") {

      // Definir período (este mês)
      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

      // Buscar pedidos do mês
      const allOrders = [];
      let orderOffset = 0;

      while (orderOffset < 500 && allOrders.length < 300) {
        // Máximo 300 pedidos recentes
        try {
          const ordersResponse = await MercadoLivreService.getUserOrders(
            accessToken,
            {
              seller: account.mlUserId,
              offset: orderOffset,
              limit: 50,
              sort: "date_desc",
            }
          );

          allOrders.push(...ordersResponse.results);

          if (ordersResponse.results.length < 50) break;
          orderOffset += 50;

          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (orderError) {
          break;
        }
      }

      // Processar vendas por produto
      const validStatuses = [
        "paid",
        "delivered",
        "ready_to_ship",
        "shipped",
        "handling",
      ];
      const salesByProduct = new Map();

      allOrders.forEach((order) => {
        const orderDate = new Date(order.date_created);
        if (
          validStatuses.includes(order.status) &&
          orderDate >= inicioMes &&
          orderDate <= fimMes
        ) {
          order.order_items?.forEach((item) => {
            const itemId = item.item?.id;
            if (itemId) {
              const current = salesByProduct.get(itemId) || {
                quantity: 0,
                revenue: 0,
              };
              const unitPriceInCents = (item.unit_price || 0) * 100;

              current.quantity += item.quantity;
              current.revenue += unitPriceInCents * item.quantity;

              salesByProduct.set(itemId, current);
            }
          });
        }
      });

      // Adicionar dados de vendas aos produtos
      produtos.forEach((produto) => {
        if (!produto) return;
        const sales = salesByProduct.get(produto.mlItemId) || {
          quantity: 0,
          revenue: 0,
        };
        const diasEsteMs = agora.getDate();

        produto.salesData = {
          quantityThisMonth: sales.quantity,
          revenueThisMonth: sales.revenue,
          salesVelocity: sales.quantity / diasEsteMs,
          daysInMonth: diasEsteMs,
        };
      });

    }

    // 4. ORDENAÇÃO DINÂMICA
    const sortedProducts = [...produtos];

    if (sortBy === "smart") {
      // Ordenação inteligente: ativos com vendas primeiro
      sortedProducts.sort((a, b) => {
        if (!a || !b) return 0;
        // Prioridade 1: Status ativo
        if (a.mlStatus === "active" && b.mlStatus !== "active") return -1;
        if (b.mlStatus === "active" && a.mlStatus !== "active") return 1;

        // Prioridade 2: Tem promoção
        if (a.mlHasPromotion && !b.mlHasPromotion) return -1;
        if (b.mlHasPromotion && !a.mlHasPromotion) return 1;

        // Prioridade 3: Vendas no mês
        const salesA = a.salesData?.quantityThisMonth || 0;
        const salesB = b.salesData?.quantityThisMonth || 0;
        if (salesA !== salesB) return salesB - salesA;

        // Prioridade 4: Vinculado a produto local
        if (a.produto && !b.produto) return -1;
        if (b.produto && !a.produto) return 1;

        return 0;
      });
    } else if (sortBy === "sales") {
      sortedProducts.sort((a, b) => {
        if (!a || !b) return 0;
        const salesA = a.salesData?.quantityThisMonth || 0;
        const salesB = b.salesData?.quantityThisMonth || 0;
        return sortOrder === "desc" ? salesB - salesA : salesA - salesB;
      });
    } else if (sortBy === "price") {
      sortedProducts.sort((a, b) => {
        if (!a || !b) return 0;
        return sortOrder === "desc"
          ? b.mlPrice - a.mlPrice
          : a.mlPrice - b.mlPrice;
      });
    } else if (sortBy === "stock") {
      sortedProducts.sort((a, b) => {
        if (!a || !b) return 0;
        return sortOrder === "desc"
          ? b.mlAvailableQuantity - a.mlAvailableQuantity
          : a.mlAvailableQuantity - b.mlAvailableQuantity;
      });
    }

    const result = {
      products: sortedProducts,
      pagination: {
        total: sortedProducts.length,
        page: 1,
        limit: sortedProducts.length,
        pages: 1,
      },
    };

    // Salvar no cache
    setCache(cacheKey, result);


    return NextResponse.json({
      success: true,
      ...result,
      cached: false,
    });
  } catch (error) {
    console.error("[PRODUTOS_DINAMICOS_API] ❌ Erro geral:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
