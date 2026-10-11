import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarLucroPorProdutoMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/lucroPorProduto", () => ({
  gerarLucroPorProduto: (...args: unknown[]) => gerarLucroPorProdutoMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/produtos${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarLucroPorProdutoMock.mockReset();
});

describe("GET /api/financeiro/produtos", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31"));
    expect(response.status).toBe(403);
  });

  it("responde 400 sem desde/ate", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await GET(criarRequest(""));
    expect(response.status).toBe(400);
  });

  it("passa o período convertido e a ordenação", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarLucroPorProdutoMock.mockResolvedValue([]);

    await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31&ordenarPor=lucroLiquido&ordem=asc"));

    expect(gerarLucroPorProdutoMock).toHaveBeenCalledWith(
      "conta-1",
      expect.objectContaining({ desde: new Date("2026-05-01"), ate: new Date("2026-05-31") }),
      "lucroLiquido", "asc"
    );
  });
});
