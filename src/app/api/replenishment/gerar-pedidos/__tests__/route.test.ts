import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock, calcularReposicaoContaMock } = vi.hoisted(() => ({
  verifyUserMock: vi.fn(),
  calcularReposicaoContaMock: vi.fn(),
}));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));
vi.mock("@/services/reposicaoService", () => ({
  calcularReposicaoConta: calcularReposicaoContaMock,
}));

const produtoFornecedorFindManyMock = vi.fn();
const pedidoCompraCreateMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    produtoFornecedor: { findMany: (...args: unknown[]) => produtoFornecedorFindManyMock(...args) },
    pedidoCompra: { create: (...args: unknown[]) => pedidoCompraCreateMock(...args) },
  },
}));

function criarRequest() {
  return new Request("http://localhost/api/replenishment/gerar-pedidos", { method: "POST" });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
  calcularReposicaoContaMock.mockReset();
  produtoFornecedorFindManyMock.mockReset();
  produtoFornecedorFindManyMock.mockResolvedValue([]);
  pedidoCompraCreateMock.mockReset();
  let proximoId = 1;
  pedidoCompraCreateMock.mockImplementation(async ({ data }) => ({
    id: proximoId++,
    fornecedorId: data.fornecedorId,
  }));
});

function sugestao(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    produtoId: "p1",
    custoMedio: 1000,
    quantidadeSugeridaCompraUnidades: 10,
    quantidadeSugeridaCompraCaixas: 1,
    fornecedorPrincipalId: "forn-1",
    fornecedorPrincipalNome: "Fornecedor 1",
    ...overrides,
  };
}

describe("POST /api/replenishment/gerar-pedidos", () => {
  it("agrupa itens do mesmo fornecedor em um único pedido rascunho", async () => {
    calcularReposicaoContaMock.mockResolvedValue({
      sugestoes: [
        sugestao({ produtoId: "p1" }),
        sugestao({ produtoId: "p2" }),
      ],
    });

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(body.pedidosCriados).toBe(1);
    expect(pedidoCompraCreateMock).toHaveBeenCalledTimes(1);
    const dataEnviada = pedidoCompraCreateMock.mock.calls[0][0].data;
    expect(dataEnviada.produtos.create).toHaveLength(2);
    expect(dataEnviada.status).toBe("pendente");
  });

  it("cria pedidos separados por fornecedor diferente", async () => {
    calcularReposicaoContaMock.mockResolvedValue({
      sugestoes: [
        sugestao({ produtoId: "p1", fornecedorPrincipalId: "forn-1" }),
        sugestao({ produtoId: "p2", fornecedorPrincipalId: "forn-2" }),
      ],
    });

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(body.pedidosCriados).toBe(2);
  });

  it("ignora itens sem fornecedor principal e reporta a contagem", async () => {
    calcularReposicaoContaMock.mockResolvedValue({
      sugestoes: [
        sugestao({ produtoId: "p1", fornecedorPrincipalId: "forn-1" }),
        sugestao({ produtoId: "p2", fornecedorPrincipalId: null }),
      ],
    });

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(body.itensIgnoradosSemFornecedor).toBe(1);
    expect(body.pedidosCriados).toBe(1);
  });

  it("usa o multiplicador do fornecedor principal para converter em caixas", async () => {
    produtoFornecedorFindManyMock.mockResolvedValue([
      { produtoId: "p1", preco: 5000, precoUnitario: 500, multiplicador: 12 },
    ]);
    calcularReposicaoContaMock.mockResolvedValue({
      sugestoes: [sugestao({ produtoId: "p1", quantidadeSugeridaCompraCaixas: 2 })],
    });

    await POST(criarRequest() as never);

    const dataEnviada = pedidoCompraCreateMock.mock.calls[0][0].data;
    expect(dataEnviada.produtos.create[0]).toEqual(
      expect.objectContaining({ multiplicador: 12, quantidade: 2, custo: 6000 })
    );
  });

  it("não cria pedido nenhum quando não há itens precisando de compra", async () => {
    calcularReposicaoContaMock.mockResolvedValue({
      sugestoes: [sugestao({ quantidadeSugeridaCompraUnidades: 0 })],
    });

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(body.pedidosCriados).toBe(0);
    expect(pedidoCompraCreateMock).not.toHaveBeenCalled();
  });
});
