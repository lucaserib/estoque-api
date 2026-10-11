import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarFluxoCaixaMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/fluxoCaixa", () => ({
  gerarFluxoCaixa: (...args: unknown[]) => gerarFluxoCaixaMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/fluxo-caixa${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarFluxoCaixaMock.mockReset();
});

describe("GET /api/financeiro/fluxo-caixa", () => {
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

  it("granularidade default é DIA", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarFluxoCaixaMock.mockResolvedValue({ pontos: [] });

    await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31"));

    expect(gerarFluxoCaixaMock).toHaveBeenCalledWith("conta-1", new Date("2026-05-01"), new Date("2026-05-31"), "DIA");
  });

  it("repassa a granularidade informada", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarFluxoCaixaMock.mockResolvedValue({ pontos: [] });

    await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31&granularidade=MES"));

    expect(gerarFluxoCaixaMock).toHaveBeenCalledWith("conta-1", new Date("2026-05-01"), new Date("2026-05-31"), "MES");
  });
});
