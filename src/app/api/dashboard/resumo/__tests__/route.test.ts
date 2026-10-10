import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({
  verifyUserMock: vi.fn(),
}));

vi.mock("@/helpers/verifyUser", () => ({
  verifyUser: verifyUserMock,
}));

vi.mock("@/services/pendenciasService", () => ({
  calcularTodasPendencias: vi.fn(async () => [
    {
      produtoId: "p1",
      nome: "Produto 1",
      sku: "SKU1",
      estoqueTotal: 10,
      custoMedio: null,
      pendencias: [
        { codigo: "SEM_CUSTO", severidade: "critica", mensagem: "x", acao: "y" },
      ],
    },
  ]),
}));

vi.mock("@/services/reposicaoService", () => ({
  calcularReposicaoConta: vi.fn(async () => ({
    sugestoes: [
      {
        produtoId: "p1",
        nome: "Produto 1",
        sku: "SKU1",
        custoMedio: null,
        estoqueLocal: 5,
        estoqueFullDisponivel: 0,
        estoqueFullEmTransito: 0,
        temAnuncioFull: false,
        demandaDiaria: 1,
        leadTimeDias: 7,
        estoqueDisponivel: 5,
        pontoPedido: 17,
        coberturaDias: 5,
        quantidadeSugeridaCompraUnidades: 20,
        quantidadeSugeridaCompraCaixas: 20,
        quantidadeSugeridaEnvioFull: 0,
        custoTotalCompra: null,
        custoIndefinido: true,
        fornecedorPrincipalId: null,
        fornecedorPrincipalNome: null,
        status: "atencao",
      },
    ],
    parcial: false,
  })),
}));

vi.mock("@/lib/mlOrders", () => ({
  fetchOrdersWithFallback: vi.fn(async () => ({ orders: [], parcial: false })),
}));

vi.mock("@/services/mercadoLivreService", () => ({
  MercadoLivreService: {
    getValidToken: vi.fn(async () => "fake-token"),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async () => null),
    },
    produtoMercadoLivre: {
      findMany: vi.fn(async () => []),
      count: vi.fn(async () => 0),
    },
    produto: {
      findMany: vi.fn(async () => []),
    },
    pedidoCompra: {
      findMany: vi.fn(async () => []),
    },
    blingAccount: {
      findFirst: vi.fn(async () => null),
    },
    blingWebhookEvent: {
      findMany: vi.fn(async () => []),
    },
  },
}));

function criarRequest(query = "") {
  return new NextRequest(
    `http://localhost/api/dashboard/resumo${query}`
  );
}

describe("GET /api/dashboard/resumo", () => {
  beforeEach(() => {
    verifyUserMock.mockReset();
  });

  it("não quebra quando não há conta ML conectada", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const { GET } = await import("../route");

    const response = await GET(criarRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.metricas.faturamentoLiquido.valor).toBe(0);
    expect(body.metricas.unidadesVendidas).toBe(0);
  });

  it("oculta campos financeiros para papel sem VER_CUSTO", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-2", role: "VENDAS" });
    const { GET } = await import("../route");

    const response = await GET(criarRequest());
    const body = await response.json();

    expect(body.metricas.margemContribuicao).toBeNull();
    expect(body.metricas.valorEstoqueCusto).toBeNull();
    expect(body.vendas.topPorMargem).toEqual([]);
    expect(body.estoque.topProdutos[0].valor).toBeNull();
  });

  it("expõe campos financeiros para ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-3", role: "ADMIN" });
    const { GET } = await import("../route");

    const response = await GET(criarRequest());
    const body = await response.json();

    expect(body.metricas.margemContribuicao).not.toBeNull();
    expect(body.metricas.valorEstoqueCusto).not.toBeNull();
  });

  it("reflete a contagem de pendências por código", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-4", role: "ADMIN" });
    const { GET } = await import("../route");

    const response = await GET(criarRequest());
    const body = await response.json();

    expect(body.pendencias.porCodigo.SEM_CUSTO).toBe(1);
  });

  it("limita o período entre 7 e 90 dias", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-5", role: "ADMIN" });
    const { GET } = await import("../route");

    const response = await GET(criarRequest("?periodo=500"));
    const body = await response.json();

    expect(body.periodo.dias).toBe(90);
  });
});
