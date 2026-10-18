import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const obterStatusMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/statusSincronizacao", () => ({
  obterStatusSincronizacao: (...args: unknown[]) => obterStatusMock(...args),
}));

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  obterStatusMock.mockReset().mockResolvedValue({ contaConectada: true, pendente: false, tarefas: [] });
});

describe("GET /api/financeiro/sincronizacao/status", () => {
  it("responde 403 para quem não tem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "COMPRAS" });
    const response = await GET(new Request("http://localhost/x") as never);
    expect(response.status).toBe(403);
    expect(obterStatusMock).not.toHaveBeenCalled();
  });

  it("devolve o status da conta (sem processar nada na leitura)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    const response = await GET(new Request("http://localhost/x") as never);
    expect(response.status).toBe(200);
    expect(obterStatusMock).toHaveBeenCalledWith("conta-dona");
    expect(await response.json()).toMatchObject({ contaConectada: true, pendente: false });
  });
});
