import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  subscription: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  loteCreditoIa: { findMany: vi.fn(async () => [] as Array<{ contaId: string }>) },
  analiseIa: { findFirst: vi.fn(), create: vi.fn(async () => ({})) },
  notification: { createMany: vi.fn(async () => ({ count: 1 })) },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/modules/controle/diagnostico", () => ({
  gerarDiagnostico: vi.fn(async () => ({ nota: 80, contexto: {}, itens: [] })),
}));
vi.mock("@/modules/financeiro/relatorios/motor", () => ({
  calcularIndicadores: vi.fn(async () => ({
    pedidos: 1,
    unidades: 1,
    faturamento: 100,
    receitaFrete: 0,
    receitaTotal: 100,
    ticketMedio: 100,
    cancelamentos: 0,
    impostos: 0,
    custosVariaveis: { tarifas: 0, frete: 0, ads: 0, armazenagemFull: 0, outrasCobrancas: 0, outrosCustos: 0, lancamentos: 0 },
    cmv: 0,
    margemContribuicao: 0,
    margemContribuicaoPercentual: null,
    totalDespesasOperacionais: 0,
    lucroLiquido: 0,
    lucroLiquidoPercentual: null,
    liquidoAReceber: 0,
    qualidade: { vendasSemCusto: 0, vendasAguardandoDetalhes: 0, vendasSemVinculo: 0, lucroConfiavel: true },
  })),
  buscarVendasParaCalculo: vi.fn(),
  obterConfigRelatorio: vi.fn(),
  totalizarVendas: vi.fn(),
}));
const obterAcessoIa = vi.fn<
  (contaId: string) => Promise<{ consumo: { esgotado: boolean }; ilimitada: boolean; statusConta: string }>
>(async () => ({
  consumo: { esgotado: false },
  ilimitada: false,
  statusConta: "ATIVA",
}));
const configuracao = vi.hoisted(() => ({ soAssinantes: true }));
vi.mock("@/modules/comercial/configuracao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/comercial/configuracao")>();
  return {
    ...original,
    obterConfiguracaoComercial: vi.fn(async () => ({ ...original.CONFIGURACAO_PADRAO, iaResumoSemanalSoAssinantes: configuracao.soAssinantes })),
  };
});
vi.mock("@/modules/conta/situacao", () => ({ contasSuspensasHaMaisDe: vi.fn(async () => new Set<string>()) }));
const cobrarUsoIa = vi.fn(async () => ({ debitado: 0, saldoAntes: 0, saldoApos: 0, repetido: false, custo: 0 }));
vi.mock("../consumo", () => ({ cobrarUsoIa }));
vi.mock("../acesso", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../acesso")>()),
  obterAcessoIa,
}));
vi.mock("../uso", () => ({ registrarUsoIa: vi.fn(async () => undefined) }));

const { executarResumoSemanal, semanaAnterior, contasElegiveisResumo } = await import("../resumoSemanal");

const agora = new Date("2026-11-23T11:00:00Z");
const ORIGINAL = { ...process.env };

function provedor() {
  return {
    criarMensagem: vi.fn(async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            resumo: "Semana boa.",
            prioridades: [1, 2, 3, 4].map((i) => ({ titulo: `P${i}`, porque: "x", acao: "y", impacto: "alto" })),
            riscos: ["r"],
            oportunidades: [],
          }),
        },
      ],
      usage: { input_tokens: 10, output_tokens: 10 },
    })),
    transmitirMensagem: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const chave of Object.keys(process.env)) if (chave.startsWith("IA_")) delete process.env[chave];
  process.env.ANTHROPIC_API_KEY = "sk-teste";
  prismaMock.user.findMany.mockResolvedValue([]);
  prismaMock.analiseIa.findFirst.mockResolvedValue(null);
});
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("semanaAnterior", () => {
  it("é a semana de segunda a domingo antes da execução, no fuso de SP", () => {
    const s = semanaAnterior(agora);
    expect(s.inicio.toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(s.fim.toISOString()).toBe("2026-11-23T02:59:59.999Z");
  });
});

describe("contasElegiveisResumo", () => {
  it("entra assinante pagante, liberação manual e env; teste grátis não entra", async () => {
    configuracao.soAssinantes = true;
    prismaMock.subscription.findMany.mockResolvedValue([{ userId: "assinante" }, { userId: "manual" }]);
    process.env.IA_CONTAS_LIBERADAS = "env@loja.com";
    prismaMock.user.findMany.mockResolvedValue([{ id: "por-env" }]);
    expect(await contasElegiveisResumo(agora)).toEqual(["assinante", "manual", "por-env"]);
    expect(prismaMock.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ iaLiberadaManual: true }, { status: "ACTIVE" }] } })
    );
    expect(prismaMock.loteCreditoIa.findMany).not.toHaveBeenCalled();
  });

  it("se o admin liberar para todos, contas com perguntas também recebem", async () => {
    configuracao.soAssinantes = false;
    prismaMock.subscription.findMany.mockResolvedValue([{ userId: "assinante" }]);
    prismaMock.loteCreditoIa.findMany.mockResolvedValue([{ contaId: "em-teste-com-saldo" }]);
    expect(await contasElegiveisResumo(agora)).toEqual(["assinante", "em-teste-com-saldo"]);
    configuracao.soAssinantes = true;
  });
});

describe("executarResumoSemanal", () => {
  it("gera o resumo com 3 prioridades, grava como SEMANAL e notifica só os ADMINs que querem receber", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ userId: "conta-1" }]);
    prismaMock.user.findMany.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
      where.role ? [{ id: "conta-1" }] : []
    );
    const p = provedor();
    const r = await executarResumoSemanal({ agora, provedor: p as never });

    expect(r).toMatchObject({ elegiveis: 1, gerados: 1, falhas: 0, completo: true });
    const criada = (prismaMock.analiseIa.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(criada).toMatchObject({ userId: "conta-1", tipo: "SEMANAL", periodoInicio: new Date("2026-11-16T03:00:00.000Z") });
    expect((criada.conteudo as { prioridades: unknown[] }).prioridades).toHaveLength(3);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ id: "conta-1" }, { contaId: "conta-1" }], role: "ADMIN", receberResumoIa: true } })
    );
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "conta-1", type: "RESUMO_IA", link: "/controle" })],
    });
  });

  it("é idempotente: a semana já resumida não é gerada de novo", async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ userId: "conta-1" }]);
    prismaMock.analiseIa.findFirst.mockResolvedValue({ id: "ja" });
    const p = provedor();
    const r = await executarResumoSemanal({ agora, provedor: p as never });
    expect(r).toMatchObject({ gerados: 0, jaFeitos: 1 });
    expect(p.criarMensagem).not.toHaveBeenCalled();
  });

  it("para quando o orçamento de tempo acaba e deixa o resto para a próxima execução", async () => {
    prismaMock.subscription.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ userId: `conta-${i}`, iaStatus: "ATIVA", iaLiberadaManual: false, iaPeriodoFim: null, iaTesteIniciadoEm: null }))
    );
    let tempo = 0;
    const relogio = () => {
      tempo += 20_000;
      return tempo;
    };
    const r = await executarResumoSemanal({ agora, provedor: provedor() as never, orcamentoMs: 45_000, relogio });
    expect(r.completo).toBe(false);
    expect(r.gerados).toBe(8);
    expect(r.pendentes).toBe(2);
  });

  it("falha de uma conta não interrompe as outras e conta sem orçamento é pulada", async () => {
    prismaMock.subscription.findMany.mockResolvedValue(
      ["a", "b", "c"].map((userId) => ({ userId, iaStatus: "ATIVA", iaLiberadaManual: false, iaPeriodoFim: null, iaTesteIniciadoEm: null }))
    );
    obterAcessoIa.mockImplementation(async (contaId: string) => {
      if (contaId === "a") throw new Error("db");
      return { consumo: { esgotado: contaId === "b" }, ilimitada: false, statusConta: "ATIVA" };
    });
    const silencio = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await executarResumoSemanal({ agora, provedor: provedor() as never });
    silencio.mockRestore();
    expect(r).toMatchObject({ falhas: 1, semOrcamento: 1, gerados: 1 });
    obterAcessoIa.mockImplementation(async () => ({ consumo: { esgotado: false }, ilimitada: false, statusConta: "ATIVA" }));
  });

  it("não faz nada com a IA desligada", async () => {
    process.env.IA_DESLIGADA = "1";
    const r = await executarResumoSemanal({ agora, provedor: provedor() as never });
    expect(r.elegiveis).toBe(0);
    expect(prismaMock.subscription.findMany).not.toHaveBeenCalled();
  });
});
