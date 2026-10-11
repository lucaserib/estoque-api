import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarSaldoProjetadoMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/fluxoCaixa", () => ({
  gerarSaldoProjetado: (...args: unknown[]) => gerarSaldoProjetadoMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/fluxo-caixa/saldo-projetado${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarSaldoProjetadoMock.mockReset();
});

describe("GET /api/financeiro/fluxo-caixa/saldo-projetado", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequest(""));
    expect(response.status).toBe(403);
  });

  it("default é 30 dias", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarSaldoProjetadoMock.mockResolvedValue({});

    await GET(criarRequest(""));

    expect(gerarSaldoProjetadoMock).toHaveBeenCalledWith("conta-1", 30);
  });

  it("valor fora de 30/60/90 cai para 30", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarSaldoProjetadoMock.mockResolvedValue({});

    await GET(criarRequest("?dias=45"));

    expect(gerarSaldoProjetadoMock).toHaveBeenCalledWith("conta-1", 30);
  });

  it("aceita 60 e 90", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarSaldoProjetadoMock.mockResolvedValue({});

    await GET(criarRequest("?dias=60"));
    expect(gerarSaldoProjetadoMock).toHaveBeenCalledWith("conta-1", 60);

    await GET(criarRequest("?dias=90"));
    expect(gerarSaldoProjetadoMock).toHaveBeenCalledWith("conta-1", 90);
  });
});
