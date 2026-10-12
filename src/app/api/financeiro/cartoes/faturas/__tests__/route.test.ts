import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const listarFaturasMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/cartao", () => ({
  listarFaturas: (...args: unknown[]) => listarFaturasMock(...args),
}));

function criarRequestGet(query = "") {
  return new NextRequest(`http://localhost/api/financeiro/cartoes/faturas${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  listarFaturasMock.mockReset();
});

describe("GET /api/financeiro/cartoes/faturas", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    expect((await GET(criarRequestGet())).status).toBe(403);
  });

  it("lista as faturas da conta, repassando o filtro de cartão", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    listarFaturasMock.mockResolvedValue([{ id: "fat-1", total: 1000 }]);

    const response = await GET(criarRequestGet("?contaFinanceiraId=cartao-1"));

    expect(response.status).toBe(200);
    expect((await response.json()).faturas).toHaveLength(1);
    expect(listarFaturasMock).toHaveBeenCalledWith("conta-1", "cartao-1");
  });
});
