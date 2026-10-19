import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock, calcularTodasPendenciasMock } = vi.hoisted(() => ({
  verifyUserMock: vi.fn(),
  calcularTodasPendenciasMock: vi.fn(),
}));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));
vi.mock("@/services/pendenciasService", () => ({
  calcularTodasPendencias: calcularTodasPendenciasMock,
}));
vi.mock("@/lib/cache", () => ({
  withCache: async <T>(_key: string, fetcher: () => Promise<T>) => fetcher(),
  createCacheKey: (...parts: unknown[]) => parts.join(":"),
}));

function criarRequest() {
  return new Request("http://localhost/api/produtos/pendencias");
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  calcularTodasPendenciasMock.mockReset();
  calcularTodasPendenciasMock.mockResolvedValue([
    {
      produtoId: "p1",
      nome: "Produto 1",
      sku: "SKU1",
      custoMedio: 1000,
      estoqueTotal: 5,
      pendencias: [{ codigo: "SEM_FORNECEDOR", severidade: "critica", mensagem: "x", acao: "y" }],
    },
  ]);
});

describe("GET /api/produtos/pendencias", () => {
  it("esconde valorEstoqueAfetado para papel sem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.porCodigo.SEM_FORNECEDOR.valorEstoqueAfetado).toBeNull();
    expect(body.porCodigo.SEM_FORNECEDOR.quantidade).toBe(1);
  });

  it("mostra valorEstoqueAfetado para ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.porCodigo.SEM_FORNECEDOR.valorEstoqueAfetado).toBe(5000);
  });
});
