import { describe, it, expect, vi, beforeEach } from "vitest";

const calcularTodasPendenciasMock = vi.fn(async () => [] as Array<{ produtoId: string; pendencias: { codigo: string }[] }>);
vi.mock("@/services/pendenciasService", () => ({
  calcularTodasPendencias: () => calcularTodasPendenciasMock(),
}));

interface StatusCatalogoFake {
  emAndamento: boolean;
  etapa: string | null;
  progresso: Record<string, unknown>;
  iniciadoEm: string | null;
  concluidoEm: string | null;
  erro: string | null;
  bling: unknown;
  mercadoLivre: unknown;
}

const obterStatusCatalogoMock = vi.fn<() => Promise<StatusCatalogoFake>>(async () => ({
  emAndamento: false,
  etapa: null,
  progresso: {},
  iniciadoEm: null,
  concluidoEm: null,
  erro: null,
  bling: null,
  mercadoLivre: null,
}));
vi.mock("@/modules/catalogo/sincronizacao", () => ({
  obterStatusCatalogo: () => obterStatusCatalogoMock(),
}));

const getDepositsMock = vi.fn(async () => []);
vi.mock("@/services/blingService", () => ({
  BlingService: { getDeposits: () => getDepositsMock() },
  BlingEscopoError: class BlingEscopoError extends Error {
    readonly code = "BLING_ESCOPO_INSUFICIENTE";
  },
}));

vi.mock("@/lib/cache", () => ({
  withCache: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  createCacheKey: (...partes: (string | number)[]) => partes.join(":"),
}));

interface Banco {
  mercadoLivreAccount: unknown | null;
  blingAccount: unknown | null;
  mercadoLivreWebhook: unknown | null;
  blingWebhookEvent: unknown | null;
  produtoMercadoLivreAtivos: number;
  produtoMercadoLivreVinculados: number;
  produtos: Array<{ id: string }>;
  configuracaoGeral: { aliquotaImposto: number; regimeTributario: string; metaFaturamentoMensal: number | null } | null;
  lancamentosDespesa: number;
  contaFinanceiraMp: { saldoInicial: number } | null;
  onboardingProgresso: { etapasPuladas: string[] } | null;
}

const banco: Banco = {
  mercadoLivreAccount: null,
  blingAccount: null,
  mercadoLivreWebhook: null,
  blingWebhookEvent: null,
  produtoMercadoLivreAtivos: 0,
  produtoMercadoLivreVinculados: 0,
  produtos: [],
  configuracaoGeral: null,
  lancamentosDespesa: 0,
  contaFinanceiraMp: null,
  onboardingProgresso: null,
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: { findFirst: vi.fn(async () => banco.mercadoLivreAccount) },
    blingAccount: { findFirst: vi.fn(async () => banco.blingAccount) },
    mercadoLivreWebhook: { findFirst: vi.fn(async () => banco.mercadoLivreWebhook) },
    blingWebhookEvent: { findFirst: vi.fn(async () => banco.blingWebhookEvent) },
    produtoMercadoLivre: {
      count: vi.fn(async ({ where }: { where: { produtoId?: unknown } }) =>
        "produtoId" in where ? banco.produtoMercadoLivreVinculados : banco.produtoMercadoLivreAtivos
      ),
    },
    produto: { findMany: vi.fn(async () => banco.produtos) },
    configuracaoGeral: { findUnique: vi.fn(async () => banco.configuracaoGeral) },
    lancamentoFinanceiro: { count: vi.fn(async () => banco.lancamentosDespesa) },
    contaFinanceira: { findFirst: vi.fn(async () => banco.contaFinanceiraMp) },
    onboardingProgresso: { findUnique: vi.fn(async () => banco.onboardingProgresso) },
  },
}));

const { calcularEtapas } = await import("../etapas");

beforeEach(() => {
  vi.clearAllMocks();
  banco.mercadoLivreAccount = null;
  banco.blingAccount = null;
  banco.mercadoLivreWebhook = null;
  banco.blingWebhookEvent = null;
  banco.produtoMercadoLivreAtivos = 0;
  banco.produtoMercadoLivreVinculados = 0;
  banco.produtos = [];
  banco.configuracaoGeral = null;
  banco.lancamentosDespesa = 0;
  banco.contaFinanceiraMp = null;
  banco.onboardingProgresso = null;
  calcularTodasPendenciasMock.mockResolvedValue([]);
  obterStatusCatalogoMock.mockResolvedValue({
    emAndamento: false,
    etapa: null,
    progresso: {},
    iniciadoEm: null,
    concluidoEm: null,
    erro: null,
    bling: null,
    mercadoLivre: null,
  });
});

describe("calcularEtapas", () => {
  it("conta nova: só a 1ª etapa liberada, nível Caixa, 0%", async () => {
    const resultado = await calcularEtapas("conta-1");

    expect(resultado.etapas[0].status).toBe("pendente");
    expect(resultado.etapas.slice(1).every((e) => e.status === "bloqueado")).toBe(true);
    expect(resultado.nivel).toBe("Caixa");
    expect(resultado.pontuacao).toBe(0);
  });

  it("ML conectado libera a etapa do Bling", async () => {
    banco.mercadoLivreAccount = { id: "ml-1", nickname: "Loja" };

    const resultado = await calcularEtapas("conta-1");

    expect(resultado.etapas[0].status).toBe("feito");
    expect(resultado.etapas[1].status).not.toBe("bloqueado");
  });

  it("Bling conectado mas sem escopo (/depositos falha) vira atenção com a mensagem do erro", async () => {
    banco.mercadoLivreAccount = { id: "ml-1", nickname: "Loja" };
    banco.blingAccount = { id: "bling-1", blingCompanyId: "123" };
    const { BlingEscopoError } = await import("@/services/blingService");
    getDepositsMock.mockRejectedValueOnce(new BlingEscopoError("/depositos"));

    const resultado = await calcularEtapas("conta-1");

    expect(resultado.etapas[1].status).toBe("atencao");
  });

  it("anúncios ativos todos vinculados fecha a etapa 5", async () => {
    banco.produtoMercadoLivreAtivos = 10;
    banco.produtoMercadoLivreVinculados = 10;

    const resultado = await calcularEtapas("conta-1");

    expect(resultado.etapas[4].status).toBe("feito");
    expect(resultado.etapas[4].progresso).toEqual({ feito: 10, total: 10 });
  });

  it("pular uma etapa não-bloqueante libera a próxima sem marcar como feita", async () => {
    banco.mercadoLivreAccount = { id: "ml-1", nickname: "Loja" };
    banco.onboardingProgresso = { etapasPuladas: ["2", "3"] };

    const resultado = await calcularEtapas("conta-1");

    expect(resultado.etapas[1].status).not.toBe("bloqueado");
    expect(resultado.etapas[1].status).not.toBe("feito");
    expect(resultado.etapas[3].status).not.toBe("bloqueado");
  });

  it("tudo feito ou pulado chega a 100% e Centro de Distribuição", async () => {
    banco.mercadoLivreAccount = { id: "ml-1", nickname: "Loja" };
    banco.produtoMercadoLivreAtivos = 5;
    banco.produtoMercadoLivreVinculados = 5;
    banco.configuracaoGeral = { aliquotaImposto: 0.06, regimeTributario: "SIMPLES", metaFaturamentoMensal: 1000000 };
    banco.lancamentosDespesa = 1;
    banco.contaFinanceiraMp = { saldoInicial: 50000 };
    banco.onboardingProgresso = { etapasPuladas: ["2", "3", "12_instalado"] };
    obterStatusCatalogoMock.mockResolvedValue({
      emAndamento: false,
      etapa: null,
      progresso: {},
      iniciadoEm: null,
      concluidoEm: new Date().toISOString(),
      erro: null,
      bling: null,
      mercadoLivre: null,
    });
    calcularTodasPendenciasMock.mockResolvedValue([
      { produtoId: "p1", pendencias: [] },
      { produtoId: "p2", pendencias: [] },
    ]);
    banco.produtos = [{ id: "p1" }, { id: "p2" }];

    const resultado = await calcularEtapas("conta-1");

    expect(resultado.pontuacao).toBe(100);
    expect(resultado.nivel).toBe("Centro de Distribuição");
    expect(resultado.etapas.find((e) => e.id === 12)?.status).toBe("feito");
  });
});
