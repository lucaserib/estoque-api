import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const criarCompraParceladaMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/parcelamento", () => ({
  criarCompraParcelada: (...args: unknown[]) => criarCompraParceladaMock(...args),
}));

function criarRequestPost(body: Record<string, unknown>) {
  return new Request("http://localhost/api/financeiro/lancamentos/parcelado", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { POST } = await import("../route");

const corpoValido = {
  descricao: "Notebook novo",
  valorTotal: 300000,
  categoriaId: "cat-1",
  competencia: "2026-10-01",
  primeiroVencimento: "2026-11-05",
  numeroDeParcelas: 3,
};

beforeEach(() => {
  verifyUserMock.mockReset();
  criarCompraParceladaMock.mockReset();
});

describe("POST /api/financeiro/lancamentos/parcelado", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "LEITURA" });
    const response = await POST(criarRequestPost(corpoValido) as never);
    expect(response.status).toBe(403);
  });

  it("responde 400 sem campos obrigatórios", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    const response = await POST(criarRequestPost({ descricao: "x" }) as never);
    expect(response.status).toBe(400);
  });

  it("cria a compra parcelada convertendo as datas", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", id: "user-1", role: "ADMIN" });
    criarCompraParceladaMock.mockResolvedValue({ grupoParcelamentoId: "grp-1", lancamentos: [] });

    const response = await POST(criarRequestPost(corpoValido) as never);

    expect(response.status).toBe(201);
    expect(criarCompraParceladaMock).toHaveBeenCalledWith(
      "conta-1",
      "user-1",
      expect.objectContaining({
        competencia: new Date("2026-10-01"),
        primeiroVencimento: new Date("2026-11-05"),
        numeroDeParcelas: 3,
      })
    );
  });
});
