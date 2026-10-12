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

const resumoPeriodoMock = vi.fn();
const serieDiariaMock = vi.fn();
const lucroPorProdutoMock = vi.fn();
const listarVendasComLucroMock = vi.fn();

vi.mock("@/modules/financeiro/relatorios/resumoDia", () => ({
  gerarResumoPeriodo: (...args: unknown[]) => resumoPeriodoMock(...args),
  gerarSerieDiaria: (...args: unknown[]) => serieDiariaMock(...args),
}));
vi.mock("@/modules/financeiro/relatorios/lucroPorProduto", () => ({
  gerarLucroPorProduto: (...args: unknown[]) => lucroPorProdutoMock(...args),
}));
vi.mock("@/modules/financeiro/relatorios/lucroPorVenda", () => ({
  listarVendasComLucro: (...args: unknown[]) => listarVendasComLucroMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async () => null),
    },
    produtoMercadoLivre: {
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

const RESUMO_PERIODO_VAZIO = {
  desde: new Date(), ate: new Date(),
  pedidos: 0, unidades: 0, faturamentoBruto: 0, cancelamentos: 0, descontos: 0,
  tarifas: 0, frete: 0, ads: 0, impostos: 0, cmv: 0, margemContribuicao: 0,
  margemContribuicaoPercentual: null, ticketMedio: null, lucroLiquido: 0,
  pontoEquilibrioMes: { pontoEquilibrio: 0, faturamentoBrutoAteAgora: 0, faltaVender: 0 },
};

function criarRequest(query = "") {
  return new NextRequest(
    `http://localhost/api/dashboard/resumo${query}`
  );
}

describe("GET /api/dashboard/resumo", () => {
  beforeEach(() => {
    verifyUserMock.mockReset();
    resumoPeriodoMock.mockReset();
    serieDiariaMock.mockReset();
    lucroPorProdutoMock.mockReset();
    listarVendasComLucroMock.mockReset();

    resumoPeriodoMock.mockResolvedValue(RESUMO_PERIODO_VAZIO);
    serieDiariaMock.mockResolvedValue([]);
    lucroPorProdutoMock.mockResolvedValue([]);
    listarVendasComLucroMock.mockResolvedValue({ vendas: [], total: 0, pagina: 1, porPagina: 1 });
  });

  it("não quebra quando o financeiro ainda não tem nenhum resumo diário", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const { GET } = await import("../route");

    const response = await GET(criarRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.metricas.faturamentoLiquido.valor).toBe(0);
    expect(body.metricas.unidadesVendidas).toBe(0);
  });

  it("lê faturamento, margem e unidades do módulo financeiro, sem estimativa paralela", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-financeiro", role: "ADMIN" });
    resumoPeriodoMock.mockImplementation(async (_userId: string, desde: Date) => {
      // A primeira chamada (período atual) recebe `desde` mais recente que a segunda (período anterior).
      const ehPeriodoAtual = desde.getTime() > Date.now() - 31 * 24 * 60 * 60 * 1000;
      return ehPeriodoAtual
        ? {
            ...RESUMO_PERIODO_VAZIO,
            pedidos: 10, unidades: 25, faturamentoBruto: 100000, cancelamentos: 5000,
            descontos: 2000, impostos: 3000, margemContribuicao: 40000,
            margemContribuicaoPercentual: 0.4, ticketMedio: 10000,
          }
        : { ...RESUMO_PERIODO_VAZIO, faturamentoBruto: 80000 };
    });
    listarVendasComLucroMock.mockResolvedValue({ vendas: [], total: 3, pagina: 1, porPagina: 1 });

    const { GET } = await import("../route");
    const response = await GET(criarRequest());
    const body = await response.json();

    // receita líquida = 100000 - 5000 - 2000 - 3000 = 90000
    expect(body.metricas.faturamentoLiquido.valor).toBe(90000);
    expect(body.metricas.unidadesVendidas).toBe(25);
    expect(body.metricas.margemContribuicao.valor).toBe(40000);
    expect(body.metricas.margemContribuicao.percentual).toBeCloseTo(40);
    expect(body.metricas.margemContribuicao.produtosSemCustoNaVenda).toBe(3);
    // receita líquida anterior = 80000 (sem deduções) → delta = (90000-80000)/80000*100
    expect(body.metricas.faturamentoLiquido.deltaPercentual).toBeCloseTo(12.5);
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
