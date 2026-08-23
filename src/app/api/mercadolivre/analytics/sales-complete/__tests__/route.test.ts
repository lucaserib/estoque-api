import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/helpers/verifyUser", () => ({
  verifyUser: vi.fn(async () => ({ id: "user-1" })),
}));

const mockAccount = {
  id: "acc-1",
  userId: "user-1",
  mlUserId: "ml-user-1",
  isActive: true,
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async () => mockAccount),
    },
    produtoMercadoLivre: {
      findMany: vi.fn(async () => []),
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
});
