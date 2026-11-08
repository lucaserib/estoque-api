import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  subscription: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  usoIa: { aggregate: vi.fn(), count: vi.fn() },
  mensagemIa: { count: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { obterAcessoIa, garantirAcessoIa, garantirOrcamento, determinarOrigem } = await import("../acesso");

const agora = new Date("2026-11-20T15:00:00Z");
const AMBIENTE_ORIGINAL = { ...process.env };

function assinatura(campos: Record<string, unknown> = {}) {
  return {
    iaStatus: "INATIVA",
    iaLiberadaManual: false,
    iaPeriodoFim: null,
    iaTesteIniciadoEm: null,
    iaOrcamentoCentavos: null,
    ...campos,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const chave of Object.keys(process.env)) if (chave.startsWith("IA_")) delete process.env[chave];
  process.env.ANTHROPIC_API_KEY = "sk-teste";
  prismaMock.user.findUnique.mockResolvedValue({ email: "dono@loja.com" });
  prismaMock.usoIa.aggregate.mockResolvedValue({ _sum: { custoCentavos: null } });
  prismaMock.usoIa.count.mockResolvedValue(0);
  prismaMock.mensagemIa.count.mockResolvedValue(0);
});

afterEach(() => {
  process.env = { ...AMBIENTE_ORIGINAL };
});

describe("obterAcessoIa", () => {
  it("libera por assinatura ativa", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(assinatura({ iaStatus: "ATIVA" }));
    const acesso = await obterAcessoIa("c1", agora);
    expect(acesso).toMatchObject({ liberada: true, origem: "ASSINATURA", configurada: true, desligada: false });
  });

  it("mantém o acesso de assinatura cancelada até o fim do período pago", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      assinatura({ iaStatus: "CANCELADA", iaPeriodoFim: new Date("2026-11-30T00:00:00Z") })
    );
    expect((await obterAcessoIa("c1", agora)).origem).toBe("ASSINATURA");

    prismaMock.subscription.findUnique.mockResolvedValue(
      assinatura({ iaStatus: "CANCELADA", iaPeriodoFim: new Date("2026-11-10T00:00:00Z") })
    );
    expect((await obterAcessoIa("c1", agora)).liberada).toBe(false);
  });

  it("libera teste grátis por 7 dias e bloqueia depois", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      assinatura({ iaStatus: "TESTE", iaTesteIniciadoEm: new Date("2026-11-15T15:00:00Z") })
    );
    const vigente = await obterAcessoIa("c1", agora);
    expect(vigente).toMatchObject({ liberada: true, origem: "TESTE", testeDisponivel: false });
    expect(vigente.testeAteEm).toBe("2026-11-22T15:00:00.000Z");

    prismaMock.subscription.findUnique.mockResolvedValue(
      assinatura({ iaStatus: "TESTE", iaTesteIniciadoEm: new Date("2026-11-10T15:00:00Z") })
    );
    const expirado = await obterAcessoIa("c1", agora);
    expect(expirado).toMatchObject({ liberada: false, origem: null, testeDisponivel: false });
  });

  it("libera manualmente pelo admin e por e-mail ou id em IA_CONTAS_LIBERADAS", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(assinatura({ iaLiberadaManual: true }));
    expect((await obterAcessoIa("c1", agora)).origem).toBe("MANUAL");

    prismaMock.subscription.findUnique.mockResolvedValue(null);
    process.env.IA_CONTAS_LIBERADAS = "Outra@x.com, DONO@loja.com";
    expect((await obterAcessoIa("c1", agora)).origem).toBe("ENV");

    process.env.IA_CONTAS_LIBERADAS = "c1";
    prismaMock.user.findUnique.mockResolvedValue({ email: "x@y.com" });
    expect((await obterAcessoIa("c1", agora)).origem).toBe("ENV");
  });

  it("sem nada, oferece o teste grátis", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    expect(await obterAcessoIa("c1", agora)).toMatchObject({ liberada: false, testeDisponivel: true, status: "INATIVA" });
  });
});

describe("determinarOrigem", () => {
  it("prioriza env, depois manual, assinatura e teste", () => {
    const tudo = assinatura({
      iaLiberadaManual: true,
      iaStatus: "ATIVA",
      iaTesteIniciadoEm: new Date("2026-11-19T00:00:00Z"),
    }) as never;
    expect(determinarOrigem(tudo, true, agora)).toBe("ENV");
    expect(determinarOrigem(tudo, false, agora)).toBe("MANUAL");
  });
});

describe("garantirAcessoIa", () => {
  it("IA_DESLIGADA bloqueia todo mundo, mesmo liberado", async () => {
    process.env.IA_DESLIGADA = "1";
    prismaMock.subscription.findUnique.mockResolvedValue(assinatura({ iaLiberadaManual: true }));
    await expect(garantirAcessoIa("c1", agora)).rejects.toMatchObject({ codigo: "DESLIGADA" });
  });

  it("sem chave nem provedor falso a IA não está configurada", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    prismaMock.subscription.findUnique.mockResolvedValue(assinatura({ iaLiberadaManual: true }));
    await expect(garantirAcessoIa("c1", agora)).rejects.toMatchObject({ codigo: "NAO_CONFIGURADA" });

    process.env.IA_PROVEDOR_FALSO = "1";
    await expect(garantirAcessoIa("c1", agora)).resolves.toMatchObject({ liberada: true });
  });

  it("conta sem acesso recebe NAO_CONTRATADA e conta estourada recebe LIMITE", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    await expect(garantirAcessoIa("c1", agora)).rejects.toMatchObject({ codigo: "NAO_CONTRATADA" });

    prismaMock.subscription.findUnique.mockResolvedValue(assinatura({ iaLiberadaManual: true }));
    prismaMock.mensagemIa.count.mockResolvedValue(300);
    await expect(garantirAcessoIa("c1", agora)).rejects.toMatchObject({ codigo: "LIMITE" });
    await expect(garantirOrcamento("c1", agora)).rejects.toMatchObject({ codigo: "LIMITE" });
  });
});
