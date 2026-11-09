import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const situacao = vi.hoisted(() => ({ obterSituacaoConta: vi.fn() }));
const creditos = vi.hoisted(() => ({ resumoCreditos: vi.fn() }));
const uso = vi.hoisted(() => ({
  obterConsumoDoMes: vi.fn(async () => ({ esgotado: false, percentual: 10, renovaEm: "2026-12-01T03:00:00.000Z" })),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/modules/conta/situacao", () => situacao);
vi.mock("../creditos", () => creditos);
vi.mock("../uso", async (importar) => ({ ...(await importar<typeof import("../uso")>()), ...uso }));
vi.mock("@/modules/comercial/configuracao", async (importar) => ({
  ...(await importar<typeof import("@/modules/comercial/configuracao")>()),
  obterConfiguracaoComercial: vi.fn(async () => (await importar<typeof import("@/modules/comercial/configuracao")>()).CONFIGURACAO_PADRAO),
}));

import { determinarOrigem, garantirAcessoIa, obterAcessoIa } from "../acesso";
import { AssinaturaInativaError } from "@/modules/conta/erros";
import { IaIndisponivelError } from "../erros";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ANTHROPIC_API_KEY = "sk-teste";
  delete process.env.IA_DESLIGADA;
  delete process.env.IA_CONTAS_LIBERADAS;
  prismaMock.subscription.findUnique.mockResolvedValue({ iaLiberadaManual: false, iaOrcamentoCentavos: null });
  prismaMock.user.findUnique.mockResolvedValue({ email: "dono@loja.com" });
  situacao.obterSituacaoConta.mockResolvedValue({ podeUsar: true, status: "TESTE" });
  creditos.resumoCreditos.mockResolvedValue({ saldo: 5, proximoVencimento: null, lotes: [] });
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe("origem do acesso à IA", () => {
  it("env e liberação manual valem como ilimitado; senão, precisa de saldo", () => {
    expect(determinarOrigem(true, false, 0)).toBe("ENV");
    expect(determinarOrigem(false, true, 0)).toBe("MANUAL");
    expect(determinarOrigem(false, false, 3)).toBe("CREDITOS");
    expect(determinarOrigem(false, false, 0)).toBeNull();
  });
});

describe("obterAcessoIa", () => {
  it("libera com saldo e conta ativa, e devolve os pacotes à venda", async () => {
    const acesso = await obterAcessoIa("conta-1");
    expect(acesso).toMatchObject({ liberada: true, ilimitada: false, origem: "CREDITOS", saldo: 5, contaAtiva: true });
    expect(acesso.pacotes).toEqual([{ id: "pacote-25", nome: "25 perguntas", perguntas: 25, precoCentavos: 2970, destaque: true }]);
  });

  it("saldo zero bloqueia, mas liberação manual continua ilimitada", async () => {
    creditos.resumoCreditos.mockResolvedValue({ saldo: 0, proximoVencimento: null, lotes: [] });
    expect(await obterAcessoIa("conta-1")).toMatchObject({ liberada: false, origem: null });

    prismaMock.subscription.findUnique.mockResolvedValue({ iaLiberadaManual: true, iaOrcamentoCentavos: null });
    expect(await obterAcessoIa("conta-1")).toMatchObject({ liberada: true, ilimitada: true, origem: "MANUAL" });
  });

  it("conta liberada pelo env, pelo e-mail do dono", async () => {
    process.env.IA_CONTAS_LIBERADAS = "Dono@Loja.com";
    creditos.resumoCreditos.mockResolvedValue({ saldo: 0, proximoVencimento: null, lotes: [] });
    expect(await obterAcessoIa("conta-1")).toMatchObject({ liberada: true, ilimitada: true, origem: "ENV" });
  });

  it("conta sem assinatura ativa não usa a IA mesmo com saldo", async () => {
    situacao.obterSituacaoConta.mockResolvedValue({ podeUsar: false, status: "VENCIDA" });
    expect(await obterAcessoIa("conta-1")).toMatchObject({ liberada: false, contaAtiva: false, saldo: 5 });
  });

  it("usa o orçamento de segurança da assinatura, não o do teste", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({ iaLiberadaManual: false, iaOrcamentoCentavos: 9000 });
    await obterAcessoIa("conta-1");
    expect(uso.obterConsumoDoMes).toHaveBeenCalledWith("conta-1", expect.objectContaining({ orcamentoCentavos: 9000 }));
  });
});

describe("garantirAcessoIa", () => {
  it("sem saldo responde SEM_CREDITOS", async () => {
    creditos.resumoCreditos.mockResolvedValue({ saldo: 0, proximoVencimento: null, lotes: [] });
    const erro = await garantirAcessoIa("conta-1").catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(IaIndisponivelError);
    expect((erro as IaIndisponivelError).codigo).toBe("SEM_CREDITOS");
  });

  it("conta vencida vira assinatura inativa (402 no cliente)", async () => {
    situacao.obterSituacaoConta.mockResolvedValue({ podeUsar: false, status: "VENCIDA" });
    await expect(garantirAcessoIa("conta-1")).rejects.toBeInstanceOf(AssinaturaInativaError);
  });

  it("limite de segurança estourado bloqueia mesmo com saldo", async () => {
    uso.obterConsumoDoMes.mockResolvedValueOnce({ esgotado: true, percentual: 100, renovaEm: "2026-12-01T03:00:00.000Z" });
    const erro = await garantirAcessoIa("conta-1").catch((e: unknown) => e);
    expect((erro as IaIndisponivelError).codigo).toBe("LIMITE");
  });

  it("IA desligada e não configurada vêm antes de tudo", async () => {
    process.env.IA_DESLIGADA = "1";
    expect(((await garantirAcessoIa("conta-1").catch((e: unknown) => e)) as IaIndisponivelError).codigo).toBe("DESLIGADA");
    delete process.env.IA_DESLIGADA;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.IA_PROVEDOR_FALSO;
    expect(((await garantirAcessoIa("conta-1").catch((e: unknown) => e)) as IaIndisponivelError).codigo).toBe("NAO_CONFIGURADA");
  });
});
