import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.CRON_SECRET = "segredo-cron";

const reprocessarUltimosDiasMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({
  reprocessarUltimosDias: (accountId: string) => reprocessarUltimosDiasMock(accountId),
}));

const ingerirGastosAdsDoDiaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/ingestaoAds", () => ({
  ingerirGastosAdsDoDia: (accountId: string, dia: Date) => ingerirGastosAdsDoDiaMock(accountId, dia),
}));

const ingerirCobrancasDoMesMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/ingestaoCobrancas", () => ({
  ingerirCobrancasDoMes: (accountId: string, mes: string) => ingerirCobrancasDoMesMock(accountId, mes),
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
  ingerirGastosAdsDoDiaMock.mockReset().mockResolvedValue({ processados: 0 });
  ingerirCobrancasDoMesMock.mockReset().mockResolvedValue({ processadas: 0, naoMapeadas: 0 });
});

describe("GET /api/cron/financeiro-diario", () => {
  it("responde 401 sem o CRON_SECRET correto", async () => {
    const response = await GET(criarRequest("Bearer errado"));
    expect(response.status).toBe(401);
  });

  it("reprocessa todas as contas ativas e soma os pedidos, ads e cobranças processados", async () => {
    reprocessarUltimosDiasMock
      .mockResolvedValueOnce({ processados: 3 })
      .mockResolvedValueOnce({ processados: 2 });
    ingerirGastosAdsDoDiaMock
      .mockResolvedValueOnce({ processados: 1 })
      .mockResolvedValueOnce({ processados: 4 });
    ingerirCobrancasDoMesMock
      .mockResolvedValueOnce({ processadas: 2, naoMapeadas: 0 })
      .mockResolvedValueOnce({ processadas: 0, naoMapeadas: 0 });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contasProcessadas).toBe(2);
    expect(body.pedidosProcessados).toBe(5);
    expect(body.gastosAdsProcessados).toBe(5);
    expect(body.cobrancasProcessadas).toBe(2);
    expect(body.erros).toBe(0);
    expect(reprocessarUltimosDiasMock).toHaveBeenCalledWith("conta-1");
    expect(reprocessarUltimosDiasMock).toHaveBeenCalledWith("conta-2");
    expect(ingerirGastosAdsDoDiaMock).toHaveBeenCalledWith("conta-1", expect.any(Date));
    expect(ingerirCobrancasDoMesMock).toHaveBeenCalledWith("conta-1", expect.stringMatching(/^\d{4}-\d{2}$/));
  });

  it("uma conta com erro no reprocessamento de pedidos não impede ads/cobranças nem as demais contas", async () => {
    reprocessarUltimosDiasMock
      .mockRejectedValueOnce(new Error("ML indisponível"))
      .mockResolvedValueOnce({ processados: 4 });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contasProcessadas).toBe(1);
    expect(body.pedidosProcessados).toBe(4);
    expect(body.erros).toBe(1);
    expect(ingerirGastosAdsDoDiaMock).toHaveBeenCalledTimes(2);
  });

  it("erro em ads de uma conta é contado mas não derruba a rota", async () => {
    reprocessarUltimosDiasMock.mockResolvedValue({ processados: 1 });
    ingerirGastosAdsDoDiaMock.mockRejectedValueOnce(new Error("endpoint de ads indisponível"));
    ingerirGastosAdsDoDiaMock.mockResolvedValueOnce({ processados: 1 });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.erros).toBe(1);
    expect(body.gastosAdsProcessados).toBe(1);
  });
});
