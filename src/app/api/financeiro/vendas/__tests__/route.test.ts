import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const listarVendasComLucroMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/lucroPorVenda", () => ({
  listarVendasComLucro: (...args: unknown[]) => listarVendasComLucroMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/vendas${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  listarVendasComLucroMock.mockReset();
});

describe("GET /api/financeiro/vendas", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequest(""));
    expect(response.status).toBe(403);
  });

  it("converte os booleanos de query corretamente", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    listarVendasComLucroMock.mockResolvedValue({ vendas: [], total: 0 });

    await GET(criarRequest("?soPrejuizo=true&soIncompletas=false"));

    expect(listarVendasComLucroMock).toHaveBeenCalledWith(
      "conta-1",
      expect.objectContaining({ soPrejuizo: true, soIncompletas: false })
    );
  });
});
