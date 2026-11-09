import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  compraCreditoIa: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
  loteCreditoIa: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn(async () => [{ id: "admin-1" }]) },
  notification: { create: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})) },
}));
const mp = vi.hoisted(() => ({ criarPreferencia: vi.fn(async () => ({ id: "pref-1", init_point: "https://mp/checkout/pref-1" })) }));
const mpConfig = vi.hoisted(() => ({ configurado: true }));
const creditos = vi.hoisted(() => ({
  concederLote: vi.fn(async () => ({ lote: { id: "lote-1", validoAte: new Date("2027-11-10") }, novo: true })),
  removerRestanteDoLote: vi.fn(async () => 7),
  saldoCreditos: vi.fn(async () => 25),
}));
const email = vi.hoisted(() => ({ enviarEmailSemFalhar: vi.fn(async () => null) }));
const eventos = vi.hoisted(() => ({ registrarEvento: vi.fn(async () => true) }));
const situacao = vi.hoisted(() => ({ obterSituacaoConta: vi.fn(async () => ({ podeUsar: true, status: "ATIVA" })) }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/services/mercadoPagoService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/mercadoPagoService")>()),
  MercadoPagoService: mp,
  isMercadoPagoConfigured: () => mpConfig.configurado,
}));
vi.mock("../creditos", async (importOriginal) => ({ ...(await importOriginal<typeof import("../creditos")>()), ...creditos }));
vi.mock("@/modules/email/enviar", () => email);
vi.mock("@/modules/clientes/eventos", () => eventos);
vi.mock("@/modules/conta/situacao", () => situacao);
vi.mock("@/modules/marketing/metaCapi", () => ({ enviarEventoMeta: vi.fn(async () => false) }));
vi.mock("@/modules/comercial/configuracao", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/modules/comercial/configuracao")>();
  return { ...original, obterConfiguracaoComercial: vi.fn(async () => original.CONFIGURACAO_PADRAO) };
});

import { CompraCreditosError, criarCompraCreditos, processarPagamentoCreditos } from "../compraCreditos";

const usuario = { id: "user-1", contaId: "conta-1", email: "ana@loja.com", emailVerificadoEm: new Date() };
const compra = {
  id: "compra-1",
  contaId: "conta-1",
  autorId: "user-1",
  pacoteId: "pacote-25",
  pacoteNome: "25 perguntas",
  perguntas: 25,
  precoCentavos: 2970,
  status: "PENDENTE",
  mpPaymentId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mpConfig.configurado = true;
  process.env.NEXT_PUBLIC_APP_URL = "https://app.skubo.test";
  prismaMock.compraCreditoIa.create.mockImplementation(async ({ data }) => ({ id: "compra-1", ...data }));
  prismaMock.compraCreditoIa.update.mockImplementation(async ({ data }) => ({ ...compra, ...data }));
  prismaMock.compraCreditoIa.findUnique.mockResolvedValue(compra);
  prismaMock.compraCreditoIa.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.user.findUnique.mockResolvedValue({ id: "user-1", name: "Ana", email: "ana@loja.com" });
});

describe("criar compra de perguntas", () => {
  it("abre o Checkout Pro com Pix e cartão, referência credito-ia e volta para /ia", async () => {
    const { checkoutUrl } = await criarCompraCreditos({ usuario, pacoteId: "pacote-25" });
    expect(checkoutUrl).toBe("https://mp/checkout/pref-1");
    const preferencia = (mp.criarPreferencia.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(preferencia).toMatchObject({
      external_reference: "credito-ia:compra-1",
      notification_url: "https://app.skubo.test/api/mercadopago/webhook",
      back_urls: { success: "https://app.skubo.test/ia?compra=compra-1" },
      items: [expect.objectContaining({ unit_price: 29.7 })],
      payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 1 },
      expires: true,
    });
    expect(prismaMock.compraCreditoIa.update).toHaveBeenCalledWith({ where: { id: "compra-1" }, data: { mpPreferenceId: "pref-1" } });
  });

  it("exige e-mail verificado, conta ativa e pacote existente", async () => {
    await expect(criarCompraCreditos({ usuario: { ...usuario, emailVerificadoEm: null }, pacoteId: "pacote-25" })).rejects.toMatchObject({
      codigo: "EMAIL_NAO_VERIFICADO",
    });
    situacao.obterSituacaoConta.mockResolvedValueOnce({ podeUsar: false, status: "VENCIDA" });
    await expect(criarCompraCreditos({ usuario, pacoteId: "pacote-25" })).rejects.toMatchObject({ status: 402 });
    await expect(criarCompraCreditos({ usuario, pacoteId: "nao-existe" })).rejects.toMatchObject({ status: 404 });
    expect(mp.criarPreferencia).not.toHaveBeenCalled();
  });

  it("sem Mercado Pago, avisa a equipe e responde 503", async () => {
    mpConfig.configurado = false;
    const erro = await criarCompraCreditos({ usuario, pacoteId: "pacote-25" }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(CompraCreditosError);
    expect((erro as CompraCreditosError).status).toBe(503);
    expect(prismaMock.notification.createMany).toHaveBeenCalled();
  });
});

describe("pagamento da compra", () => {
  it("aprovado: marca APROVADA, concede o lote da compra e manda o recibo", async () => {
    expect(await processarPagamentoCreditos({ id: 77, status: "approved", external_reference: "credito-ia:compra-1" })).toBe("APROVADA");
    expect(prismaMock.compraCreditoIa.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "compra-1", status: { in: ["PENDENTE", "RECUSADA", "EXPIRADA"] } } })
    );
    expect(creditos.concederLote).toHaveBeenCalledWith(
      expect.objectContaining({ contaId: "conta-1", origem: "COMPRA", quantidade: 25, chaveIdempotencia: "compra:compra-1", compraId: "compra-1" }),
      expect.any(Date)
    );
    expect(email.enviarEmailSemFalhar).toHaveBeenCalledWith(expect.objectContaining({ modelo: "recibo-creditos", chaveIdempotencia: "recibo-creditos:compra-1" }));
    expect(eventos.registrarEvento).toHaveBeenCalledWith("conta-1", "COMPROU_CREDITOS", expect.anything());
  });

  it("aprovado de novo não manda recibo nem concede outra vez", async () => {
    prismaMock.compraCreditoIa.findUnique.mockResolvedValue({ ...compra, status: "APROVADA", mpPaymentId: "77" });
    prismaMock.compraCreditoIa.updateMany.mockResolvedValue({ count: 0 });
    creditos.concederLote.mockResolvedValueOnce({ lote: { id: "lote-1", validoAte: new Date() }, novo: false });
    await processarPagamentoCreditos({ id: 77, status: "approved", external_reference: "credito-ia:compra-1" });
    expect(email.enviarEmailSemFalhar).not.toHaveBeenCalled();
  });

  it("recusado marca RECUSADA sem conceder nada", async () => {
    expect(await processarPagamentoCreditos({ id: 78, status: "rejected", external_reference: "credito-ia:compra-1" })).toBe("RECUSADA");
    expect(prismaMock.compraCreditoIa.updateMany).toHaveBeenCalledWith({ where: { id: "compra-1", status: "PENDENTE" }, data: { status: "RECUSADA", mpPaymentId: "78" } });
    expect(creditos.concederLote).not.toHaveBeenCalled();
  });

  it("estornado ou contestado tira o que sobrou do lote, sem saldo negativo", async () => {
    prismaMock.loteCreditoIa.findUnique.mockResolvedValue({ id: "lote-1" });
    expect(await processarPagamentoCreditos({ id: 77, status: "charged_back", external_reference: "credito-ia:compra-1" })).toBe("ESTORNADA");
    expect(creditos.removerRestanteDoLote).toHaveBeenCalledWith("lote-1", expect.stringContaining("Contestação"), "estorno-compra:compra-1");
  });

  it("referência que não é de crédito é ignorada", async () => {
    expect(await processarPagamentoCreditos({ id: 1, status: "approved", external_reference: "conta-1" })).toBe("IGNORADO");
  });
});
