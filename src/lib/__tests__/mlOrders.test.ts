import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAllOrders, fetchAllOrdersOrThrow, PartialOrdersError } from "../mlOrders";

const getUserOrdersMock = vi.fn();

vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: {
    getUserOrders: (...args: unknown[]) => getUserOrdersMock(...args),
  },
}));

function makeOrders(startId: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `order-${startId + i}`,
    status: "paid",
    date_created: new Date().toISOString(),
    total_amount: 100,
    order_items: [],
  }));
}

describe("fetchAllOrders", () => {
  beforeEach(() => {
    getUserOrdersMock.mockReset();
  });

  it("percorre todas as páginas até encontrar uma incompleta", async () => {
    getUserOrdersMock
      .mockResolvedValueOnce({ results: makeOrders(0, 50), paging: {} })
      .mockResolvedValueOnce({ results: makeOrders(50, 50), paging: {} })
      .mockResolvedValueOnce({ results: makeOrders(100, 20), paging: {} });

    const result = await fetchAllOrders({ accessToken: "t", sellerId: "s" });

    expect(result.complete).toBe(true);
    expect(result.truncated).toBe(false);
    expect(result.orders).toHaveLength(120);
    expect(getUserOrdersMock).toHaveBeenCalledTimes(3);
  });

  it("marca como incompleto sem lançar quando uma página falha após esgotar as tentativas", async () => {
    getUserOrdersMock
      .mockResolvedValueOnce({ results: makeOrders(0, 50), paging: {} })
      .mockRejectedValue(new Error("network"));

    const result = await fetchAllOrders({
      accessToken: "t",
      sellerId: "s",
      maxRetriesPerPage: 0,
    });

    expect(result.complete).toBe(false);
    expect(result.failedOffsets).toEqual([50]);
    expect(result.orders).toHaveLength(50);
  });

  it("fetchAllOrdersOrThrow lança PartialOrdersError quando os dados ficam incompletos", async () => {
    getUserOrdersMock.mockRejectedValue(new Error("network"));

    await expect(
      fetchAllOrdersOrThrow({
        accessToken: "t",
        sellerId: "s",
        maxRetriesPerPage: 0,
      })
    ).rejects.toBeInstanceOf(PartialOrdersError);
  });

  it("produz o mesmo conjunto de pedidos em chamadas repetidas para a mesma origem de dados", async () => {
    getUserOrdersMock.mockImplementation(
      async (_token: string, filters: { offset?: number }) => {
        const offset = filters.offset ?? 0;
        return offset === 0
          ? { results: makeOrders(0, 10), paging: {} }
          : { results: [], paging: {} };
      }
    );

    const first = await fetchAllOrders({ accessToken: "t", sellerId: "s" });
    const second = await fetchAllOrders({ accessToken: "t", sellerId: "s" });

    expect(second.orders.map((o) => o.id)).toEqual(
      first.orders.map((o) => o.id)
    );
  });
});
