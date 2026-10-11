import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const gerarDreMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/dre", () => ({
  gerarDre: (...args: unknown[]) => gerarDreMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/dre${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  gerarDreMock.mockReset();
});

describe("GET /api/financeiro/dre", () => {
  it("responde 403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await GET(criarRequest("?ate=2026-05"));
    expect(response.status).toBe(403);
  });

  it("responde 400 com ate em formato inválido", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    const response = await GET(criarRequest("?ate=2026/05"));
    expect(response.status).toBe(400);
  });

  it("limita meses a 12 e passa os filtros", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarDreMock.mockResolvedValue({ meses: [] });

    await GET(criarRequest("?ate=2026-05&meses=20&canal=MERCADO_LIVRE"));

    expect(gerarDreMock).toHaveBeenCalledWith(
      "conta-1", { ano: 2026, mes: 5 }, 12,
      expect.objectContaining({ canal: "MERCADO_LIVRE" })
    );
  });

  it("meses default é 1 quando ausente", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    gerarDreMock.mockResolvedValue({ meses: [] });

    await GET(criarRequest("?ate=2026-05"));

    expect(gerarDreMock).toHaveBeenCalledWith("conta-1", { ano: 2026, mes: 5 }, 1, expect.anything());
  });
});
