import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyUserMock } = vi.hoisted(() => ({ verifyUserMock: vi.fn() }));
vi.mock("@/helpers/verifyUser", () => ({ verifyUser: verifyUserMock }));

const enfileirarPeriodoMock = vi.fn();
const executarFilaMock = vi.fn();
vi.mock("@/modules/financeiro/ingestao/fila", () => ({
  enfileirarPeriodo: (...args: unknown[]) => enfileirarPeriodoMock(...args),
  executarFila: (...args: unknown[]) => executarFilaMock(...args),
}));

const mercadoLivreAccountFindFirstMock = vi.fn();
const sincronizacaoFinanceiraFindFirstMock = vi.fn();
const tarefaFindFirstMock = vi.fn();
const erroCountMock = vi.fn();
const webhookGroupByMock = vi.fn();
const webhookFindFirstMock = vi.fn();
const vendaCanalFindFirstMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: { findFirst: (...args: unknown[]) => mercadoLivreAccountFindFirstMock(...args) },
    sincronizacaoFinanceira: { findFirst: (...args: unknown[]) => sincronizacaoFinanceiraFindFirstMock(...args) },
    tarefaSincronizacaoFinanceira: { findFirst: (...args: unknown[]) => tarefaFindFirstMock(...args) },
    sincronizacaoFinanceiraErro: { count: (...args: unknown[]) => erroCountMock(...args) },
    mercadoLivreWebhook: {
      groupBy: (...args: unknown[]) => webhookGroupByMock(...args),
      findFirst: (...args: unknown[]) => webhookFindFirstMock(...args),
    },
    vendaCanal: { findFirst: (...args: unknown[]) => vendaCanalFindFirstMock(...args) },
  },
}));

function criarRequest() {
  return new Request("http://localhost/api/financeiro/sincronizacao/status");
}

const { GET } = await import("../route");

beforeEach(() => {
  verifyUserMock.mockReset();
  enfileirarPeriodoMock.mockReset();
  executarFilaMock.mockReset().mockResolvedValue({ tarefaId: null, tipo: null, status: "OCIOSO", processados: 0 });
  mercadoLivreAccountFindFirstMock.mockReset().mockResolvedValue(null);
  sincronizacaoFinanceiraFindFirstMock.mockReset().mockResolvedValue(null);
  tarefaFindFirstMock.mockReset().mockResolvedValue(null);
  erroCountMock.mockReset().mockResolvedValue(0);
  webhookGroupByMock.mockReset().mockResolvedValue([]);
  webhookFindFirstMock.mockReset().mockResolvedValue(null);
  vendaCanalFindFirstMock.mockReset().mockResolvedValue(null);
});

describe("GET /api/financeiro/sincronizacao/status", () => {
  it("responde 403 para quem não tem FINANCEIRO_VER", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "COMPRAS" });

    const response = await GET(criarRequest() as never);
    expect(response.status).toBe(403);
  });

  it("sem conta ML ativa: não enfileira nada e devolve o status com errosPendentes", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    erroCountMock.mockResolvedValue(2);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.emAndamento).toBeNull();
    expect(body.errosPendentes).toBe(2);
    expect(enfileirarPeriodoMock).not.toHaveBeenCalled();
  });

  it("F5 (Ciclo 9): sem nenhum PEDIDOS_PERIODO concluído, enfileira o histórico automático e drena a fila", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    mercadoLivreAccountFindFirstMock.mockResolvedValue({ id: "conta-ml-1" });
    tarefaFindFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await GET(criarRequest() as never);

    expect(enfileirarPeriodoMock).toHaveBeenCalledWith(
      "conta-ml-1",
      expect.any(Date),
      expect.any(Date),
      20
    );
    expect(executarFilaMock).toHaveBeenCalledWith("conta-dona", "conta-ml-1", 8000);
  });

  it("não enfileira de novo quando já existe um PEDIDOS_PERIODO concluído", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    mercadoLivreAccountFindFirstMock.mockResolvedValue({ id: "conta-ml-1" });
    tarefaFindFirstMock.mockResolvedValueOnce({ id: "tarefa-concluida" });

    await GET(criarRequest() as never);

    expect(enfileirarPeriodoMock).not.toHaveBeenCalled();
  });

  it("não enfileira de novo quando já há um PEDIDOS_PERIODO pendente ou em andamento", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    mercadoLivreAccountFindFirstMock.mockResolvedValue({ id: "conta-ml-1" });
    tarefaFindFirstMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "tarefa-pendente" });

    await GET(criarRequest() as never);

    expect(enfileirarPeriodoMock).not.toHaveBeenCalled();
  });

  it("devolve a última sincronização concluída e a tarefa em andamento", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    const concluidaEm = new Date("2026-05-10T10:00:00.000Z");
    sincronizacaoFinanceiraFindFirstMock.mockResolvedValue({ concluidoEm: concluidaEm });
    tarefaFindFirstMock.mockResolvedValue({ tipo: "PEDIDOS_INCREMENTAL", processados: 7, status: "EM_ANDAMENTO" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.emAndamento.tipo).toBe("PEDIDOS_INCREMENTAL");
    expect(body.ultimaSincronizacaoConcluidaEm).toBe(concluidaEm.toISOString());
  });

  it("F7 (Ciclo 9): monta o último webhook por tópico", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    mercadoLivreAccountFindFirstMock.mockResolvedValue({ id: "conta-ml-1" });
    const dataWebhook = new Date("2026-05-10T10:00:00.000Z");
    webhookGroupByMock.mockResolvedValue([
      { topic: "orders_v2", _max: { receivedAt: dataWebhook } },
      { topic: "payments", _max: { receivedAt: dataWebhook } },
    ]);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.ultimoWebhookPorTopico.orders_v2).toBe(dataWebhook.toISOString());
    expect(body.ultimoWebhookPorTopico.payments).toBe(dataWebhook.toISOString());
  });

  it("F7 (Ciclo 9): alerta quando houve venda recente mas nenhum webhook orders_v2 nas últimas 24h", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    mercadoLivreAccountFindFirstMock.mockResolvedValue({ id: "conta-ml-1" });
    webhookFindFirstMock.mockResolvedValue(null);
    vendaCanalFindFirstMock.mockResolvedValue({ id: "venda-1" });

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.alertaWebhooksAusentes).toBe(true);
  });

  it("F7 (Ciclo 9): sem venda recente, não alerta mesmo sem webhook", async () => {
    verifyUserMock.mockResolvedValue({ contaId: "conta-dona", role: "ADMIN" });
    mercadoLivreAccountFindFirstMock.mockResolvedValue({ id: "conta-ml-1" });
    webhookFindFirstMock.mockResolvedValue(null);
    vendaCanalFindFirstMock.mockResolvedValue(null);

    const response = await GET(criarRequest() as never);
    const body = await response.json();

    expect(body.alertaWebhooksAusentes).toBe(false);
  });
});
