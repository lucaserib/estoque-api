import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarResumoPeriodoMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/resumoDia", () => ({
  gerarResumoPeriodo: (...args: unknown[]) => gerarResumoPeriodoMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/resumo-periodo${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarResumoPeriodoMock.mockReset();
});

describe("GET /api/financeiro/resumo-periodo", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-07"));
    expect(response.status).toBe(403);
  });

  it("responde 400 sem desde/ate", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await GET(criarRequest(""));
    expect(response.status).toBe(400);
  });

  it("converte desde/ate e repassa o canal", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarResumoPeriodoMock.mockResolvedValue({});

    await GET(criarRequest("?desde=2026-05-01&ate=2026-05-07&canal=MERCADO_LIVRE"));

    expect(gerarResumoPeriodoMock).toHaveBeenCalledWith(
      "conta-1", new Date("2026-05-01"), new Date("2026-05-07"), "MERCADO_LIVRE"
    );
  });
});
