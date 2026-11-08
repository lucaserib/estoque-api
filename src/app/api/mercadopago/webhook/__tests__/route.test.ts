import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = {
  subscription: {
    findUnique: vi.fn(),
    update: vi.fn(async () => ({})),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const mp = {
  getPreapproval: vi.fn(),
  getPayment: vi.fn(),
  updatePreapprovalAmount: vi.fn(),
};
vi.mock("@/services/mercadoPagoService", () => ({ MercadoPagoService: mp }));

const cobranca = {
  processarPreapprovalIa: vi.fn(async () => "ATIVA"),
  processarPagamentoIa: vi.fn(async () => "ATIVA"),
  cancelarIaJuntoComPrincipal: vi.fn(async () => true),
};
vi.mock("@/modules/ia/cobranca", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ia/cobranca")>()),
  ...cobranca,
}));

const { POST } = await import("../route");

function notificacao(type: string, id: string) {
  return new NextRequest("https://app.skubo.com.br/api/mercadopago/webhook", {
    method: "POST",
    body: JSON.stringify({ type, data: { id } }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MP_WEBHOOK_SECRET;
});

describe("webhook do Mercado Pago com o add-on de IA", () => {
  it("preapproval com referência ia: vai para a IA e não mexe na assinatura principal", async () => {
    mp.getPreapproval.mockResolvedValue({ id: "pre-ia", status: "authorized", external_reference: "ia:conta-1" });
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const r = await POST(notificacao("subscription_preapproval", "pre-ia"));
    expect(r.status).toBe(200);
    expect(cobranca.processarPreapprovalIa).toHaveBeenCalledWith(expect.objectContaining({ id: "pre-ia" }));
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });

  it("reconhece o preapproval da IA pelo mpPreapprovalIaId mesmo sem referência", async () => {
    mp.getPreapproval.mockResolvedValue({ id: "pre-ia", status: "cancelled", external_reference: null });
    prismaMock.subscription.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.mpPreapprovalIaId === "pre-ia" ? { id: "sub-1" } : null
    );
    await POST(notificacao("preapproval", "pre-ia"));
    expect(cobranca.processarPreapprovalIa).toHaveBeenCalled();
  });

  it("pagamento com referência ia: vai para a IA", async () => {
    mp.getPayment.mockResolvedValue({ id: 9, status: "approved", external_reference: "ia:conta-1" });
    await POST(notificacao("payment", "9"));
    expect(cobranca.processarPagamentoIa).toHaveBeenCalledWith(expect.objectContaining({ status: "approved" }));
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });

  it("cancelamento da assinatura principal cancela também a IA", async () => {
    mp.getPreapproval.mockResolvedValue({ id: "pre-main", status: "cancelled", external_reference: "conta-1" });
    prismaMock.subscription.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.mpPreapprovalId === "pre-main" ? { id: "sub-1", userId: "conta-1", plan: "MONTHLY" } : null
    );
    await POST(notificacao("subscription_preapproval", "pre-main"));
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({ where: { id: "sub-1" }, data: { status: "CANCELED" } });
    expect(cobranca.cancelarIaJuntoComPrincipal).toHaveBeenCalledWith("conta-1");
    expect(cobranca.processarPreapprovalIa).not.toHaveBeenCalled();
  });

  it("pagamento da assinatura principal segue o fluxo antigo", async () => {
    mp.getPayment.mockResolvedValue({ id: 10, status: "approved", external_reference: "conta-1" });
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: "sub-1",
      mpPreapprovalId: "pre-main",
      plan: "ANNUAL",
      billingCyclesCompleted: 0,
    });
    await POST(notificacao("payment", "10"));
    expect(cobranca.processarPagamentoIa).not.toHaveBeenCalled();
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { status: "ACTIVE", billingCyclesCompleted: 1 },
    });
  });
});
