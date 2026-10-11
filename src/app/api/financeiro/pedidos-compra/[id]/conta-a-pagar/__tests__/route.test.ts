import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarContaAPagarDePedidoCompraMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/pedidoCompra", () => ({
  gerarContaAPagarDePedidoCompra: (...args: unknown[]) => gerarContaAPagarDePedidoCompraMock(...args),
}));

function criarRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/pedidos-compra/42/conta-a-pagar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function paramsPromise() {
  return { params: Promise.resolve({ id: "42" }) };
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarContaAPagarDePedidoCompraMock.mockReset();
});

describe("POST /api/financeiro/pedidos-compra/[id]/conta-a-pagar", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "LEITURA" });
    const response = await POST(criarRequest({ vencimento: "2026-06-10" }) as never, paramsPromise());
    expect(response.status).toBe(403);
  });

  it("responde 400 sem vencimento", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    const response = await POST(criarRequest({}) as never, paramsPromise());
    expect(response.status).toBe(400);
  });

  it("gera a conta a pagar com o id do pedido convertido para número", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    gerarContaAPagarDePedidoCompraMock.mockResolvedValue({ lancamentos: [{ id: "lanc-1" }] });

    const response = await POST(
      criarRequest({ vencimento: "2026-06-10", numeroDeParcelas: 2 }) as never,
      paramsPromise()
    );

    expect(response.status).toBe(201);
    expect(gerarContaAPagarDePedidoCompraMock).toHaveBeenCalledWith(
      "conta-1", "user-1", 42,
      expect.objectContaining({ vencimento: new Date("2026-06-10"), numeroDeParcelas: 2 })
    );
  });

  it("pedido não confirmado vira 400 com a mensagem original", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    gerarContaAPagarDePedidoCompraMock.mockRejectedValue(
      new Error("Pedido de compra não encontrado ou ainda não confirmado")
    );

    const response = await POST(criarRequest({ vencimento: "2026-06-10" }) as never, paramsPromise());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Pedido de compra não encontrado ou ainda não confirmado");
  });
});
