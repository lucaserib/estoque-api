import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

function produtoFake() {
  return {
    id: "p1",
    nome: "Produto 1",
    sku: "SKU1",
    userId: "conta-1",
    custoMedio: 1000,
    custoOrigem: "MEDIA_PONDERADA",
    custoAtualizadoEm: new Date("2026-01-01"),
    custoFreteManual: 50,
    custoEmbalagem: 20,
    precoVenda: 2000,
    ean: null,
    estoques: [],
    componentes: [
      {
        id: 1,
        quantidade: 2,
        produto: { id: "comp-1", nome: "Componente 1", custoMedio: 300 },
      },
    ],
    fornecedores: [
      {
        id: 1,
        principal: true,
        preco: 900,
        precoUnitario: 900,
        prazoEntregaDias: 7,
        fornecedor: { id: "f1", nome: "Fornecedor 1" },
      },
    ],
    ProdutoMercadoLivre: [],
  };
}

const findUniqueMock = vi.fn();
const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    produto: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

function criarRequest(query = "") {
  return new Request(`http://localhost/api/produtos${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findUniqueMock.mockReset();
  findManyMock.mockReset();
});

describe("GET /api/produtos", () => {
  it("esconde custo e preço de fornecedor para papel sem VER_CUSTO (lista)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    findManyMock.mockResolvedValue([produtoFake()]);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body[0].custoMedio).toBeNull();
    expect(body[0].custoOrigem).toBeNull();
    expect(body[0].custoFreteManual).toBeNull();
    expect(body[0].custoEmbalagem).toBeNull();
    expect(body[0].componentes[0].produto.custoMedio).toBeNull();
    expect(body[0].fornecedores[0].preco).toBeNull();
    expect(body[0].fornecedorPrincipal.precoUnitario).toBeNull();
    expect(body[0].precoVenda).toBe(2000);
  });

  it("mostra custo para ADMIN (lista)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([produtoFake()]);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body[0].custoMedio).toBe(1000);
    expect(body[0].componentes[0].produto.custoMedio).toBe(300);
    expect(body[0].fornecedores[0].preco).toBe(900);
  });

  it("mostra custo para COMPRAS (lista)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "COMPRAS" });
    findManyMock.mockResolvedValue([produtoFake()]);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body[0].custoMedio).toBe(1000);
  });

  it("esconde custo para papel sem VER_CUSTO (produto único por id)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ESTOQUE" });
    findUniqueMock.mockResolvedValue(produtoFake());

    const response = await GET(criarRequest("?id=p1") as never);
    const body = await response.json();

    expect(body.custoMedio).toBeNull();
    expect(body.fornecedorPrincipal.precoUnitario).toBeNull();
  });
});
