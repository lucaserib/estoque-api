import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarSerieDiariaMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/resumoDia", () => ({
  gerarSerieDiaria: (...args: unknown[]) => gerarSerieDiariaMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/serie-diaria${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarSerieDiariaMock.mockReset();
});

describe("GET /api/financeiro/serie-diaria", () => {
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

  it("devolve os pontos da série", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarSerieDiariaMock.mockResolvedValue([{ dia: "2026-05-01", faturamentoBruto: 100, margemContribuicao: 10 }]);

    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-07"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pontos).toHaveLength(1);
  });
});
