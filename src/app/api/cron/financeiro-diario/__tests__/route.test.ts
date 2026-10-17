import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.CRON_SECRET = "segredo-cron";

const reprocessarUltimosDiasMock = vi.fn();
const continuarBackfillMock = vi.fn();
const reprocessarErrosPendentesMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({
  reprocessarUltimosDias: (accountId: string) => reprocessarUltimosDiasMock(accountId),
  continuarBackfill: (accountId: string) => continuarBackfillMock(accountId),
  reprocessarErrosPendentes: (accountId: string) => reprocessarErrosPendentesMock(accountId),
}));

const ingerirGastosAdsDoDiaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/ingestaoAds", () => ({
  ingerirGastosAdsDoDia: (accountId: string, dia: Date) => ingerirGastosAdsDoDiaMock(accountId, dia),
}));

const ingerirCobrancasDoMesMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/ingestaoCobrancas", () => ({
  ingerirCobrancasDoMes: (accountId: string, mes: string) => ingerirCobrancasDoMesMock(accountId, mes),
}));

const gerarLancamentosDeTodasAsRecorrenciasMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/recorrencias", () => ({
  gerarLancamentosDeTodasAsRecorrencias: (userId: string) => gerarLancamentosDeTodasAsRecorrenciasMock(userId),
}));

const gerarAlertasFinanceirosMock = vi.fn();
vi.mock("@/modules/financeiro/alertas", () => ({
  gerarAlertasFinanceiros: (userId: string) => gerarAlertasFinanceirosMock(userId),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findMany: vi.fn(async () => [
        { id: "conta-1", userId: "dono-conta-1" },
        { id: "conta-2", userId: "dono-conta-2" },
      ]),
    },
    user: {
      findMany: vi.fn(async () => [{ id: "dono-1" }]),
    },
    sincronizacaoFinanceira: {
      findFirst: vi.fn(async () => null),
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
  continuarBackfillMock.mockReset().mockResolvedValue({ status: "EM_ANDAMENTO", processados: 0 });
  reprocessarErrosPendentesMock.mockReset().mockResolvedValue({ processados: 0 });
  ingerirGastosAdsDoDiaMock.mockReset().mockResolvedValue({ processados: 0 });
  ingerirCobrancasDoMesMock.mockReset().mockResolvedValue({ processadas: 0, naoMapeadas: 0 });
  gerarLancamentosDeTodasAsRecorrenciasMock.mockReset().mockResolvedValue({ gerados: 0 });
  gerarAlertasFinanceirosMock.mockReset().mockResolvedValue({
    contasAVencer: 0,
    contasVencidas: 0,
    vendasComPrejuizo: 0,
    divergenciasConciliacao: 0,
  });
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

  it("F4 (Ciclo 8): continua um backfill pendente, mas não inicia um novo quando não há nenhum em andamento", async () => {
    const response = await GET(criarRequest("Bearer segredo-cron"));
    expect(response.status).toBe(200);
    expect(continuarBackfillMock).not.toHaveBeenCalled();
  });

  it("F4 (Ciclo 8): reprocessa erros pendentes de cada conta ativa", async () => {
    const response = await GET(criarRequest("Bearer segredo-cron"));
    expect(response.status).toBe(200);
    expect(reprocessarErrosPendentesMock).toHaveBeenCalledWith("conta-1");
    expect(reprocessarErrosPendentesMock).toHaveBeenCalledWith("conta-2");
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

  it("gera lançamentos de recorrência para cada dono de conta, independente de ter ML", async () => {
    gerarLancamentosDeTodasAsRecorrenciasMock.mockResolvedValue({ gerados: 3 });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(body.lancamentosRecorrentesGerados).toBe(3);
    expect(gerarLancamentosDeTodasAsRecorrenciasMock).toHaveBeenCalledWith("dono-1");
  });

  it("erro ao gerar recorrência de um dono é contado mas não derruba a rota", async () => {
    gerarLancamentosDeTodasAsRecorrenciasMock.mockRejectedValue(new Error("falha ao gerar"));

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.erros).toBeGreaterThan(0);
  });

  it("soma os alertas gerados para cada dono de conta", async () => {
    gerarAlertasFinanceirosMock.mockResolvedValue({
      contasAVencer: 1,
      contasVencidas: 2,
      vendasComPrejuizo: 1,
      divergenciasConciliacao: 1,
    });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(body.alertasGerados).toBe(5);
    expect(gerarAlertasFinanceirosMock).toHaveBeenCalledWith("dono-1");
  });

  it("erro ao gerar alertas de um dono é contado mas não derruba a rota", async () => {
    gerarAlertasFinanceirosMock.mockRejectedValue(new Error("falha ao gerar alertas"));

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.erros).toBeGreaterThan(0);
  });
});
