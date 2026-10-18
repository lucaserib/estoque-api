import { describe, it, expect, vi, beforeEach } from "vitest";

let conta: Record<string, unknown> | null;
let tarefas: Array<Record<string, unknown>> = [];
let aguardando = 0;
let vendaRecente: unknown = null;
let webhookRecente: unknown = null;
const enfileirarPeriodoMock = vi.fn(async () => null);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findFirst: vi.fn(async () => conta),
      findUnique: vi.fn(async () => conta),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(conta!, data)),
    },
    tarefaSincronizacaoFinanceira: {
      findMany: vi.fn(async () => tarefas),
      findFirst: vi.fn(async () => null),
    },
    vendaCanal: {
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
        "enriquecimentoTentativas" in where && (where.enriquecimentoTentativas as { gte?: number }).gte ? 0 : aguardando
      ),
      findFirst: vi.fn(async () => vendaRecente),
    },
    sincronizacaoFinanceiraErro: { count: vi.fn(async () => 0) },
    mercadoLivreWebhook: {
      groupBy: vi.fn(async () => [{ topic: "items", _max: { receivedAt: new Date("2026-10-18T10:00:00Z") } }]),
      findFirst: vi.fn(async () => webhookRecente),
    },
  },
}));
vi.mock("../fila", () => ({ enfileirarPeriodo: (...a: unknown[]) => enfileirarPeriodoMock(...(a as [])) }));
vi.mock("../enriquecimento", () => ({
  filtroAguardandoDetalhes: (id: string) => ({ contaCanalId: id, enriquecidoEm: null, enriquecimentoTentativas: { lt: 5 } }),
}));

const { obterStatusSincronizacao, VERSAO_DADOS_FINANCEIROS } = await import("../statusSincronizacao");

beforeEach(() => {
  conta = { id: "conta-1", versaoDadosFinanceiros: 0, ultimaSincronizacaoFinanceiraEm: null, financeiroProcessandoAte: null };
  tarefas = [];
  aguardando = 0;
  vendaRecente = null;
  webhookRecente = null;
  enfileirarPeriodoMock.mockClear();
});

describe("obterStatusSincronizacao", () => {
  it("reimporta o histórico uma única vez quando a versão dos dados muda", async () => {
    await obterStatusSincronizacao("user-1");
    await obterStatusSincronizacao("user-1");
    expect(enfileirarPeriodoMock).toHaveBeenCalledTimes(1);
    const [, , , prioridade, forcar] = enfileirarPeriodoMock.mock.calls[0] as unknown as [string, Date, Date, number, boolean];
    expect(prioridade).toBe(50);
    expect(forcar).toBe(true);
    expect(conta!.versaoDadosFinanceiros).toBe(VERSAO_DADOS_FINANCEIROS);
  });

  it("fica pendente enquanto houver tarefa ou venda aguardando detalhes, e mostra o mês sendo importado", async () => {
    conta!.versaoDadosFinanceiros = VERSAO_DADOS_FINANCEIROS;
    tarefas = [{ id: "t1", tipo: "PEDIDOS_PERIODO", status: "EM_ANDAMENTO", processados: 120, cursor: { inicioJanela: "2026-09-01T03:00:00.000Z", offset: 50 }, desde: null, ate: null, erro: null }];
    const status = await obterStatusSincronizacao("user-1");
    expect(status.pendente).toBe(true);
    expect(status.tarefas[0].mesAtual).toContain("setembro");

    tarefas = [];
    aguardando = 3;
    expect((await obterStatusSincronizacao("user-1")).pendente).toBe(true);
    aguardando = 0;
    expect((await obterStatusSincronizacao("user-1")).pendente).toBe(false);
  });

  it("alerta webhook ausente só quando houve venda recente sem notificação orders_v2", async () => {
    conta!.versaoDadosFinanceiros = VERSAO_DADOS_FINANCEIROS;
    vendaRecente = { id: "v" };
    expect((await obterStatusSincronizacao("user-1")).alertaWebhooksAusentes).toBe(true);
    webhookRecente = { id: "w" };
    expect((await obterStatusSincronizacao("user-1")).alertaWebhooksAusentes).toBe(false);
  });

  it("sem conta do Mercado Livre, devolve contaConectada=false sem enfileirar nada", async () => {
    conta = null;
    const status = await obterStatusSincronizacao("user-1");
    expect(status.contaConectada).toBe(false);
    expect(enfileirarPeriodoMock).not.toHaveBeenCalled();
  });
});
