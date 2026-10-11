import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const registrarCompraNoCartaoMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/cartao", () => ({
  registrarCompraNoCartao: (...args: unknown[]) => registrarCompraNoCartaoMock(...args),
}));

function criarRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/cartoes/compras", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  registrarCompraNoCartaoMock.mockReset();
});

describe("POST /api/financeiro/cartoes/compras", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "LEITURA" });
    const response = await POST(criarRequest({}) as never);
    expect(response.status).toBe(403);
  });

  it("responde 400 sem campos obrigatórios", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    const response = await POST(criarRequest({ descricao: "x" }) as never);
    expect(response.status).toBe(400);
  });

  it("registra a compra convertendo a data", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    registrarCompraNoCartaoMock.mockResolvedValue({ id: "lanc-1" });

    const response = await POST(
      criarRequest({
        contaFinanceiraId: "cartao-1", descricao: "Compra", valor: 5000, categoriaId: "cat-1",
        dataCompra: "2026-05-10",
      }) as never
    );

    expect(response.status).toBe(201);
    expect(registrarCompraNoCartaoMock).toHaveBeenCalledWith(
      "conta-1", "user-1", "cartao-1",
      expect.objectContaining({ dataCompra: new Date("2026-05-10") })
    );
  });

  it("erro de negócio (conta não é cartão) vira 400 com a mensagem original", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    registrarCompraNoCartaoMock.mockRejectedValue(new Error("Conta financeira não é um cartão de crédito"));

    const response = await POST(
      criarRequest({ contaFinanceiraId: "banco-1", descricao: "x", valor: 1, categoriaId: "c", dataCompra: "2026-05-10" }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Conta financeira não é um cartão de crédito");
  });
});
