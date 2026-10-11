import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const obterDetalheVendaMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/lucroPorVenda", async () => {
  const actual = await vi.importActual<typeof import("@/modules/financeiro/relatorios/lucroPorVenda")>(
    "@/modules/financeiro/relatorios/lucroPorVenda"
  );
  return { ...actual, obterDetalheVenda: (...args: unknown[]) => obterDetalheVendaMock(...args) };
});

function criarRequest() {
  return new Request("http://localhost/api/financeiro/vendas/venda-1");
}
function paramsPromise() {
  return { params: Promise.resolve({ id: "venda-1" }) };
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  obterDetalheVendaMock.mockReset();
});

describe("GET /api/financeiro/vendas/[id]", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequest() as never, paramsPromise());
    expect(response.status).toBe(403);
  });

  it("responde 404 quando a venda não existe na conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const { VendaNaoEncontradaError } = await import("@/modules/financeiro/relatorios/lucroPorVenda");
    obterDetalheVendaMock.mockRejectedValue(new VendaNaoEncontradaError());

    const response = await GET(criarRequest() as never, paramsPromise());
    expect(response.status).toBe(404);
  });

  it("devolve o detalhe da venda", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    obterDetalheVendaMock.mockResolvedValue({ id: "venda-1" });

    const response = await GET(criarRequest() as never, paramsPromise());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.id).toBe("venda-1");
  });
});
