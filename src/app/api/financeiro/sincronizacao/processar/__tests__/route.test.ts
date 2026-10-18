import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const executarFilaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/fila", () => ({
  executarFila: (...args: unknown[]) => executarFilaMock(...args),
}));
vi.mock("@/modules/financeiro/ingestao/statusSincronizacao", () => ({
  obterStatusSincronizacao: vi.fn(async () => ({ pendente: true })),
}));
let contaAtiva: { id: string } | null = { id: "conta-ml-1" };
vi.mock("@/lib/prisma", () => ({
  prisma: { mercadoLivreAccount: { findFirst: vi.fn(async () => contaAtiva) } },
}));

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  executarFilaMock.mockReset().mockResolvedValue({ status: "EM_ANDAMENTO", processados: 50, vendasDetalhadas: 8 });
  contaAtiva = { id: "conta-ml-1" };
});

describe("POST /api/financeiro/sincronizacao/processar", () => {
  it("403 sem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "dono", role: "ESTOQUE" });
    const r = await POST(new Request("http://localhost/x", { method: "POST" }) as never);
    expect(r.status).toBe(403);
  });

  it("404 sem conta do Mercado Livre", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "dono", role: "ADMIN" });
    contaAtiva = null;
    const r = await POST(new Request("http://localhost/x", { method: "POST" }) as never);
    expect(r.status).toBe(404);
  });

  it("processa a fila da conta por até 45 s e devolve resultado e status", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "dono", role: "ADMIN" });
    const r = await POST(new Request("http://localhost/x", { method: "POST" }) as never);
    expect(r.status).toBe(200);
    expect(executarFilaMock).toHaveBeenCalledWith("dono", "conta-ml-1", 45000);
    expect(await r.json()).toMatchObject({ resultado: { processados: 50 }, status: { pendente: true } });
  });
});
