import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const continuarBackfillMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({
  continuarBackfill: (accountId: string, dias?: number) =>
    continuarBackfillMock(accountId, dias),
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
  return new Request("http://localhost/api/financeiro/sincronizacao/importar-historico", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  continuarBackfillMock.mockReset();
});

describe("POST /api/financeiro/sincronizacao/importar-historico", () => {
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

  it("inicia o backfill na conta ativa e devolve o status", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    continuarBackfillMock.mockResolvedValue({ status: "EM_ANDAMENTO", processados: 10 });

    const response = await POST(criarRequest({ dias: 180 }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "EM_ANDAMENTO", processados: 10 });
    expect(continuarBackfillMock).toHaveBeenCalledWith("conta-ml-1", 180);
  });
});
