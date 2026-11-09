import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn(), update: vi.fn((args: unknown) => args) },
  creditoDiasAssinatura: { update: vi.fn((args: unknown) => args), findMany: vi.fn(), create: vi.fn((args: unknown) => args) },
  $transaction: vi.fn(async (operacoes: unknown[]) => operacoes),
}));
const mp = vi.hoisted(() => ({
  getPreapproval: vi.fn(),
  updatePreapprovalAmount: vi.fn(async () => ({})),
  pausarPreapproval: vi.fn(async () => ({})),
  reativarPreapproval: vi.fn(async () => ({})),
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/services/mercadoPagoService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/mercadoPagoService")>()),
  MercadoPagoService: mp,
}));
vi.mock("@/modules/conta/situacao", () => ({ invalidarSituacaoConta: vi.fn() }));

import { aplicarCreditoNaHora, descontoMensal, processarAssinaturaComCreditos } from "../recompensa";

const AGORA = new Date("2026-11-10T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;
const credito = { id: "cred-1", contaId: "conta-1", dias: 7 };

function assinatura(parcial: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    userId: "conta-1",
    status: "ACTIVE",
    plan: "MONTHLY",
    mpPreapprovalId: "pre-1",
    precoContratadoCentavos: 3790,
    descontoAplicadoCentavos: null,
    pausadaAte: null,
    currentPeriodEnd: new Date(AGORA.getTime() + 2 * DIA),
    trialEndsAt: new Date(AGORA.getTime() + 3 * DIA),
    ...parcial,
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("recompensa aplicada na hora", () => {
  it("conta em teste: soma os dias ao fim do teste", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(assinatura({ status: "TRIALING" }));
    expect(await aplicarCreditoNaHora(credito, AGORA)).toBe("EXTENSAO_TESTE");
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { trialEndsAt: new Date(AGORA.getTime() + 10 * DIA) },
    });
  });

  it("anual: estende o período e marca o desconto da renovação como pendente", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(assinatura({ plan: "ANNUAL" }));
    expect(await aplicarCreditoNaHora(credito, AGORA)).toBe("EXTENSAO_ANUAL");
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { currentPeriodEnd: new Date(AGORA.getTime() + 9 * DIA) },
    });
  });

  it("mensal ativa ou conta vencida: fica guardado para a próxima cobrança", async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(assinatura());
    expect(await aplicarCreditoNaHora(credito, AGORA)).toBe("PENDENTE");
    prismaMock.subscription.findUnique.mockResolvedValue(assinatura({ status: "TRIALING", trialEndsAt: new Date(AGORA.getTime() - DIA) }));
    expect(await aplicarCreditoNaHora(credito, AGORA)).toBe("PENDENTE");
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });
});

describe("cron de recompensas da assinatura mensal", () => {
  it("faltando até 3 dias: desconto proporcional aos dias e marca o crédito", async () => {
    mp.getPreapproval.mockResolvedValue({ next_payment_date: new Date(AGORA.getTime() + 2 * DIA).toISOString() });
    prismaMock.creditoDiasAssinatura.findMany.mockResolvedValue([{ id: "c1", contaId: "conta-1", dias: 7, origem: "INDICACAO" }]);
    expect(await processarAssinaturaComCreditos(assinatura(), AGORA)).toBe("DESCONTO");
    expect(descontoMensal(3790, 7)).toBe(884);
    expect(mp.updatePreapprovalAmount).toHaveBeenCalledWith("pre-1", 29.06);
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({ where: { id: "sub-1" }, data: { descontoAplicadoCentavos: 884 } });
  });

  it("longe da cobrança não mexe", async () => {
    mp.getPreapproval.mockResolvedValue({ next_payment_date: new Date(AGORA.getTime() + 20 * DIA).toISOString() });
    expect(await processarAssinaturaComCreditos(assinatura(), AGORA)).toBe("NADA");
    expect(mp.updatePreapprovalAmount).not.toHaveBeenCalled();
  });

  it("30 dias ou mais: pula a cobrança pausando o preapproval e guarda a sobra", async () => {
    mp.getPreapproval.mockResolvedValue({ next_payment_date: new Date(AGORA.getTime() + DIA).toISOString() });
    prismaMock.creditoDiasAssinatura.findMany.mockResolvedValue(
      [1, 2, 3, 4, 5].map((i) => ({ id: `c${i}`, contaId: "conta-1", dias: 7, origem: "INDICACAO" }))
    );
    expect(await processarAssinaturaComCreditos(assinatura(), AGORA)).toBe("PAUSA");
    expect(mp.pausarPreapproval).toHaveBeenCalledWith("pre-1");
    expect(prismaMock.creditoDiasAssinatura.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dias: 5 }) }));
    expect(prismaMock.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pausadaAte: new Date(AGORA.getTime() + 31 * DIA) }) })
    );
  });

  it("anual perto da renovação: desconto de dias/365 sobre o preço", async () => {
    mp.getPreapproval.mockResolvedValue({ next_payment_date: new Date(AGORA.getTime() + 2 * DIA).toISOString() });
    prismaMock.creditoDiasAssinatura.findMany.mockResolvedValue([{ id: "c1", dias: 7, detalhe: { descontoNaRenovacao: false } }]);
    expect(await processarAssinaturaComCreditos(assinatura({ plan: "ANNUAL", precoContratadoCentavos: 38970 }), AGORA)).toBe("RENOVACAO_ANUAL");
    expect(mp.updatePreapprovalAmount).toHaveBeenCalledWith("pre-1", (38970 - 747) / 100);
  });

  it("com desconto já aplicado ou pausada, espera", async () => {
    expect(await processarAssinaturaComCreditos(assinatura({ descontoAplicadoCentavos: 500 }), AGORA)).toBe("NADA");
    expect(await processarAssinaturaComCreditos(assinatura({ pausadaAte: new Date() }), AGORA)).toBe("NADA");
    expect(mp.getPreapproval).not.toHaveBeenCalled();
  });
});
