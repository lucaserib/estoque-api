import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findFirstMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { produto: { findFirst: (...args: unknown[]) => findFirstMock(...args) } },
}));

function criarRequest(ean: string) {
  return new Request(`http://localhost/api/produtos/buscar-por-ean?ean=${ean}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findFirstMock.mockReset();
  findFirstMock.mockResolvedValue({
    id: "p1",
    nome: "Produto 1",
    sku: "SKU1",
    ean: BigInt("7891234567890"),
    custoMedio: 1000,
    estoques: [{ quantidade: 5 }],
  });
});

describe("GET /api/produtos/buscar-por-ean", () => {
  it("não devolve o custo como preço para papel sem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });

    const response = await GET(criarRequest("7891234567890") as never);
    const body = await response.json();

    expect(body.produto.preco).toBe(0);
  });

  it("devolve o custo como preço para ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const response = await GET(criarRequest("7891234567890") as never);
    const body = await response.json();

    expect(body.produto.preco).toBe(1000);
  });
});
