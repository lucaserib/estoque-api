import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const enfileirarPeriodoMock = vi.fn();
const executarFilaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/fila", () => ({
  enfileirarPeriodo: (accountId: string, desde: Date, ate: Date, prioridade: number, forcar: boolean) =>
    enfileirarPeriodoMock(accountId, desde, ate, prioridade, forcar),
  executarFila: (userId: string, accountId: string) => executarFilaMock(userId, accountId),
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
  enfileirarPeriodoMock.mockReset();
  executarFilaMock.mockReset();
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

  it("enfileira PEDIDOS_PERIODO com prioridade alta para os dias pedidos e devolve o status da fila", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    executarFilaMock.mockResolvedValue({ status: "EM_ANDAMENTO", processados: 10 });

    const response = await POST(criarRequest({ dias: 180 }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "EM_ANDAMENTO", processados: 10 });
    expect(enfileirarPeriodoMock).toHaveBeenCalledWith(
      "conta-ml-1",
      expect.any(Date),
      expect.any(Date),
      20,
      false
    );
    expect(executarFilaMock).toHaveBeenCalledWith("conta-dona", "conta-ml-1");
  });

  it("usa 365 dias por padrão quando 'dias' não é informado", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    executarFilaMock.mockResolvedValue({ status: "CONCLUIDO", processados: 0 });

    await POST(criarRequest({}) as never);

    const [, desde, ate] = enfileirarPeriodoMock.mock.calls[0] as [string, Date, Date, number];
    const dias = Math.round((ate.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000));
    expect(dias).toBe(365);
  });

  it("Ciclo 9 (item 7): repassa forcar:true para reprocessar mesmo o que já está completo", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    executarFilaMock.mockResolvedValue({ status: "EM_ANDAMENTO", processados: 10 });

    await POST(criarRequest({ dias: 365, forcar: true }) as never);

    expect(enfileirarPeriodoMock).toHaveBeenCalledWith(
      "conta-ml-1",
      expect.any(Date),
      expect.any(Date),
      20,
      true
    );
  });
});
