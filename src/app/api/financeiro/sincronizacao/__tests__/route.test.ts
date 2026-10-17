import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const sincronizarFinanceiroMock = vi.fn();
const obterTravaAtivaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/orquestrador", () => ({
  sincronizarFinanceiro: (...args: unknown[]) => sincronizarFinanceiroMock(...args),
  obterTravaAtiva: (...args: unknown[]) => obterTravaAtivaMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; isActive: boolean; id?: string };
        }) => {
          if (where.userId !== "conta-dona") return null;
          if (where.id && where.id !== "conta-ml-1") return null;
          return { id: "conta-ml-1" };
        }
      ),
    },
  },
}));

function criarRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/financeiro/sincronizacao", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  sincronizarFinanceiroMock.mockReset();
  obterTravaAtivaMock.mockReset();
  obterTravaAtivaMock.mockResolvedValue(null);
});

describe("POST /api/financeiro/sincronizacao", () => {
  it("responde 403 para quem não tem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "LEITURA" });

    const response = await POST(criarRequest() as never);
    expect(response.status).toBe(403);
  });

  it("responde 404 quando não há conta ML ativa", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-sem-ml", role: "ADMIN" });

    const response = await POST(criarRequest() as never);
    expect(response.status).toBe(404);
  });

  it("chama o orquestrador com o modo pedido e devolve o resultado", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    sincronizarFinanceiroMock.mockResolvedValue({
      status: "CONCLUIDO", processados: 5, erros: 0, proximoPasso: null,
    });

    const response = await POST(criarRequest({ modo: "PERIODO", desde: "2026-05-01" }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("CONCLUIDO");
    expect(sincronizarFinanceiroMock).toHaveBeenCalledWith(
      "conta-ml-1",
      expect.objectContaining({ modo: "PERIODO" })
    );
  });

  it("não inicia uma nova sincronização quando já há uma em andamento (trava por conta)", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    obterTravaAtivaMock.mockResolvedValue({ id: "sinc-ativa" });

    const response = await POST(criarRequest({ modo: "INCREMENTAL" }) as never);
    const body = await response.json();

    expect(body.status).toBe("EM_ANDAMENTO");
    expect(sincronizarFinanceiroMock).not.toHaveBeenCalled();
  });

  it("modo inválido cai para INCREMENTAL", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    sincronizarFinanceiroMock.mockResolvedValue({
      status: "CONCLUIDO", processados: 0, erros: 0, proximoPasso: null,
    });

    await POST(criarRequest({ modo: "QUALQUER_COISA" }) as never);

    expect(sincronizarFinanceiroMock).toHaveBeenCalledWith(
      "conta-ml-1",
      expect.objectContaining({ modo: "INCREMENTAL" })
    );
  });
});
