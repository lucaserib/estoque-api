import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const verifyUserMock = vi.fn(async () => ({ id: "user-1", role: "ADMIN" }));
vi.mock("@/helpers/verifyUser", () => ({
  verifyUser: verifyUserMock,
}));

const mockAccount = {
  id: "acc-1",
  userId: "user-1",
  mlUserId: "ml-user-1",
  isActive: true,
};

const produtoMercadoLivreFindManyMock = vi.fn(async (..._args: unknown[]) => [] as unknown[]);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async () => mockAccount),
    },
    produtoMercadoLivre: {
      findMany: (...args: unknown[]) => produtoMercadoLivreFindManyMock(...args),
    },
  },
}));

const now = Date.now();
const TOTAL_ORDERS = 130;

const mockOrders = Array.from({ length: TOTAL_ORDERS }, (_, i) => ({
  id: `order-${i}`,
  status: "paid",
  date_created: new Date(now - i * 1000).toISOString(),
  total_amount: 100 + (i % 5) * 10,
  order_items: [
    {
      item: {
        id: `item-${i % 10}`,
        title: `Produto ${i % 10}`,
        seller_sku: `SKU${i % 10}`,
      },
      quantity: 1,
      unit_price: 100 + (i % 5) * 10,
      sale_fee: 5,
    },
  ],
}));

const getShipmentCostMock = vi.fn(
  async (_shipmentId: string | number, _accessToken: string) => 500
);

vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: {
    getValidToken: vi.fn(async () => "fake-token"),
    getUserOrders: vi.fn(
      async (_token: string, filters: { offset?: number; limit?: number }) => {
        const offset = filters.offset ?? 0;
        const limit = filters.limit ?? 50;
        return {
          results: mockOrders.slice(offset, offset + limit),
          paging: { total: mockOrders.length, offset, limit },
        };
      }
    ),
    getShipmentCost: (shipmentId: string | number, accessToken: string) =>
      getShipmentCostMock(shipmentId, accessToken),
  },
}));

describe("GET /api/mercadolivre/analytics/sales-complete", () => {
  beforeEach(async () => {
    const { mlCache } = await import("@/lib/cache");
    await mlCache.invalidatePattern("sales-complete");
  });

  it("retorna o mesmo summary.totalRevenue em 5 chamadas consecutivas", async () => {
    const { GET } = await import("../route");
    const { mlCache } = await import("@/lib/cache");

    const totals: number[] = [];
    const orderCounts: number[] = [];

    for (let i = 0; i < 5; i++) {
      await mlCache.invalidatePattern("sales-complete");

      const request = new NextRequest(
        "http://localhost/api/mercadolivre/analytics/sales-complete?accountId=acc-1&period=30"
      );
      const response = await GET(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      totals.push(body.data.summary.totalRevenue);
      orderCounts.push(body.data.summary.totalOrders);
    }

    expect(new Set(totals).size).toBe(1);
    expect(new Set(orderCounts).size).toBe(1);
    expect(totals[0]).toBeGreaterThan(0);
    expect(orderCounts[0]).toBe(TOTAL_ORDERS);
  });

  it("subtrai o custo real de envio (shipments/{id}/costs) da receita líquida", async () => {
    const mockOrdersComFrete = [
      {
        id: "order-frete-1",
        status: "paid",
        date_created: new Date(now).toISOString(),
        total_amount: 100,
        shipping: { id: 999 },
        order_items: [
          {
            item: { id: "item-frete", title: "Produto frete", seller_sku: "SKUF" },
            quantity: 1,
            unit_price: 100,
            sale_fee: 10,
          },
        ],
      },
    ];

    const { GET } = await import("../route");
    const { mlCache } = await import("@/lib/cache");
    const mercadoLivreServiceModule = await import(
      "@/services/mercadoLivreService"
    );

    const getUserOrdersMock =
      mercadoLivreServiceModule.MercadoLivreService.getUserOrders as ReturnType<
        typeof vi.fn
      >;
    getUserOrdersMock.mockImplementationOnce(async () => ({
      results: mockOrdersComFrete,
      paging: { total: mockOrdersComFrete.length },
    }));
    getShipmentCostMock.mockResolvedValueOnce(2000);

    await mlCache.invalidatePattern("sales-complete");

    const request = new NextRequest(
      "http://localhost/api/mercadolivre/analytics/sales-complete?accountId=acc-1&period=30"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(getShipmentCostMock).toHaveBeenCalledWith(
      "999",
      "fake-token"
    );
    expect(body.data.summary.totalShippingCostReal).toBe(2000);
    expect(body.data.summary.shippingCostsIncompletos).toBe(0);
    expect(body.data.summary.netRevenue).toBe(100 - 10 - 2000);
  });

  it("esconde custoMedio e estimatedProfit dos produtos para papel sem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValueOnce({ id: "user-1", role: "VENDAS" });
    produtoMercadoLivreFindManyMock.mockImplementationOnce(async (...callArgs: unknown[]) => {
      const args = callArgs[0] as { select: Record<string, unknown> };
      return args.select.produto ? [{ mlItemId: "item-0", produto: { custoMedio: 5000 } }] : [];
    });

    const { GET } = await import("../route");
    const { mlCache } = await import("@/lib/cache");
    await mlCache.invalidatePattern("sales-complete");

    const request = new NextRequest(
      "http://localhost/api/mercadolivre/analytics/sales-complete?accountId=acc-1&period=30"
    );
    const response = await GET(request);
    const body = await response.json();

    const produto = body.data.trends.topProducts.find((p: { mlItemId: string }) => p.mlItemId === "item-0");
    expect(produto.custoMedio).toBeNull();
    expect(produto.estimatedProfit).toBeNull();
  });

  it("mostra custoMedio e estimatedProfit para ADMIN", async () => {
    verifyUserMock.mockResolvedValueOnce({ id: "user-1", role: "ADMIN" });
    produtoMercadoLivreFindManyMock.mockImplementationOnce(async (...callArgs: unknown[]) => {
      const args = callArgs[0] as { select: Record<string, unknown> };
      return args.select.produto ? [{ mlItemId: "item-0", produto: { custoMedio: 5000 } }] : [];
    });

    const { GET } = await import("../route");
    const { mlCache } = await import("@/lib/cache");
    await mlCache.invalidatePattern("sales-complete");

    const request = new NextRequest(
      "http://localhost/api/mercadolivre/analytics/sales-complete?accountId=acc-1&period=30"
    );
    const response = await GET(request);
    const body = await response.json();

    const produto = body.data.trends.topProducts.find((p: { mlItemId: string }) => p.mlItemId === "item-0");
    expect(produto.custoMedio).toBe(50);
  });
});
