import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const AGORA = new Date("2026-11-10T12:00:00.000Z");
const FIM_TESTE = new Date("2026-11-14T12:00:00.000Z");

const prismaMock = vi.hoisted(() => ({ subscription: { update: vi.fn(async () => ({})) } }));
const mp = vi.hoisted(() => ({ createPreapproval: vi.fn(async () => ({ id: "pre-1", init_point: "https://mp/checkout" })) }));
const situacao = vi.hoisted(() => ({
  criarAssinaturaDaConta: vi.fn(),
  invalidarSituacaoConta: vi.fn(),
}));
const cupons = vi.hoisted(() => ({ validarCupom: vi.fn(), registrarUsoCupom: vi.fn(async () => true) }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/helpers/verifyUser", () => ({
  verifyUser: vi.fn(async () => ({ id: "dono-1", contaId: "dono-1", role: "ADMIN", email: "dono@loja.com" })),
}));
vi.mock("@/services/mercadoPagoService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/mercadoPagoService")>()),
  MercadoPagoService: mp,
  isMercadoPagoConfigured: () => true,
}));
vi.mock("@/modules/conta/situacao", () => situacao);
vi.mock("@/modules/comercial/configuracao", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/comercial/configuracao")>()),
  obterConfiguracaoComercial: vi.fn(async () => ({
    versao: 3,
    precoMensalCentavos: 3790,
    precoPrimeiroMesCentavos: 1970,
    precoAnualCentavos: 38970,
  })),
}));
vi.mock("@/modules/comercial/cupons", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/comercial/cupons")>()),
  ...cupons,
}));

const { POST } = await import("../route");

function pedido(corpo: unknown) {
  return new NextRequest("https://app.skubo.test/api/mercadopago/subscribe", { method: "POST", body: JSON.stringify(corpo) });
}

describe("POST /api/mercadopago/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ now: AGORA, toFake: ["Date"] });
    situacao.criarAssinaturaDaConta.mockResolvedValue({ id: "sub-1", status: "TRIALING", trialEndsAt: FIM_TESTE });
  });

  it("durante o teste, a cobrança começa no fim do teste e o preço contratado fica gravado", async () => {
    const resposta = await POST(pedido({ plan: "MONTHLY" }));
    expect(resposta.status).toBe(200);
    expect(mp.createPreapproval).toHaveBeenCalledWith(
      expect.objectContaining({ transactionAmount: 19.7, startDate: FIM_TESTE, externalReference: "dono-1" })
    );
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { userId: "dono-1" },
      data: expect.objectContaining({ plan: "MONTHLY", precoContratadoCentavos: 3790, configuracaoVersao: 3 }),
    });
  });

  it("teste vencido cobra na hora", async () => {
    situacao.criarAssinaturaDaConta.mockResolvedValue({ id: "sub-1", status: "TRIALING", trialEndsAt: new Date("2026-11-01") });
    await POST(pedido({ plan: "ANNUAL" }));
    expect(mp.createPreapproval).toHaveBeenCalledWith(expect.objectContaining({ transactionAmount: 389.7, startDate: null }));
  });

  it("cupom reduz a primeira cobrança e é registrado para a conta", async () => {
    cupons.validarCupom.mockResolvedValue({ cupom: { id: "cup-1" }, descontoCentavos: 970, precoFinalCentavos: 1000 });
    await POST(pedido({ plan: "MONTHLY", cupom: "bemvindo" }));
    expect(cupons.validarCupom).toHaveBeenCalledWith("bemvindo", "PRIMEIRA_COBRANCA_MENSAL", "dono-1", 1970, { referencia: "sub-1" });
    expect(mp.createPreapproval).toHaveBeenCalledWith(expect.objectContaining({ transactionAmount: 10 }));
    expect(cupons.registrarUsoCupom).toHaveBeenCalledWith("cup-1", "dono-1", "sub-1");
  });

  it("cupom inválido devolve 400 e não abre checkout", async () => {
    const { CupomInvalidoError } = await import("@/modules/comercial/cupons");
    cupons.validarCupom.mockRejectedValue(new CupomInvalidoError("Sua loja já usou este cupom."));
    const resposta = await POST(pedido({ plan: "MONTHLY", cupom: "repetido" }));
    expect(resposta.status).toBe(400);
    expect(mp.createPreapproval).not.toHaveBeenCalled();
  });
});
