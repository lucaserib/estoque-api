import { beforeEach, describe, expect, it, vi } from "vitest";

type Assinatura = Record<string, unknown>;
let banco: Assinatura;

const prismaMock = {
  subscription: {
    findUnique: vi.fn(async ({ where }: { where: Record<string, string> }) => {
      if (where.mpPreapprovalIaId) return banco.mpPreapprovalIaId === where.mpPreapprovalIaId ? { ...banco } : null;
      if (where.userId) return banco.userId === where.userId ? { ...banco } : null;
      return null;
    }),
    update: vi.fn(async ({ data }: { data: Assinatura }) => {
      banco = { ...banco, ...data };
      return { ...banco };
    }),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const mp = {
  createPreapproval: vi.fn(async () => ({ id: "pre-ia-1", init_point: "https://mp/checkout/ia" })),
  cancelPreapproval: vi.fn(async () => ({})),
};
vi.mock("@/services/mercadoPagoService", () => ({ MercadoPagoService: mp }));
vi.mock("@/lib/subscription", () => ({
  getOrCreateSubscription: vi.fn(async () => ({ ...banco })),
  isSubscriptionActive: (s: Assinatura) => s.status === "ACTIVE" || s.status === "TRIALING",
}));

const {
  assinarIa,
  cancelarIa,
  cancelarIaJuntoComPrincipal,
  iniciarTesteIa,
  processarPagamentoIa,
  processarPreapprovalIa,
  referenciaIa,
} = await import("../cobranca");

const agora = new Date("2026-11-20T15:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  banco = {
    id: "sub-1",
    userId: "conta-1",
    status: "ACTIVE",
    iaStatus: "INATIVA",
    mpPreapprovalIaId: null,
    iaAtivadaEm: null,
    iaPeriodoFim: null,
    iaTesteIniciadoEm: null,
    iaLiberadaManual: false,
  };
});

describe("teste grátis", () => {
  it("inicia uma vez só por conta", async () => {
    await iniciarTesteIa("conta-1", agora);
    expect(banco).toMatchObject({ iaStatus: "TESTE", iaTesteIniciadoEm: agora });
    await expect(iniciarTesteIa("conta-1", agora)).rejects.toMatchObject({ codigo: "TESTE_JA_USADO" });
  });

  it("não inicia teste para quem já tem a IA", async () => {
    banco.iaLiberadaManual = true;
    await expect(iniciarTesteIa("conta-1", agora)).rejects.toMatchObject({ codigo: "JA_LIBERADA" });
  });
});

describe("assinarIa", () => {
  it("cria o preapproval mensal com referência ia:<conta> e guarda o id", async () => {
    const r = await assinarIa("conta-1", "dono@loja.com", "https://app.skubo.com.br");
    expect(r).toEqual({ checkoutUrl: "https://mp/checkout/ia" });
    expect(mp.createPreapproval).toHaveBeenCalledWith({
      reason: "Skubo IA — mensal",
      payerEmail: "dono@loja.com",
      transactionAmount: 29.9,
      frequency: 1,
      frequencyType: "months",
      backUrl: "https://app.skubo.com.br/assinatura?recurso=ia",
      externalReference: "ia:conta-1",
    });
    expect(banco.mpPreapprovalIaId).toBe("pre-ia-1");
  });

  it("exige a assinatura principal ativa ou em teste", async () => {
    banco.status = "CANCELED";
    await expect(assinarIa("conta-1", "x@y.com", "https://app")).rejects.toMatchObject({ codigo: "ASSINATURA_PRINCIPAL", status: 402 });
    expect(mp.createPreapproval).not.toHaveBeenCalled();
  });
});

describe("webhook da IA", () => {
  it("autorizado ativa, guarda o período e é idempotente", async () => {
    banco.mpPreapprovalIaId = "pre-ia-1";
    expect(await processarPreapprovalIa({ id: "pre-ia-1", status: "authorized", external_reference: "ia:conta-1" }, agora)).toBe("ATIVA");
    expect(banco).toMatchObject({ iaStatus: "ATIVA", iaAtivadaEm: agora });
    const fim = banco.iaPeriodoFim as Date;
    expect(fim.toISOString()).toBe("2026-12-20T00:00:00.000Z");

    const updatesAntes = prismaMock.subscription.update.mock.calls.length;
    await processarPreapprovalIa({ id: "pre-ia-1", status: "authorized", external_reference: "ia:conta-1" }, new Date("2026-11-25T00:00:00Z"));
    expect(prismaMock.subscription.update.mock.calls.length).toBe(updatesAntes);
    expect(banco.iaPeriodoFim).toBe(fim);
  });

  it("acha a conta pela referência quando o checkout veio de um preapproval antigo", async () => {
    banco.mpPreapprovalIaId = "pre-novo";
    await processarPreapprovalIa({ id: "pre-velho", status: "authorized", external_reference: referenciaIa("conta-1") }, agora);
    expect(banco).toMatchObject({ iaStatus: "ATIVA", mpPreapprovalIaId: "pre-velho" });
  });

  it("pagamento aprovado mantém ativa e estende o período; repetido não muda nada", async () => {
    banco = { ...banco, iaStatus: "ATIVA", iaPeriodoFim: new Date("2026-11-21T00:00:00Z") };
    const pagamento = { status: "approved", external_reference: "ia:conta-1", date_approved: "2026-11-21T10:00:00.000Z" };
    expect(await processarPagamentoIa(pagamento, agora)).toBe("ATIVA");
    expect((banco.iaPeriodoFim as Date).toISOString()).toBe("2026-12-21T00:00:00.000Z");
    const chamadas = prismaMock.subscription.update.mock.calls.length;
    await processarPagamentoIa(pagamento, agora);
    expect(prismaMock.subscription.update.mock.calls.length).toBe(chamadas);
  });

  it("pagamento rejeitado deixa pendente; cancelamento do preapproval cancela", async () => {
    banco = { ...banco, iaStatus: "ATIVA", mpPreapprovalIaId: "pre-ia-1" };
    expect(await processarPagamentoIa({ status: "rejected", external_reference: "ia:conta-1" }, agora)).toBe("PENDENTE");
    expect(await processarPagamentoIa({ status: "rejected", external_reference: "ia:conta-1" }, agora)).toBe("PENDENTE");
    expect(await processarPreapprovalIa({ id: "pre-ia-1", status: "cancelled", external_reference: "ia:conta-1" }, agora)).toBe("CANCELADA");
    expect(await processarPreapprovalIa({ id: "pre-ia-1", status: "cancelled", external_reference: "ia:conta-1" }, agora)).toBe("CANCELADA");
    expect(prismaMock.subscription.update).toHaveBeenCalledTimes(2);
  });

  it("ignora pagamento que não é da IA", async () => {
    expect(await processarPagamentoIa({ status: "approved", external_reference: "conta-1" }, agora)).toBeNull();
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });
});

describe("cancelamento", () => {
  it("cancela o preapproval e mantém o acesso até o fim do período pago", async () => {
    const fim = new Date("2026-12-10T00:00:00Z");
    banco = { ...banco, iaStatus: "ATIVA", mpPreapprovalIaId: "pre-ia-1", iaPeriodoFim: fim };
    const r = await cancelarIa("conta-1");
    expect(mp.cancelPreapproval).toHaveBeenCalledWith("pre-ia-1");
    expect(r).toMatchObject({ iaStatus: "CANCELADA", iaPeriodoFim: fim });
  });

  it("cancelar a assinatura principal cancela também a da IA", async () => {
    banco = { ...banco, iaStatus: "ATIVA", mpPreapprovalIaId: "pre-ia-1" };
    expect(await cancelarIaJuntoComPrincipal("conta-1")).toBe(true);
    expect(mp.cancelPreapproval).toHaveBeenCalledWith("pre-ia-1");
    expect(banco.iaStatus).toBe("CANCELADA");
    expect(await cancelarIaJuntoComPrincipal("conta-1")).toBe(false);
  });
});
