import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.CRON_SECRET = "segredo-cron";

const reprocessarErrosPendentesMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/sincronizador", () => ({
  reprocessarErrosPendentes: (accountId: string) => reprocessarErrosPendentesMock(accountId),
}));

const enfileirarIncrementalMock = vi.fn();
const executarFilaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/fila", () => ({
  enfileirarIncremental: (accountId: string, prioridade: number) =>
    enfileirarIncrementalMock(accountId, prioridade),
  executarFila: (userId: string, contaCanalId: string, orcamentoMs: number) =>
    executarFilaMock(userId, contaCanalId, orcamentoMs),
}));

const ingerirGastosAdsDoDiaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/ingestaoAds", () => ({
  ingerirGastosAdsDoDia: (accountId: string, dia: Date) => ingerirGastosAdsDoDiaMock(accountId, dia),
}));

const ingerirCobrancasDoMesMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/ingestaoCobrancas", () => ({
  ingerirCobrancasDoMes: (accountId: string, mes: string) => ingerirCobrancasDoMesMock(accountId, mes),
}));

const conferirMesMock = vi.fn();
const importarFaltantesMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/conferencia", () => ({
  conferirMes: (userId: string, accountId: string, competencia: unknown) =>
    conferirMesMock(userId, accountId, competencia),
  importarFaltantes: (accountId: string, pedidosExternoId: string[]) =>
    importarFaltantesMock(accountId, pedidosExternoId),
}));

const gerarLancamentosDeTodasAsRecorrenciasMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/recorrencias", () => ({
  gerarLancamentosDeTodasAsRecorrencias: (userId: string) => gerarLancamentosDeTodasAsRecorrenciasMock(userId),
}));

const gerarAlertasFinanceirosMock = vi.fn();
vi.mock("@/modules/financeiro/alertas", () => ({
  gerarAlertasFinanceiros: (userId: string) => gerarAlertasFinanceirosMock(userId),
}));

const sincronizarSaldoMercadoPagoMock = vi.fn();
vi.mock("@/modules/financeiro/canais/mercadoPago/saldo", () => ({
  sincronizarSaldoMercadoPago: (accountId: string) => sincronizarSaldoMercadoPagoMock(accountId),
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
  },
}));

const { GET } = await import("../route");

function criarRequest(authorization?: string) {
  return new NextRequest("http://localhost/api/cron/financeiro-diario", {
    headers: authorization ? { authorization } : undefined,
  });
}

beforeEach(() => {
  reprocessarErrosPendentesMock.mockReset().mockResolvedValue({ processados: 0 });
  enfileirarIncrementalMock.mockReset().mockResolvedValue({ id: "tarefa-1" });
  executarFilaMock.mockReset().mockResolvedValue({
    tarefaId: null,
    tipo: null,
    status: "OCIOSO",
    processados: 0,
  });
  ingerirGastosAdsDoDiaMock.mockReset().mockResolvedValue({ processados: 0 });
  ingerirCobrancasDoMesMock.mockReset().mockResolvedValue({ processadas: 0, naoMapeadas: 0 });
  conferirMesMock.mockReset().mockResolvedValue({ faltando: [], divergentes: [], coberturaPercentual: 100 });
  importarFaltantesMock.mockReset().mockResolvedValue({ importados: 0, erros: 0 });
  gerarLancamentosDeTodasAsRecorrenciasMock.mockReset().mockResolvedValue({ gerados: 0 });
  sincronizarSaldoMercadoPagoMock.mockReset().mockResolvedValue(undefined);
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

  it("enfileira o incremental e drena a fila de cada conta ativa, somando ads e cobranças processados", async () => {
    executarFilaMock
      .mockResolvedValueOnce({ tarefaId: "t1", tipo: "PEDIDOS_INCREMENTAL", status: "CONCLUIDA", processados: 3 })
      .mockResolvedValueOnce({ tarefaId: null, tipo: null, status: "OCIOSO", processados: 0 })
      .mockResolvedValueOnce({ tarefaId: "t2", tipo: "PEDIDOS_INCREMENTAL", status: "CONCLUIDA", processados: 2 })
      .mockResolvedValueOnce({ tarefaId: null, tipo: null, status: "OCIOSO", processados: 0 });
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
    expect(enfileirarIncrementalMock).toHaveBeenCalledWith("conta-1", 5);
    expect(enfileirarIncrementalMock).toHaveBeenCalledWith("conta-2", 5);
    expect(ingerirGastosAdsDoDiaMock).toHaveBeenCalledWith("conta-1", expect.any(Date));
    expect(ingerirCobrancasDoMesMock).toHaveBeenCalledWith("conta-1", expect.stringMatching(/^\d{4}-\d{2}$/));
  });

  it("para de drenar a fila da conta ao ver ERRO ou OCIOSO, sem travar nas outras contas", async () => {
    executarFilaMock
      .mockResolvedValueOnce({ tarefaId: "t1", tipo: "PEDIDOS_PERIODO", status: "ERRO", processados: 0 })
      .mockResolvedValueOnce({ tarefaId: null, tipo: null, status: "OCIOSO", processados: 0 });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contasProcessadas).toBe(2);
    expect(executarFilaMock).toHaveBeenCalledTimes(2);
  });

  it("uma conta com erro ao enfileirar não impede ads/cobranças nem as demais contas", async () => {
    enfileirarIncrementalMock
      .mockRejectedValueOnce(new Error("ML indisponível"))
      .mockResolvedValueOnce({ id: "tarefa-1" });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contasProcessadas).toBe(1);
    expect(body.erros).toBe(1);
    expect(ingerirGastosAdsDoDiaMock).toHaveBeenCalledTimes(2);
  });

  it("F4 (Ciclo 8): reprocessa erros pendentes de cada conta ativa", async () => {
    const response = await GET(criarRequest("Bearer segredo-cron"));
    expect(response.status).toBe(200);
    expect(reprocessarErrosPendentesMock).toHaveBeenCalledWith("conta-1");
    expect(reprocessarErrosPendentesMock).toHaveBeenCalledWith("conta-2");
  });

  it("F8 (Ciclo 9): confere o mês corrente e o anterior de cada conta, e importa os faltantes", async () => {
    conferirMesMock
      .mockResolvedValueOnce({ faltando: ["1", "2"], divergentes: [], coberturaPercentual: 90 })
      .mockResolvedValueOnce({ faltando: [], divergentes: [], coberturaPercentual: 100 })
      .mockResolvedValue({ faltando: [], divergentes: [], coberturaPercentual: 100 });
    importarFaltantesMock.mockResolvedValueOnce({ importados: 2, erros: 0 });

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(conferirMesMock).toHaveBeenCalledTimes(4);
    expect(importarFaltantesMock).toHaveBeenCalledWith("conta-1", ["1", "2"]);
    expect(body.faltantesImportados).toBe(2);
  });

  it("erro na conferência de uma conta é contado mas não derruba a rota", async () => {
    conferirMesMock.mockRejectedValueOnce(new Error("ML indisponível"));

    const response = await GET(criarRequest("Bearer segredo-cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.erros).toBeGreaterThan(0);
  });

  it("erro em ads de uma conta é contado mas não derruba a rota", async () => {
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
