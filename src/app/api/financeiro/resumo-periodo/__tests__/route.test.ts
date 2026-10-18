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
      "conta-1", expect.any(Date), expect.any(Date), "MERCADO_LIVRE"
    );
  });

  it("C3 (Ciclo 9): sempre normaliza desde/ate para o início/fim do dia em SP, incluindo o dia de hoje", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarResumoPeriodoMock.mockResolvedValue({});

    await GET(criarRequest("?desde=2026-05-01T00:00:00.000Z&ate=2026-05-01T00:00:00.000Z"));

    const [, desdeChamado, ateChamado] = gerarResumoPeriodoMock.mock.calls[0] as [string, Date, Date];
    expect(desdeChamado.toISOString()).toBe("2026-04-30T03:00:00.000Z");
    expect(ateChamado.toISOString()).toBe("2026-05-01T02:59:59.999Z");
  });
});
