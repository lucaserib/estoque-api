import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findFirstMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    produto: {
      findFirst: (...args: unknown[]) => findFirstMock(...args),
    },
  },
}));

function produtoFake() {
  return {
    id: "p1",
    nome: "Produto 1",
    custoMedio: 1000,
    ean: null,
    imagemUrl: null,
    estoques: [],
    componentes: [
      { quantidade: 2, produto: { id: "comp-1", nome: "Componente 1", custoMedio: 300 } },
    ],
    fornecedores: [
      { id: 1, principal: true, preco: 900, precoUnitario: 900, fornecedor: { id: "f1", nome: "Fornecedor 1" } },
    ],
    pedidos: [
      { quantidade: 5, custo: 200, pedido: { id: 1, status: "confirmado", dataConclusao: null, fornecedor: { nome: "F1" } } },
    ],
    detalhesSaida: [],
    movimentacoesEstoque: [],
    ProdutoMercadoLivre: [],
  };
}

function criarRequest() {
  return new Request("http://localhost/api/produtos/p1");
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findFirstMock.mockReset();
});

describe("GET /api/produtos/[id]", () => {
  it("esconde custo para papel sem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "VENDAS" });
    findFirstMock.mockResolvedValue(produtoFake());

    const response = await GET(criarRequest() as never, { params: Promise.resolve({ id: "p1" }) });
    const body = await response.json();

    expect(body.produto.custoMedio).toBeNull();
    expect(body.produto.componentes[0].produto.custoMedio).toBeNull();
    expect(body.produto.fornecedores[0].preco).toBeNull();
    expect(body.produto.pedidos[0].custo).toBeNull();
  });

  it("mostra custo para ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue(produtoFake());

    const response = await GET(criarRequest() as never, { params: Promise.resolve({ id: "p1" }) });
    const body = await response.json();

    expect(body.produto.custoMedio).toBe(1000);
    expect(body.produto.componentes[0].produto.custoMedio).toBe(300);
    expect(body.produto.fornecedores[0].preco).toBe(900);
    expect(body.produto.pedidos[0].custo).toBe(200);
  });
});
