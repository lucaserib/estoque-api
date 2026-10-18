import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const calcularResumoPorLogisticaMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/porLogistica", () => ({
  calcularResumoPorLogistica: (...args: unknown[]) => calcularResumoPorLogisticaMock(...args),
}));

function criarRequest(query: string) {
  return new NextRequest(`http://localhost/api/financeiro/por-logistica${query}`);
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  calcularResumoPorLogisticaMock.mockReset();
});

describe("GET /api/financeiro/por-logistica", () => {
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

  it("devolve o resumo por logística", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    calcularResumoPorLogisticaMock.mockResolvedValue([{ logistica: "fulfillment", pedidos: 1 }]);

    const response = await GET(criarRequest("?desde=2026-05-01&ate=2026-05-31"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.resumo).toEqual([{ logistica: "fulfillment", pedidos: 1 }]);
  });
});
