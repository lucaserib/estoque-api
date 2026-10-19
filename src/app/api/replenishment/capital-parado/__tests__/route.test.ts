import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock, calcularCapitalParadoContaMock } = vi.hoisted(() => ({
  verifyUserMock: vi.fn(),
  calcularCapitalParadoContaMock: vi.fn(),
}));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));
vi.mock("@/services/reposicaoService", () => ({
  calcularCapitalParadoConta: calcularCapitalParadoContaMock,
}));

function criarRequest(limiteDias?: string) {
  const url = limiteDias
    ? `http://localhost/api/replenishment/capital-parado?limiteDias=${limiteDias}`
    : "http://localhost/api/replenishment/capital-parado";
  return new Request(url);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  calcularCapitalParadoContaMock.mockReset();
});

describe("GET /api/replenishment/capital-parado", () => {
  it("devolve produtos parados com valor para quem pode ver custo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    calcularCapitalParadoContaMock.mockResolvedValue([
      {
        produtoId: "p1",
        nome: "Produto 1",
        sku: "SKU1",
        estoqueLocal: 10,
        custoMedio: 500,
        valorParado: 5000,
        ultimaVenda: null,
        diasSemVenda: null,
      },
    ]);

    const response = await GET(criarRequest("60") as never);
    const body = await response.json();

    expect(calcularCapitalParadoContaMock).toHaveBeenCalledWith("conta-1", 60);
    expect(body.produtos[0].valorParado).toBe(5000);
    expect(body.valorTotalParado).toBe(5000);
  });

  it("esconde custo e valor parado para quem não tem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ESTOQUE" });
    calcularCapitalParadoContaMock.mockResolvedValue([
      {
        produtoId: "p1",
        nome: "Produto 1",
        sku: "SKU1",
        estoqueLocal: 10,
        custoMedio: 500,
        valorParado: 5000,
        ultimaVenda: null,
        diasSemVenda: null,
      },
    ]);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.produtos[0].custoMedio).toBeNull();
    expect(body.produtos[0].valorParado).toBeNull();
    expect(body.valorTotalParado).toBeNull();
  });

  it("usa limiteDias padrão de 60 quando não informado", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    calcularCapitalParadoContaMock.mockResolvedValue([]);

    await GET(criarRequest() as never);

    expect(calcularCapitalParadoContaMock).toHaveBeenCalledWith("conta-1", 60);
  });
});
