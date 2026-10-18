import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const sincronizarSaldoMercadoPagoMock = vi.fn();
vi.mock("@/modules/financeiro/canais/mercadoPago/saldo", () => ({
  sincronizarSaldoMercadoPago: (...args: unknown[]) => sincronizarSaldoMercadoPagoMock(...args),
}));

const findManyMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { mercadoLivreAccount: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

function criarRequest() {
  return new Request("http://localhost/api/financeiro/contas-financeiras/sincronizar-saldo", { method: "POST" });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  sincronizarSaldoMercadoPagoMock.mockReset();
  findManyMock.mockReset();
});

describe("POST /api/financeiro/contas-financeiras/sincronizar-saldo", () => {
  it("responde 403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "LEITURA" });
    const response = await POST(criarRequest() as never);
    expect(response.status).toBe(403);
  });

  it("sincroniza o saldo de cada conta ML ativa da conta", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-1", role: "ADMIN" });
    findManyMock.mockResolvedValue([{ id: "ml-1" }, { id: "ml-2" }]);

    const response = await POST(criarRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sincronizadas).toBe(2);
    expect(sincronizarSaldoMercadoPagoMock).toHaveBeenCalledWith("ml-1");
    expect(sincronizarSaldoMercadoPagoMock).toHaveBeenCalledWith("ml-2");
  });
});
