import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const sincronizarMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/orquestrador", () => ({
  sincronizarFinanceiro: (...args: unknown[]) => sincronizarMock(...args),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string } }) =>
        where.userId === "conta-dona" ? { id: "conta-ml-1" } : null
      ),
    },
  },
}));

function req(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });
}

const { POST } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  sincronizarMock.mockReset().mockResolvedValue({ status: "EM_ANDAMENTO", processados: 50, erros: 0, proximoPasso: "CONTINUAR" });
});

describe("POST /api/financeiro/sincronizacao/importar-historico", () => {
  it("403 sem FINANCEIRO_EDITAR", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "LEITURA" });
    expect((await POST(req() as never)).status).toBe(403);
  });

  it("404 sem conta ML", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "outra", role: "ADMIN" });
    expect((await POST(req() as never)).status).toBe(404);
  });

  it("reimporta 365 dias por padrão, com forcar, no modo BACKFILL", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    const r = await POST(req() as never);
    expect(r.status).toBe(200);
    const [conta, parametros] = sincronizarMock.mock.calls[0] as [string, { modo: string; desde: Date; ate: Date; forcar: boolean }];
    expect(conta).toBe("conta-ml-1");
    expect(parametros.modo).toBe("BACKFILL");
    expect(parametros.forcar).toBe(true);
    expect(Math.round((parametros.ate.getTime() - parametros.desde.getTime()) / 86400000)).toBe(365);
  });

  it("limita os dias pedidos a 730", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    await POST(req({ dias: 5000 }) as never);
    const parametros = (sincronizarMock.mock.calls[0] as [string, { desde: Date; ate: Date }])[1];
    expect(Math.round((parametros.ate.getTime() - parametros.desde.getTime()) / 86400000)).toBe(730);
  });
});
