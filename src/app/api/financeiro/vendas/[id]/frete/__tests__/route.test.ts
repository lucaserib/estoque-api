import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const definirAjusteManualFreteMock = vi.fn();
const limparAjusteManualFreteMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({
  definirAjusteManualFrete: (...args: unknown[]) => definirAjusteManualFreteMock(...args),
  limparAjusteManualFrete: (...args: unknown[]) => limparAjusteManualFreteMock(...args),
}));

const findFirstMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { vendaCanal: { findFirst: (...args: unknown[]) => findFirstMock(...args) } },
}));

function criarRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/financeiro/vendas/venda-1/frete", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function paramsPromise() {
  return { params: Promise.resolve({ id: "venda-1" }) };
}

const { PATCH } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  definirAjusteManualFreteMock.mockReset();
  limparAjusteManualFreteMock.mockReset();
  findFirstMock.mockReset();
});

describe("PATCH /api/financeiro/vendas/[id]/frete", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await PATCH(criarRequest({ valorReais: 10, motivo: "x" }) as never, paramsPromise());
    expect(response.status).toBe(403);
  });

  it("responde 404 quando a venda não existe na conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findFirstMock.mockResolvedValue(null);

    const response = await PATCH(criarRequest({ valorReais: 10, motivo: "x" }) as never, paramsPromise());
    expect(response.status).toBe(404);
  });

  it("responde 400 sem motivo ao definir um ajuste", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN", id: "user-1" });
    findFirstMock.mockResolvedValue({ id: "venda-1" });

    const response = await PATCH(criarRequest({ valorReais: 10 }) as never, paramsPromise());
    expect(response.status).toBe(400);
    expect(definirAjusteManualFreteMock).not.toHaveBeenCalled();
  });

  it("responde 400 para valorReais negativo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN", id: "user-1" });
    findFirstMock.mockResolvedValue({ id: "venda-1" });

    const response = await PATCH(criarRequest({ valorReais: -1, motivo: "x" }) as never, paramsPromise());
    expect(response.status).toBe(400);
  });

  it("define o ajuste manual em centavos com o motivo e o usuário atual", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN", id: "user-1" });
    findFirstMock.mockResolvedValue({ id: "venda-1" });

    const response = await PATCH(
      criarRequest({ valorReais: 11.5, motivo: "Combinado com o cliente" }) as never,
      paramsPromise()
    );

    expect(response.status).toBe(200);
    expect(definirAjusteManualFreteMock).toHaveBeenCalledWith(
      "venda-1",
      1150,
      "Combinado com o cliente",
      "user-1"
    );
  });

  it("valorReais null limpa o ajuste e reprocessa a venda", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN", id: "user-1" });
    findFirstMock.mockResolvedValue({ id: "venda-1" });

    const response = await PATCH(criarRequest({ valorReais: null }) as never, paramsPromise());

    expect(response.status).toBe(200);
    expect(limparAjusteManualFreteMock).toHaveBeenCalledWith("venda-1");
    expect(definirAjusteManualFreteMock).not.toHaveBeenCalled();
  });
});
