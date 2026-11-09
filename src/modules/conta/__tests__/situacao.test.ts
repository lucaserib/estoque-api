import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  subscription: { upsert: vi.fn() },
  configuracaoComercial: { findFirst: vi.fn(async () => null) },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { calcularSituacao, contasSuspensasHaMaisDe, obterSituacaoConta } from "../situacao";

const AGORA = new Date("2026-11-10T12:00:00.000Z");
const DIA = 24 * 60 * 60 * 1000;
const dono = { name: "Lucas", email: "dono@loja.com", bloqueadoEm: null };

function assinatura(parcial: Record<string, unknown>) {
  return {
    status: "TRIALING",
    plan: null,
    trialEndsAt: new Date(AGORA.getTime() + 3 * DIA),
    currentPeriodEnd: null,
    updatedAt: AGORA,
    ...parcial,
  } as Parameters<typeof calcularSituacao>[1];
}

const cobrando = { cobrancaObrigatoria: true };

describe("calcularSituacao", () => {
  it("teste vigente libera e conta os dias restantes", () => {
    const s = calcularSituacao("c1", assinatura({}), dono, AGORA, cobrando);
    expect(s).toMatchObject({ status: "TESTE", podeUsar: true, diasRestantesTeste: 3, donoEmail: "dono@loja.com" });
  });

  it("teste vencido bloqueia e informa desde quando", () => {
    const fim = new Date(AGORA.getTime() - DIA);
    const s = calcularSituacao("c1", assinatura({ trialEndsAt: fim }), dono, AGORA, cobrando);
    expect(s).toMatchObject({ status: "VENCIDA", podeUsar: false, inativaDesde: fim, diasRestantesTeste: null });
  });

  it("assinatura ativa libera", () => {
    expect(calcularSituacao("c1", assinatura({ status: "ACTIVE" }), dono, AGORA, cobrando)).toMatchObject({
      status: "ATIVA",
      podeUsar: true,
    });
  });

  it("inadimplente tem 5 dias de tolerância depois do fim do período", () => {
    const dentro = assinatura({ status: "PAST_DUE", currentPeriodEnd: new Date(AGORA.getTime() - 2 * DIA) });
    const fora = assinatura({ status: "PAST_DUE", currentPeriodEnd: new Date(AGORA.getTime() - 6 * DIA) });
    expect(calcularSituacao("c1", dentro, dono, AGORA, cobrando)).toMatchObject({ status: "INADIMPLENTE", podeUsar: true });
    expect(calcularSituacao("c1", fora, dono, AGORA, cobrando)).toMatchObject({ status: "INADIMPLENTE", podeUsar: false });
  });

  it("cancelada usa até o fim do período pago", () => {
    const pago = assinatura({ status: "CANCELED", currentPeriodEnd: new Date(AGORA.getTime() + 10 * DIA) });
    const vencido = assinatura({ status: "CANCELED", currentPeriodEnd: new Date(AGORA.getTime() - DIA) });
    expect(calcularSituacao("c1", pago, dono, AGORA, cobrando).podeUsar).toBe(true);
    expect(calcularSituacao("c1", vencido, dono, AGORA, cobrando)).toMatchObject({ status: "CANCELADA", podeUsar: false });
  });

  it("dono bloqueado bloqueia mesmo com a cobrança desligada", () => {
    const s = calcularSituacao("c1", assinatura({ status: "ACTIVE" }), { ...dono, bloqueadoEm: AGORA }, AGORA, {
      cobrancaObrigatoria: false,
    });
    expect(s).toMatchObject({ status: "BLOQUEADA", podeUsar: false });
  });

  it("sem cobrança configurada ninguém é bloqueado por vencimento", () => {
    const fim = new Date(AGORA.getTime() - 30 * DIA);
    const s = calcularSituacao("c1", assinatura({ trialEndsAt: fim }), dono, AGORA, { cobrancaObrigatoria: false });
    expect(s).toMatchObject({ status: "VENCIDA", podeUsar: true, inativaDesde: null });
  });
});

describe("obterSituacaoConta", () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COBRANCA_OBRIGATORIA = "1";
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("lê a assinatura do dono da conta e cria a que faltar com os dias de teste da configuração", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...dono, contaId: null, subscription: null });
    prismaMock.subscription.upsert.mockImplementation(async ({ create }) => ({ ...create, updatedAt: AGORA, plan: null, currentPeriodEnd: null }));

    const s = await obterSituacaoConta("dono-1", AGORA);

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "dono-1" } }));
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "dono-1" },
        create: expect.objectContaining({ trialEndsAt: new Date(AGORA.getTime() + 7 * DIA) }),
      })
    );
    expect(s).toMatchObject({ status: "TESTE", podeUsar: true, diasRestantesTeste: 7 });
  });
});

describe("contasSuspensasHaMaisDe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.COBRANCA_OBRIGATORIA = "1";
  });

  it("só pula contas paradas há mais dias que a tolerância", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "ativa", ...dono, subscription: assinatura({ status: "ACTIVE" }) },
      { id: "venceu-ontem", ...dono, subscription: assinatura({ trialEndsAt: new Date(AGORA.getTime() - DIA) }) },
      { id: "venceu-ha-10", ...dono, subscription: assinatura({ trialEndsAt: new Date(AGORA.getTime() - 10 * DIA) }) },
    ]);
    const suspensas = await contasSuspensasHaMaisDe(["ativa", "venceu-ontem", "venceu-ha-10"], 3, AGORA);
    expect([...suspensas]).toEqual(["venceu-ha-10"]);
  });
});
