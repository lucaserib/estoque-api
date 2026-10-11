import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const pagarFaturaMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/cartao", () => ({
  pagarFatura: (...args: unknown[]) => pagarFaturaMock(...args),
}));

function criarRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/cartoes/faturas/fat-1/pagar", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
function paramsPromise() {
  return { params: Promise.resolve({ id: "fat-1" }) };
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  pagarFaturaMock.mockReset();
});

describe("POST /api/financeiro/cartoes/faturas/[id]/pagar", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await POST(criarRequest({ contaBancariaId: "banco-1" }) as never, paramsPromise());
    expect(response.status).toBe(403);
  });

  it("responde 400 sem contaBancariaId", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await POST(criarRequest({}) as never, paramsPromise());
    expect(response.status).toBe(400);
  });

  it("paga a fatura e devolve o id do lançamento de pagamento", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    pagarFaturaMock.mockResolvedValue({ lancamentoPagamentoId: "lanc-99" });

    const response = await POST(criarRequest({ contaBancariaId: "banco-1" }) as never, paramsPromise());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lancamentoPagamentoId).toBe("lanc-99");
    expect(pagarFaturaMock).toHaveBeenCalledWith("conta-1", "fat-1", "banco-1", undefined);
  });

  it("fatura já paga vira 400 com a mensagem original", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    pagarFaturaMock.mockRejectedValue(new Error("Fatura já está paga"));

    const response = await POST(criarRequest({ contaBancariaId: "banco-1" }) as never, paramsPromise());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Fatura já está paga");
  });
});
