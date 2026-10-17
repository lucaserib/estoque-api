import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const findFirstMock = vi.fn();
const countMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    sincronizacaoFinanceira: { findFirst: (...args: unknown[]) => findFirstMock(...args) },
    sincronizacaoFinanceiraErro: { count: (...args: unknown[]) => countMock(...args) },
  },
}));

function criarRequest() {
  return new Request("http://localhost/api/financeiro/sincronizacao/status");
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  findFirstMock.mockReset();
  countMock.mockReset();
  countMock.mockResolvedValue(0);
});

describe("GET /api/financeiro/sincronizacao/status", () => {
  it("responde 403 para quem não tem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "COMPRAS" });

    const response = await GET(criarRequest() as never);
    expect(response.status).toBe(403);
  });

  it("devolve o status para ADMIN", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    findFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    countMock.mockResolvedValue(2);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.emAndamento).toBeNull();
    expect(body.errosPendentes).toBe(2);
  });

  it("devolve a sincronização em andamento e a última concluída", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    const concluidaEm = new Date("2026-05-10T10:00:00.000Z");
    findFirstMock
      .mockResolvedValueOnce({ concluidoEm: concluidaEm })
      .mockResolvedValueOnce({ tipo: "INCREMENTAL", processados: 7, iniciadoEm: new Date() });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.emAndamento.tipo).toBe("INCREMENTAL");
    expect(body.ultimaSincronizacaoConcluidaEm).toBe(concluidaEm.toISOString());
  });
});
