import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const listarCobrancasNaoMapeadasMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/cobrancasNaoMapeadas", () => ({
  listarCobrancasNaoMapeadas: (...args: unknown[]) => listarCobrancasNaoMapeadasMock(...args),
}));

function criarRequestGet(query = "") {
  return new NextRequest(`http://localhost/api/financeiro/cobrancas-nao-mapeadas${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  listarCobrancasNaoMapeadasMock.mockReset();
});

describe("GET /api/financeiro/cobrancas-nao-mapeadas", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    expect((await GET(criarRequestGet())).status).toBe(403);
  });

  it("repassa o parâmetro mes e devolve as linhas", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    listarCobrancasNaoMapeadasMock.mockResolvedValue([{ tipoExterno: "x", quantidade: 1, total: 100 }]);

    const response = await GET(criarRequestGet("?mes=2026-05"));

    expect(response.status).toBe(200);
    expect((await response.json()).linhas).toHaveLength(1);
    expect(listarCobrancasNaoMapeadasMock).toHaveBeenCalledWith("conta-1", "2026-05");
  });
});
