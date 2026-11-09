import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
  pagamentoPlataforma: { findUnique: vi.fn(), upsert: vi.fn(async () => ({})) },
  compraCreditoIa: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(async () => ({ id: "conta-1", name: "Ana", email: "ana@loja.com" })) },
}));
const mp = vi.hoisted(() => ({
  getPreapproval: vi.fn(),
  getPayment: vi.fn(),
  updatePreapprovalAmount: vi.fn(async () => ({})),
}));
const automacoes = vi.hoisted(() => ({ dispararAutomacao: vi.fn(async () => null) }));
const email = vi.hoisted(() => ({ enviarEmailSemFalhar: vi.fn(async () => null) }));
const eventos = vi.hoisted(() => ({ registrarEvento: vi.fn(async () => true) }));
const indicacao = vi.hoisted(() => ({
  aoPagamentoAprovadoDoIndicado: vi.fn(async () => undefined),
  aoEstornoDoIndicado: vi.fn(async () => undefined),
  aplicarPendentesDoTeste: vi.fn(async () => 0),
}));
const recompensa = vi.hoisted(() => ({ restaurarPrecoDepoisDoDesconto: vi.fn(async () => true) }));
const compras = vi.hoisted(() => ({ processarPagamentoCreditos: vi.fn(async () => "APROVADA") }));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/services/mercadoPagoService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/mercadoPagoService")>()),
  MercadoPagoService: mp,
}));
vi.mock("@/modules/email/automacoes", () => automacoes);
vi.mock("@/modules/email/enviar", () => email);
vi.mock("@/modules/clientes/eventos", () => eventos);
vi.mock("@/modules/indicacao/fluxo", () => indicacao);
vi.mock("@/modules/indicacao/recompensa", () => recompensa);
vi.mock("@/modules/marketing/metaCapi", () => ({ enviarEventoMeta: vi.fn(async () => false) }));
vi.mock("@/modules/conta/situacao", () => ({ invalidarSituacaoConta: vi.fn() }));
vi.mock("@/modules/ia/compraCreditos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ia/compraCreditos")>()),
  ...compras,
}));

const { POST } = await import("../route");

function notificacao(type: string, id: string, cabecalhos: Record<string, string> = {}) {
  return new NextRequest("https://app.skubo.com.br/api/mercadopago/webhook", {
    method: "POST",
    body: JSON.stringify({ type, data: { id } }),
    headers: cabecalhos,
  });
}

const assinaturaBase = {
  id: "sub-1",
  userId: "conta-1",
  status: "TRIALING",
  mpPreapprovalId: "pre-main",
  plan: "MONTHLY",
  billingCyclesCompleted: 0,
  currentPeriodStart: null,
  currentPeriodEnd: null,
  precoContratadoCentavos: 3790,
  descontoAplicadoCentavos: null,
  pausadaAte: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.MP_WEBHOOK_SECRET;
  prismaMock.pagamentoPlataforma.findUnique.mockResolvedValue(null);
});

describe("preapproval", () => {
  it("autorizada durante o teste: período começa na data da primeira cobrança", async () => {
    mp.getPreapproval.mockResolvedValue({
      id: "pre-main",
      status: "authorized",
      auto_recurring: { start_date: "2099-01-10T12:00:00.000Z" },
      next_payment_date: "2099-01-10T12:00:00.000Z",
    });
    prismaMock.subscription.findUnique.mockResolvedValueOnce(assinaturaBase);
    const resposta = await POST(notificacao("subscription_preapproval", "pre-main"));
    expect(await resposta.json()).toMatchObject({ resultado: "ATIVA" });
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({
        status: "ACTIVE",
        currentPeriodStart: new Date("2099-01-10T12:00:00.000Z"),
        currentPeriodEnd: new Date("2099-02-10T12:00:00.000Z"),
      }),
    });
    expect(eventos.registrarEvento).toHaveBeenCalledWith("conta-1", "ASSINOU", expect.anything());
  });

  it("preapproval do add-on de IA antigo é ignorado", async () => {
    mp.getPreapproval.mockResolvedValue({ id: "pre-ia", status: "authorized", external_reference: "ia:conta-1", auto_recurring: {} });
    prismaMock.subscription.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "sub-1" });
    const resposta = await POST(notificacao("subscription_preapproval", "pre-ia"));
    expect(await resposta.json()).toMatchObject({ resultado: "IGNORADO_ADDON_LEGADO" });
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });

  it("cancelada: marca, registra o evento e manda o e-mail com a pesquisa", async () => {
    mp.getPreapproval.mockResolvedValue({ id: "pre-main", status: "cancelled", auto_recurring: {} });
    prismaMock.subscription.findUnique.mockResolvedValueOnce({ ...assinaturaBase, status: "ACTIVE", currentPeriodEnd: new Date("2099-01-10") });
    await POST(notificacao("subscription_preapproval", "pre-main"));
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({ where: { id: "sub-1" }, data: { status: "CANCELED" } });
    expect(eventos.registrarEvento).toHaveBeenCalledWith("conta-1", "CANCELOU");
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(
      expect.objectContaining({ chave: "cancelou", variaveis: expect.objectContaining({ pesquisa: expect.stringContaining("/pesquisa/cancelamento?t=") }) })
    );
  });
});

describe("pagamento da assinatura", () => {
  it("primeiro pagamento: ativa, volta ao preço contratado, marca a indicação e manda o recibo", async () => {
    mp.getPayment.mockResolvedValue({
      id: 10,
      status: "approved",
      external_reference: "conta-1",
      date_approved: "2026-11-08T12:00:00.000Z",
      transaction_amount: 19.7,
      payer: { email: "Ana@Loja.com" },
    });
    prismaMock.subscription.findUnique.mockResolvedValue(assinaturaBase);
    const resposta = await POST(notificacao("payment", "10"));
    expect(await resposta.json()).toMatchObject({ resultado: "APROVADO" });
    expect(prismaMock.pagamentoPlataforma.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mpPaymentId: "10" },
        create: expect.objectContaining({ tipo: "ASSINATURA", valorCentavos: 1970, emailPagador: "ana@loja.com" }),
      })
    );
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: {
        status: "ACTIVE",
        billingCyclesCompleted: 1,
        currentPeriodStart: new Date("2026-11-08T12:00:00.000Z"),
        currentPeriodEnd: new Date("2026-12-08T12:00:00.000Z"),
      },
    });
    expect(mp.updatePreapprovalAmount).toHaveBeenCalledWith("pre-main", 37.9);
    expect(indicacao.aoPagamentoAprovadoDoIndicado).toHaveBeenCalledWith("conta-1", "10", expect.any(Date));
    expect(email.enviarEmailSemFalhar).toHaveBeenCalledWith(
      expect.objectContaining({ modelo: "recibo-assinatura", chaveIdempotencia: "recibo-assinatura:10" })
    );
  });

  it("o mesmo pagamento aprovado de novo não conta dois ciclos", async () => {
    mp.getPayment.mockResolvedValue({ id: 10, status: "approved", external_reference: "conta-1" });
    prismaMock.subscription.findUnique.mockResolvedValue({ ...assinaturaBase, status: "ACTIVE", billingCyclesCompleted: 1 });
    prismaMock.pagamentoPlataforma.findUnique.mockResolvedValue({ status: "approved" });
    const resposta = await POST(notificacao("payment", "10"));
    expect(await resposta.json()).toMatchObject({ resultado: "REPETIDO" });
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
    expect(mp.updatePreapprovalAmount).not.toHaveBeenCalled();
  });

  it("pagamento com desconto de indicação aplicado restaura o preço cheio", async () => {
    mp.getPayment.mockResolvedValue({ id: 11, status: "approved", external_reference: "conta-1", transaction_amount: 28.1 });
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...assinaturaBase,
      status: "ACTIVE",
      billingCyclesCompleted: 3,
      descontoAplicadoCentavos: 884,
    });
    await POST(notificacao("payment", "11"));
    expect(recompensa.restaurarPrecoDepoisDoDesconto).toHaveBeenCalled();
    expect(indicacao.aoPagamentoAprovadoDoIndicado).not.toHaveBeenCalled();
  });

  it("recusado: inadimplente, evento e e-mail de falha", async () => {
    mp.getPayment.mockResolvedValue({ id: 12, status: "rejected", external_reference: "conta-1" });
    prismaMock.subscription.findUnique.mockResolvedValue({ ...assinaturaBase, status: "ACTIVE" });
    await POST(notificacao("payment", "12"));
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({ where: { id: "sub-1" }, data: { status: "PAST_DUE" } });
    expect(eventos.registrarEvento).toHaveBeenCalledWith("conta-1", "PAGAMENTO_FALHOU", expect.anything());
    expect(automacoes.dispararAutomacao).toHaveBeenCalledWith(
      expect.objectContaining({ chave: "pagamento-falhou", chaveIdempotencia: "pagamento-falhou:12" })
    );
  });

  it("estorno durante a carência invalida a indicação", async () => {
    mp.getPayment.mockResolvedValue({ id: 13, status: "refunded", external_reference: "conta-1" });
    prismaMock.subscription.findUnique.mockResolvedValue({ ...assinaturaBase, status: "ACTIVE" });
    await POST(notificacao("payment", "13"));
    expect(indicacao.aoEstornoDoIndicado).toHaveBeenCalledWith("conta-1", expect.stringContaining("estornado"));
  });
});

describe("pagamento de perguntas da IA", () => {
  it("vai para a compra de créditos e registra o pagamento como CREDITO_IA", async () => {
    mp.getPayment.mockResolvedValue({ id: 20, status: "approved", external_reference: "credito-ia:compra-1", transaction_amount: 29.7 });
    prismaMock.compraCreditoIa.findUnique.mockResolvedValue({ contaId: "conta-1" });
    const resposta = await POST(notificacao("payment", "20"));
    expect(await resposta.json()).toMatchObject({ resultado: "APROVADA" });
    expect(compras.processarPagamentoCreditos).toHaveBeenCalledWith(expect.objectContaining({ id: 20 }), expect.any(Date));
    expect(prismaMock.pagamentoPlataforma.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ tipo: "CREDITO_IA", compraId: "compra-1", contaId: "conta-1" }) })
    );
    expect(prismaMock.subscription.update).not.toHaveBeenCalled();
  });
});

describe("segurança do webhook do Mercado Pago", () => {
  it("em produção, sem MP_WEBHOOK_SECRET, recusa com 503 e não consulta nada", async () => {
    const ambiente = process.env as Record<string, string | undefined>;
    const anterior = ambiente.NODE_ENV;
    ambiente.NODE_ENV = "production";
    try {
      const resposta = await POST(notificacao("payment", "10"));
      expect(resposta.status).toBe(503);
      expect(mp.getPayment).not.toHaveBeenCalled();
    } finally {
      ambiente.NODE_ENV = anterior;
    }
  });

  it("com segredo, assinatura errada vira 401", async () => {
    process.env.MP_WEBHOOK_SECRET = "segredo";
    const resposta = await POST(notificacao("payment", "10", { "x-signature": "ts=1,v1=abc", "x-request-id": "r1" }));
    expect(resposta.status).toBe(401);
    expect(mp.getPayment).not.toHaveBeenCalled();
  });
});
