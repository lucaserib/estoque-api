import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

vi.mock("@/lib/cache", () => ({
  withCache: async <T>(_key: string, fetcher: () => Promise<T>) => fetcher(),
  createCacheKey: (...parts: unknown[]) => parts.join(":"),
}));

const mercadoLivreAccountFindFirstMock = vi.fn();
const produtoMercadoLivreFindManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: (...args: unknown[]) => mercadoLivreAccountFindFirstMock(...args),
    },
    produtoMercadoLivre: {
      findMany: (...args: unknown[]) => produtoMercadoLivreFindManyMock(...args),
    },
  },
}));

function criarRequest() {
  return new Request("http://localhost/api/mercadolivre/alerts?accountId=acc-1&type=sales");
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  mercadoLivreAccountFindFirstMock.mockReset();
  mercadoLivreAccountFindFirstMock.mockResolvedValue({ id: "acc-1" });
  produtoMercadoLivreFindManyMock.mockReset();
  produtoMercadoLivreFindManyMock.mockImplementation(async (...callArgs: unknown[]) => {
    const args = callArgs[0] as { where?: { mlPrice?: unknown } };
    if (args.where?.mlPrice) {
      return [
        {
          mlItemId: "item-1",
          mlTitle: "Produto com margem baixa",
          mlPrice: 10000,
          produto: { custoMedio: 9500, sku: "SKU1" },
        },
      ];
    }
    return [];
  });
});

describe("GET /api/mercadolivre/alerts", () => {
  it("esconde custo e margem do alerta de preços para papel sem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    const alertaPrecos = body.data.alerts.find((a: { id: string }) => a.id === "sales_pricing_acc-1");
    expect(alertaPrecos.details.products[0].cost).toBeNull();
    expect(alertaPrecos.details.products[0].margin).toBeNull();
  });

  it("mostra custo e margem do alerta de preços para ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    const alertaPrecos = body.data.alerts.find((a: { id: string }) => a.id === "sales_pricing_acc-1");
    expect(alertaPrecos.details.products[0].cost).toBe(95);
  });
});
