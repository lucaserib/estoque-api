import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarLucroPorProdutoMock = vi.fn();
const listarVendasComLucroMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/lucroPorProduto", () => ({
  gerarLucroPorProduto: (...args: unknown[]) => gerarLucroPorProdutoMock(...args),
}));
vi.mock("@/modules/financeiro/relatorios/lucroPorVenda", () => ({
  listarVendasComLucro: (...args: unknown[]) => listarVendasComLucroMock(...args),
}));

function criarRequest() {
  return new NextRequest("http://localhost/api/produtos/prod-1/resultado-financeiro");
}
function params() {
  return { params: Promise.resolve({ id: "prod-1" }) };
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarLucroPorProdutoMock.mockReset();
  listarVendasComLucroMock.mockReset();
  verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
  listarVendasComLucroMock.mockResolvedValue({ vendas: [], total: 0, pagina: 1, porPagina: 1 });
});

describe("GET /api/produtos/[id]/resultado-financeiro", () => {
  it("devolve zeros quando o produto não vendeu nos últimos 30 dias", async () => {
    gerarLucroPorProdutoMock.mockResolvedValue([]);

    const response = await GET(criarRequest(), params());
    const body = await response.json();

    expect(body.unidades).toBe(0);
    expect(body.margemContribuicao).toBe(0);
    expect(body.lucroLiquido).toBe(0);
  });

  it("devolve a linha do produto quando ele vendeu no período", async () => {
    gerarLucroPorProdutoMock.mockResolvedValue([
      { produtoId: "prod-1", unidades: 7, margemContribuicao: 15000, lucroLiquido: 9000 },
      { produtoId: "outro-produto", unidades: 99, margemContribuicao: 99999, lucroLiquido: 99999 },
    ]);

    const response = await GET(criarRequest(), params());
    const body = await response.json();

    expect(body.unidades).toBe(7);
    expect(body.margemContribuicao).toBe(15000);
    expect(body.lucroLiquido).toBe(9000);
  });

  it("repassa o filtro produtoId e soIncompletas para a contagem de vendas incompletas", async () => {
    gerarLucroPorProdutoMock.mockResolvedValue([]);
    listarVendasComLucroMock.mockResolvedValue({ vendas: [], total: 2, pagina: 1, porPagina: 1 });

    const response = await GET(criarRequest(), params());
    const body = await response.json();

    expect(body.vendasIncompletas).toBe(2);
    expect(listarVendasComLucroMock).toHaveBeenCalledWith(
      "conta-1",
      expect.objectContaining({ produtoId: "prod-1", soIncompletas: true })
    );
  });
});
