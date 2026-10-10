import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.CRON_SECRET = "segredo-cron";

const reprocessarUltimosDiasMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({
  reprocessarUltimosDias: (accountId: string) => reprocessarUltimosDiasMock(accountId),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findMany: vi.fn(async () => [{ id: "conta-1" }, { id: "conta-2" }]),
    },
  },
}));

const { GET } = await import("../route");

function criarRequest(authorization?: string) {
  return new NextRequest("http://localhost/api/cron/financeiro-diario", {
    headers: authorization ? { authorization } : undefined,
  });
}

beforeEach(() => {
  reprocessarUltimosDiasMock.mockReset();
});

describe("GET /api/cron/financeiro-diario", () => {
  it("responde 401 sem o CRON_SECRET correto", async () => {
    const response = await GET(criarRequest("Bearer errado"));
    expect(response.status).toBe(401);
  });

  it("reprocessa todas as contas ativas e soma os pedidos processados", async () => {
    reprocessarUltimosDiasMock
      .mockResolvedValueOnce({ processados: 3 })
      .mockResolvedValueOnce({ processados: 2 });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contasProcessadas).toBe(2);
    expect(body.pedidosProcessados).toBe(5);
    expect(body.erros).toBe(0);
    expect(reprocessarUltimosDiasMock).toHaveBeenCalledWith("conta-1");
    expect(reprocessarUltimosDiasMock).toHaveBeenCalledWith("conta-2");
  });

  it("uma conta com erro não impede o processamento das demais", async () => {
    reprocessarUltimosDiasMock
      .mockRejectedValueOnce(new Error("ML indisponível"))
      .mockResolvedValueOnce({ processados: 4 });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contasProcessadas).toBe(1);
    expect(body.pedidosProcessados).toBe(4);
    expect(body.erros).toBe(1);
  });
});
