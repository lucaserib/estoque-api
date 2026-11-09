import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  usoIa: { aggregate: vi.fn(), count: vi.fn(), create: vi.fn() },
  mensagemIa: { count: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { estimarCustoCentavos, obterConsumoDoMes, verificarOrcamento, registrarUsoIa } = await import("../uso");
const { IaIndisponivelError } = await import("../erros");

const PRECOS = {
  IA_PRECO_ENTRADA_MTOK: "2",
  IA_PRECO_SAIDA_MTOK: "10",
  IA_PRECO_CACHE_LEITURA_MTOK: "0.2",
  IA_PRECO_CACHE_ESCRITA_MTOK: "2.5",
};

const AMBIENTE_ORIGINAL = { ...process.env };

function definirPrecos() {
  Object.assign(process.env, PRECOS, { IA_COTACAO_DOLAR: "5" });
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const chave of Object.keys(process.env)) if (chave.startsWith("IA_")) delete process.env[chave];
});

afterEach(() => {
  process.env = { ...AMBIENTE_ORIGINAL };
});

describe("estimarCustoCentavos", () => {
  it("multiplica tokens pelos preços por milhão e pela cotação do dólar", () => {
    definirPrecos();
    const custo = estimarCustoCentavos("claude-sonnet-5-5", {
      input_tokens: 100_000,
      output_tokens: 10_000,
      cache_read_input_tokens: 500_000,
      cache_creation_input_tokens: 40_000,
    });
    expect(custo).toBe(Math.round((0.2 + 0.1 + 0.1 + 0.1) * 5 * 100));
  });

  it("devolve null quando algum preço não está configurado", () => {
    process.env.IA_PRECO_ENTRADA_MTOK = "2";
    process.env.IA_PRECO_SAIDA_MTOK = "10";
    expect(estimarCustoCentavos("claude-sonnet-5-5", { input_tokens: 1000, output_tokens: 1000 })).toBeNull();
  });

  it("usa os preços do modelo rápido quando definidos e cai nos principais quando não", () => {
    definirPrecos();
    const uso = { input_tokens: 1_000_000, output_tokens: 0 };
    expect(estimarCustoCentavos("claude-haiku-5-5", uso)).toBe(1000);
    Object.assign(process.env, {
      IA_PRECO_RAPIDO_ENTRADA_MTOK: "0.1",
      IA_PRECO_RAPIDO_SAIDA_MTOK: "0.5",
      IA_PRECO_RAPIDO_CACHE_LEITURA_MTOK: "0.01",
      IA_PRECO_RAPIDO_CACHE_ESCRITA_MTOK: "0.125",
    });
    expect(estimarCustoCentavos("claude-haiku-5-5", uso)).toBe(50);
  });
});

describe("registrarUsoIa", () => {
  it("grava tokens, custo e nunca derruba quem chamou se o banco falhar", async () => {
    definirPrecos();
    prismaMock.usoIa.create.mockRejectedValueOnce(new Error("db fora"));
    const erro = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(
      registrarUsoIa({
        contaId: "c1",
        autorId: "u1",
        recurso: "CHAT",
        modelo: "claude-sonnet-5-5",
        uso: { input_tokens: 10, output_tokens: 5 },
        duracaoMs: 120,
        sucesso: true,
      })
    ).resolves.toBeUndefined();
    expect(JSON.stringify(erro.mock.calls)).not.toContain("db fora");
    erro.mockRestore();
  });
});

describe("obterConsumoDoMes", () => {
  const agora = new Date("2026-11-20T15:00:00Z");

  it("mede por custo quando há preços e respeita a sobrescrita do admin", async () => {
    definirPrecos();
    prismaMock.usoIa.aggregate.mockResolvedValue({ _sum: { custoCentavos: 750 } });
    prismaMock.mensagemIa.count.mockResolvedValue(12);
    prismaMock.usoIa.count.mockResolvedValue(3);

    const padrao = await obterConsumoDoMes("c1", { agora });
    expect(padrao).toMatchObject({ base: "CUSTO", custoCentavos: 750, orcamentoCentavos: 5000, percentual: 15, esgotado: false, mensagens: 15 });

    const sobrescrito = await obterConsumoDoMes("c1", { agora, orcamentoCentavos: 500 });
    expect(sobrescrito).toMatchObject({ orcamentoCentavos: 500, percentual: 100, esgotado: true });
    expect(new Date(sobrescrito.renovaEm).toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });

  it("mede por quantidade de mensagens quando falta preço", async () => {
    prismaMock.usoIa.aggregate.mockResolvedValue({ _sum: { custoCentavos: null } });
    prismaMock.mensagemIa.count.mockResolvedValue(290);
    prismaMock.usoIa.count.mockResolvedValue(10);
    const consumo = await obterConsumoDoMes("c1", { agora });
    expect(consumo).toMatchObject({ base: "MENSAGENS", custoCentavos: null, mensagens: 300, limiteMensagens: 300, esgotado: true });
  });

  it("no teste grátis conta desde o início do teste com o orçamento do teste", async () => {
    definirPrecos();
    prismaMock.usoIa.aggregate.mockResolvedValue({ _sum: { custoCentavos: 150 } });
    prismaMock.mensagemIa.count.mockResolvedValue(4);
    prismaMock.usoIa.count.mockResolvedValue(0);
    const inicioTeste = new Date("2026-11-18T10:00:00Z");
    const consumo = await obterConsumoDoMes("c1", { agora, testeIniciadoEm: inicioTeste, orcamentoCentavos: 99999 });
    expect(consumo).toMatchObject({ orcamentoCentavos: 200, percentual: 75 });
    expect(consumo.desde).toBe(inicioTeste.toISOString());
    expect(consumo.renovaEm).toBe("2026-11-25T10:00:00.000Z");
    expect(prismaMock.usoIa.aggregate.mock.calls[0][0].where.createdAt.gte).toEqual(inicioTeste);
  });
});

describe("verificarOrcamento", () => {
  it("lança LIMITE com a data de renovação quando estourou", () => {
    const consumo = {
      base: "CUSTO" as const,
      custoCentavos: 1000,
      mensagens: 10,
      orcamentoCentavos: 1000,
      limiteMensagens: 300,
      percentual: 100,
      esgotado: true,
      desde: "2026-11-01T03:00:00.000Z",
      renovaEm: "2026-12-01T03:00:00.000Z",
    };
    expect(() => verificarOrcamento(consumo)).toThrow(IaIndisponivelError);
    try {
      verificarOrcamento(consumo);
    } catch (error) {
      expect((error as InstanceType<typeof IaIndisponivelError>).codigo).toBe("LIMITE");
      expect((error as Error).message).toContain("01/12");
    }
    expect(() => verificarOrcamento({ ...consumo, esgotado: false })).not.toThrow();
  });
});
