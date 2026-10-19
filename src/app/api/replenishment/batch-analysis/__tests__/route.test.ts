import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock, calcularReposicaoContaMock } = vi.hoisted(() => ({
  verifyUserMock: vi.fn(),
  calcularReposicaoContaMock: vi.fn(),
}));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));
vi.mock("@/services/reposicaoService", () => ({
  calcularReposicaoConta: calcularReposicaoContaMock,
}));

function criarRequest() {
  return new Request("http://localhost/api/replenishment/batch-analysis");
}

function sugestaoCritica() {
  return {
    produtoId: "p1",
    nome: "Produto 1",
    sku: "SKU1",
    custoMedio: 1000,
    estoqueLocal: 0,
    estoqueFullDisponivel: 0,
    estoqueFullEmTransito: 0,
    estoqueFullIndisponivel: 0,
    temAnuncioFull: false,
    demandaDiaria: 1,
    coberturaDiasLocal: 0,
    coberturaDiasFull: null,
    dataRupturaPrevista: "2026-10-20",
    quantidadeSugeridaCompraUnidades: 20,
    quantidadeSugeridaEnvioFull: 0,
    custoTotalCompra: 20000,
    custoIndefinido: false,
    fornecedorPrincipalId: "f1",
    fornecedorPrincipalNome: "Fornecedor 1",
    status: "critico",
  };
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  calcularReposicaoContaMock.mockReset();
  calcularReposicaoContaMock.mockResolvedValue({ sugestoes: [sugestaoCritica()], parcial: false });
});

describe("GET /api/replenishment/batch-analysis", () => {
  it("esconde custoMedio e custoTotal para papel sem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ESTOQUE" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.results[0].custoMedio).toBe(0);
    expect(body.results[0].custoTotalReposicao).toBe(0);
    expect(body.results[0].reposicaoLocal.custoTotal).toBe(0);
    expect(body.summary.custoTotalGeral).toBe(0);
  });

  it("mostra custoMedio e custoTotal para ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.results[0].custoMedio).toBe(1000);
    expect(body.results[0].custoTotalReposicao).toBe(200);
    expect(body.summary.custoTotalGeral).toBe(200);
  });

  it("mostra custoMedio e custoTotal para COMPRAS", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "COMPRAS" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.results[0].custoMedio).toBe(1000);
  });
});
