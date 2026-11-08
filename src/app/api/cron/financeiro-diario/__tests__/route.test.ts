import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.CRON_SECRET = "segredo-cron";

const enfileirarIncrementalMock = vi.fn();
const enfileirarCobrancasMock = vi.fn();
const executarFilaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/fila", () => ({
  enfileirarIncremental: (...a: unknown[]) => enfileirarIncrementalMock(...a),
  enfileirarCobrancas: (...a: unknown[]) => enfileirarCobrancasMock(...a),
  executarFila: (...a: unknown[]) => executarFilaMock(...a),
}));

const garantirHistoricoMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/statusSincronizacao", () => ({
  garantirHistoricoAtualizado: (...a: unknown[]) => garantirHistoricoMock(...a),
}));

const corrigirMesMock = vi.fn();
vi.mock("@/modules/financeiro/relatorios/conferencia", () => ({
  corrigirMes: (...a: unknown[]) => corrigirMesMock(...a),
}));

const recorrenciasMock = vi.fn();
vi.mock("@/modules/financeiro/lancamentos/recorrencias", () => ({
  gerarLancamentosDeTodasAsRecorrencias: (...a: unknown[]) => recorrenciasMock(...a),
}));

const alertasMock = vi.fn();
vi.mock("@/modules/financeiro/alertas", () => ({
  gerarAlertasFinanceiros: (...a: unknown[]) => alertasMock(...a),
}));

const saldoMock = vi.fn();
vi.mock("@/modules/financeiro/canais/mercadoPago/saldo", () => ({
  sincronizarSaldoMercadoPago: (...a: unknown[]) => saldoMock(...a),
}));

vi.mock("@/modules/financeiro/canais/erp/bling/notasFiscais", () => ({
  sincronizarNotasFiscais: vi.fn(async () => ({ conectado: true, lidas: 2, gravadas: 2, vinculadas: 1, completo: true, erro: null })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    blingAccount: { findMany: vi.fn(async () => [{ userId: "dono-1" }]) },
    mercadoLivreAccount: {
      findMany: vi.fn(async () => [
        { id: "conta-1", userId: "dono-conta-1" },
        { id: "conta-2", userId: "dono-conta-2" },
      ]),
    },
    user: { findMany: vi.fn(async () => [{ id: "dono-1" }]) },
  },
}));

const { GET } = await import("../route");

const req = (authorization?: string) =>
  new NextRequest("http://localhost/api/cron/financeiro-diario", {
    headers: authorization ? { authorization } : undefined,
  });

beforeEach(() => {
  enfileirarIncrementalMock.mockReset().mockResolvedValue({ id: "t" });
  enfileirarCobrancasMock.mockReset().mockResolvedValue({ id: "t" });
  executarFilaMock.mockReset().mockResolvedValue({ status: "CONCLUIDA", processados: 7, vendasDetalhadas: 3 });
  garantirHistoricoMock.mockReset().mockResolvedValue(undefined);
  corrigirMesMock.mockReset().mockResolvedValue({ lote: { gravados: 2 } });
  recorrenciasMock.mockReset().mockResolvedValue({ gerados: 1 });
  alertasMock.mockReset().mockResolvedValue({ contasAVencer: 1, contasVencidas: 1, vendasComPrejuizo: 2, divergenciasConciliacao: 1, rupturasPrevistas: 0 });
  saldoMock.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/cron/financeiro-diario", () => {
  it("401 sem o CRON_SECRET", async () => {
    expect((await GET(req())).status).toBe(401);
  });

  it("corrige o mês atual e o anterior de cada conta, enfileira o incremental e a fatura e processa a fila", async () => {
    const r = await GET(req("Bearer segredo-cron"));
    const body = await r.json();
    expect(corrigirMesMock).toHaveBeenCalledTimes(4);
    expect(enfileirarIncrementalMock).toHaveBeenCalledWith("conta-1", 30);
    expect(enfileirarCobrancasMock).toHaveBeenCalledTimes(2);
    expect(executarFilaMock).toHaveBeenCalledWith("dono-conta-1", "conta-1", 20000);
    expect(body.pedidosCorrigidos).toBe(8);
    expect(body.pedidosProcessados).toBe(14);
    expect(body.vendasDetalhadas).toBe(6);
    expect(body.lancamentosRecorrentesGerados).toBe(1);
    expect(body.alertasGerados).toBe(5);
    expect(body.erros).toBe(0);
  });

  it("erro numa conta é contado e não impede a outra conta nem as recorrências", async () => {
    corrigirMesMock.mockRejectedValueOnce(new Error("ML fora do ar"));
    const body = await (await GET(req("Bearer segredo-cron"))).json();
    expect(body.erros).toBe(1);
    expect(body.contasProcessadas).toBe(1);
    expect(recorrenciasMock).toHaveBeenCalled();
  });
});
