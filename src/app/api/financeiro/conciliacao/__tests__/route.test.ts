import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarRelatorioConciliacaoMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/conciliacao", () => ({
  gerarRelatorioConciliacao: (userId: string, canal: string, mes: string) =>
    gerarRelatorioConciliacaoMock(userId, canal, mes),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/conciliacao${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarRelatorioConciliacaoMock.mockReset();
});

describe("GET /api/financeiro/conciliacao", () => {
  it("responde 403 para quem não tem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });

    const response = await GET(criarRequest("?mes=2026-05"));
    expect(response.status).toBe(403);
  });

  it("responde 400 com mes em formato inválido", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });

    const response = await GET(criarRequest("?mes=2026/05"));
    expect(response.status).toBe(400);
  });

  it("devolve o relatório gerado para a conta e o mês informados", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarRelatorioConciliacaoMock.mockResolvedValue({ mesReferencia: "2026-05", linhas: [] });

    const response = await GET(criarRequest("?mes=2026-05"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mesReferencia).toBe("2026-05");
    expect(gerarRelatorioConciliacaoMock).toHaveBeenCalledWith("conta-1", "MERCADO_LIVRE", "2026-05");
  });
});
