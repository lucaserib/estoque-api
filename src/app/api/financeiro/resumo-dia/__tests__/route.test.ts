import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarResumoDiaMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/resumoDia", () => ({
  gerarResumoDia: (...args: unknown[]) => gerarResumoDiaMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/resumo-dia${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarResumoDiaMock.mockReset();
});

describe("GET /api/financeiro/resumo-dia", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequest(""));
    expect(response.status).toBe(403);
  });

  it("usa a data informada quando presente", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarResumoDiaMock.mockResolvedValue({});

    await GET(criarRequest("?dia=2026-05-15"));

    expect(gerarResumoDiaMock).toHaveBeenCalledWith("conta-1", new Date("2026-05-15"), undefined);
  });

  it("usa hoje quando a data não é informada", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarResumoDiaMock.mockResolvedValue({});

    await GET(criarRequest(""));

    expect(gerarResumoDiaMock).toHaveBeenCalledWith("conta-1", expect.any(Date), undefined);
  });
});
