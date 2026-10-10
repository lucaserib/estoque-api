import { describe, it, expect, vi, beforeEach } from "vitest";

const ingerirPedidoMercadoLivreMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({
  ingerirPedidoMercadoLivre: ingerirPedidoMercadoLivreMock,
}));

const { MercadoLivreService } = await import("@/services/mercadoLivreService");

function chamarProcessOrderWebhookFinanceiro(accountId: string, resource: string) {
  return (
    MercadoLivreService as unknown as {
      processOrderWebhookFinanceiro: (accountId: string, resource: string) => Promise<void>;
    }
  ).processOrderWebhookFinanceiro(accountId, resource);
}

beforeEach(() => {
  ingerirPedidoMercadoLivreMock.mockReset();
});

describe("MercadoLivreService — ingestão financeira a partir do webhook (Ciclo 7 Fase 3)", () => {
  it("extrai o id do pedido do resource e chama a ingestão financeira", async () => {
    ingerirPedidoMercadoLivreMock.mockResolvedValue({ ingerido: true });

    await chamarProcessOrderWebhookFinanceiro("conta-1", "/orders/123456");

    expect(ingerirPedidoMercadoLivreMock).toHaveBeenCalledWith("conta-1", "123456");
  });

  it("não propaga erro da ingestão financeira — não pode derrubar o webhook de estoque", async () => {
    ingerirPedidoMercadoLivreMock.mockRejectedValue(new Error("ML indisponível"));

    await expect(
      chamarProcessOrderWebhookFinanceiro("conta-1", "/orders/999")
    ).resolves.toBeUndefined();
  });

  it("resource sem id não chama a ingestão", async () => {
    await chamarProcessOrderWebhookFinanceiro("conta-1", "/orders/");

    expect(ingerirPedidoMercadoLivreMock).not.toHaveBeenCalled();
  });
});
