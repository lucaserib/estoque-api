import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda, StatusTarefaSincronizacao, TipoTarefaSincronizacao } from "@prisma/client";
import type { MLOrder } from "@/types/mercadolivre";

interface FakeTarefa {
  id: string;
  userId: string;
  canal: CanalVenda;
  contaCanalId: string;
  tipo: TipoTarefaSincronizacao;
  desde: Date | null;
  ate: Date | null;
  cursor: unknown;
  forcar: boolean;
  status: StatusTarefaSincronizacao;
  prioridade: number;
  tentativas: number;
  processados: number;
  total: number | null;
  erro: string | null;
  bloqueadaAte: Date | null;
  criadaEm: Date;
  concluidaEm: Date | null;
}

let tarefas: FakeTarefa[] = [];
let vendas: Array<{ pedidoExternoId: string; atualizadoNoCanalEm: Date; completo: boolean }> = [];
let contas: Array<{ id: string; ultimaSincronizacaoFinanceiraEm: Date | null }> = [];
let proximoId = 1;

function novaTarefaFake(dados: Partial<FakeTarefa>): FakeTarefa {
  return {
    id: `tarefa-${proximoId++}`,
    userId: "user-1",
    canal: CanalVenda.MERCADO_LIVRE,
    contaCanalId: "conta-1",
    tipo: TipoTarefaSincronizacao.PEDIDOS_PERIODO,
    desde: null,
    ate: null,
    cursor: null,
    forcar: false,
    status: StatusTarefaSincronizacao.PENDENTE,
    prioridade: 0,
    tentativas: 0,
    processados: 0,
    total: null,
    erro: null,
    bloqueadaAte: null,
    criadaEm: new Date(),
    concluidaEm: null,
    ...dados,
  };
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tarefaSincronizacaoFinanceira: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId: string;
            contaCanalId: string;
            tipo?: TipoTarefaSincronizacao;
            status?: StatusTarefaSincronizacao | { in: StatusTarefaSincronizacao[] };
            desde?: Date | null;
            ate?: Date | null;
            OR?: Array<Record<string, unknown>>;
          };
        }) => {
          let candidatos = tarefas.filter(
            (t) => t.userId === where.userId && t.contaCanalId === where.contaCanalId
          );
          if (where.tipo) candidatos = candidatos.filter((t) => t.tipo === where.tipo);
          if (where.status && !where.OR) {
            const statusAceitos =
              typeof where.status === "object" && "in" in where.status ? where.status.in : [where.status];
            candidatos = candidatos.filter((t) => statusAceitos.includes(t.status));
          }
          if (where.OR) {
            const agora = new Date();
            candidatos = candidatos.filter((t) =>
              where.OR!.some((cond) => {
                if (cond.status === StatusTarefaSincronizacao.PENDENTE) {
                  return t.status === StatusTarefaSincronizacao.PENDENTE;
                }
                return (
                  t.status === StatusTarefaSincronizacao.EM_ANDAMENTO &&
                  (!t.bloqueadaAte || t.bloqueadaAte < agora)
                );
              })
            );
          }
          if ("desde" in where) candidatos = candidatos.filter((t) => t.desde?.getTime() === where.desde?.getTime());
          if ("ate" in where) candidatos = candidatos.filter((t) => t.ate?.getTime() === where.ate?.getTime());

          candidatos.sort((a, b) => b.prioridade - a.prioridade || a.criadaEm.getTime() - b.criadaEm.getTime());
          return candidatos[0] ?? null;
        }
      ),
      create: vi.fn(async ({ data }: { data: Partial<FakeTarefa> }) => {
        const nova = novaTarefaFake(data);
        tarefas.push(nova);
        return nova;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const tarefa = tarefas.find((t) => t.id === where.id);
        if (!tarefa) throw new Error("tarefa não encontrada");
        for (const [chave, valor] of Object.entries(data)) {
          if (valor && typeof valor === "object" && "increment" in (valor as Record<string, unknown>)) {
            (tarefa as unknown as Record<string, number>)[chave] += (valor as { increment: number }).increment;
          } else {
            (tarefa as unknown as Record<string, unknown>)[chave] = valor;
          }
        }
        return tarefa;
      }),
    },
    vendaCanal: {
      findUnique: vi.fn(
        async ({ where }: { where: { userId_canal_pedidoExternoId: { pedidoExternoId: string } } }) =>
          vendas.find((v) => v.pedidoExternoId === where.userId_canal_pedidoExternoId.pedidoExternoId) ?? null
      ),
    },
    mercadoLivreAccount: {
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const conta = contas.find((c) => c.id === where.id);
        if (conta) Object.assign(conta, data);
        return conta;
      }),
    },
  },
}));

function pedidoMl(id: string, lastUpdated = "2026-05-10T14:05:00.000-04:00"): MLOrder {
  return {
    id,
    status: "paid",
    date_created: "2026-05-10T14:00:00.000-04:00",
    date_closed: "2026-05-10T14:05:00.000-04:00",
    last_updated: lastUpdated,
    order_items: [
      { item: { id: "MLB1", title: "Produto", seller_sku: "SKU-1" }, quantity: 1, unit_price: 100, sale_fee: 10 },
    ],
    buyer: {},
    seller: {},
    currency_id: "BRL",
    shipping: { id: 555 },
    total_amount: 100,
    paid_amount: 100,
    payments: [{ id: 1, status: "approved", transaction_amount: 100 }],
  };
}

let pedidosPorDia: Record<string, MLOrder[]> = {};
const listarPedidosCriadosNoPeriodoMock = vi.fn(async (_contaCanalId: string, desde: Date, _ate: Date) => {
  const chaveDia = desde.toISOString().slice(0, 10);
  return pedidosPorDia[chaveDia] ?? [];
});
vi.mock("../../canais/mercadoLivre/cliente", () => ({
  listarPedidosCriadosNoPeriodo: (...args: unknown[]) =>
    (listarPedidosCriadosNoPeriodoMock as (...a: unknown[]) => unknown)(...args),
}));

const adaptadorFake: { atual: Record<string, unknown> } = { atual: {} };
vi.mock("../../canais/registro", () => ({
  obterAdaptador: vi.fn(() => ({ canal: CanalVenda.MERCADO_LIVRE, ...adaptadorFake.atual })),
}));

const ingerirVendaNormalizadaMock = vi.fn(async (..._args: unknown[]) => {
  await new Promise((resolve) => setTimeout(resolve, 1));
});
const ingerirPedidoComRegistroDeErroMock = vi.fn(async (..._args: unknown[]) => undefined);
const registrarErroPedidoMock = vi.fn(async (..._args: unknown[]) => undefined);
const resolverErroPedidoMock = vi.fn(async (..._args: unknown[]) => undefined);
const obterUserIdDaContaMock = vi.fn(async (..._args: unknown[]) => "user-1");

vi.mock("../sincronizador", () => ({
  ingerirVendaNormalizada: (...args: unknown[]) => ingerirVendaNormalizadaMock(...args),
  ingerirPedidoComRegistroDeErro: (...args: unknown[]) => ingerirPedidoComRegistroDeErroMock(...args),
  registrarErroPedido: (...args: unknown[]) => registrarErroPedidoMock(...args),
  resolverErroPedido: (...args: unknown[]) => resolverErroPedidoMock(...args),
  obterUserIdDaConta: (...args: unknown[]) => obterUserIdDaContaMock(...args),
  mensagemDeErro: (erro: unknown) => (erro instanceof Error ? erro.message : "Erro desconhecido"),
  tempoMaximoLoteMs: () => 40000,
}));

vi.mock("../ingestaoAds", () => ({ ingerirGastosAdsDoDia: vi.fn(async () => ({ processados: 0 })) }));
vi.mock("../ingestaoCobrancas", () => ({ ingerirCobrancasDoMes: vi.fn(async () => ({ processadas: 0, naoMapeadas: 0 })) }));

const { enfileirarTarefa, executarFila } = await import("../fila");

beforeEach(() => {
  tarefas = [];
  vendas = [];
  contas = [{ id: "conta-1", ultimaSincronizacaoFinanceiraEm: null }];
  pedidosPorDia = {};
  proximoId = 1;
  listarPedidosCriadosNoPeriodoMock.mockClear();
  ingerirVendaNormalizadaMock.mockClear();
  adaptadorFake.atual = {};
});

describe("executarFila — PEDIDOS_PERIODO", () => {
  it("F9 (Ciclo 9): período de 3 dias com 120 pedidos e timeout no meio retoma do pedido certo até concluir", async () => {
    pedidosPorDia = {
      "2026-05-01": Array.from({ length: 40 }, (_, i) => pedidoMl(`d1-${i}`)),
      "2026-05-02": Array.from({ length: 40 }, (_, i) => pedidoMl(`d2-${i}`)),
      "2026-05-03": Array.from({ length: 40 }, (_, i) => pedidoMl(`d3-${i}`)),
    };

    await enfileirarTarefa({
      userId: "user-1",
      canal: CanalVenda.MERCADO_LIVRE,
      contaCanalId: "conta-1",
      tipo: TipoTarefaSincronizacao.PEDIDOS_PERIODO,
      desde: new Date("2026-05-01T00:00:00.000-03:00"),
      ate: new Date("2026-05-03T23:59:59.999-03:00"),
    });

    let totalProcessado = 0;
    let voltas = 0;
    let ultimoStatus: string = "EM_ANDAMENTO";
    while (ultimoStatus === "EM_ANDAMENTO" && voltas < 50) {
      const resultado = await executarFila("user-1", "conta-1", 5);
      totalProcessado += resultado.processados;
      ultimoStatus = resultado.status;
      voltas++;
    }

    expect(ultimoStatus).toBe("CONCLUIDA");
    expect(totalProcessado).toBe(120);
    expect(voltas).toBeGreaterThan(1);
    expect(ingerirVendaNormalizadaMock).toHaveBeenCalledTimes(120);
  });

  it("pedido sem mudança (last_updated igual e venda completa) não é reprocessado", async () => {
    pedidosPorDia = { "2026-05-01": [pedidoMl("1", "2026-05-01T10:00:00.000-03:00")] };
    vendas = [
      {
        pedidoExternoId: "1",
        atualizadoNoCanalEm: new Date("2026-05-01T10:00:00.000-03:00"),
        completo: true,
      },
    ];

    await enfileirarTarefa({
      userId: "user-1",
      canal: CanalVenda.MERCADO_LIVRE,
      contaCanalId: "conta-1",
      tipo: TipoTarefaSincronizacao.PEDIDOS_PERIODO,
      desde: new Date("2026-05-01T00:00:00.000-03:00"),
      ate: new Date("2026-05-01T23:59:59.999-03:00"),
    });

    const resultado = await executarFila("user-1", "conta-1", 40000);

    expect(resultado.status).toBe("CONCLUIDA");
    expect(resultado.processados).toBe(1);
    expect(ingerirVendaNormalizadaMock).not.toHaveBeenCalled();
  });

  it("pedido alterado (last_updated diferente do gravado) é reprocessado mesmo com venda completa", async () => {
    pedidosPorDia = { "2026-05-01": [pedidoMl("1", "2026-05-01T12:00:00.000-03:00")] };
    vendas = [
      {
        pedidoExternoId: "1",
        atualizadoNoCanalEm: new Date("2026-05-01T10:00:00.000-03:00"),
        completo: true,
      },
    ];

    await enfileirarTarefa({
      userId: "user-1",
      canal: CanalVenda.MERCADO_LIVRE,
      contaCanalId: "conta-1",
      tipo: TipoTarefaSincronizacao.PEDIDOS_PERIODO,
      desde: new Date("2026-05-01T00:00:00.000-03:00"),
      ate: new Date("2026-05-01T23:59:59.999-03:00"),
    });

    await executarFila("user-1", "conta-1", 40000);

    expect(ingerirVendaNormalizadaMock).toHaveBeenCalledTimes(1);
  });

  it("Ciclo 9 (item 7): com forcar:true reprocessa mesmo um pedido sem mudança e venda completa", async () => {
    pedidosPorDia = { "2026-05-01": [pedidoMl("1", "2026-05-01T10:00:00.000-03:00")] };
    vendas = [
      {
        pedidoExternoId: "1",
        atualizadoNoCanalEm: new Date("2026-05-01T10:00:00.000-03:00"),
        completo: true,
      },
    ];

    await enfileirarTarefa({
      userId: "user-1",
      canal: CanalVenda.MERCADO_LIVRE,
      contaCanalId: "conta-1",
      tipo: TipoTarefaSincronizacao.PEDIDOS_PERIODO,
      desde: new Date("2026-05-01T00:00:00.000-03:00"),
      ate: new Date("2026-05-01T23:59:59.999-03:00"),
      forcar: true,
    });

    const resultado = await executarFila("user-1", "conta-1", 40000);

    expect(resultado.status).toBe("CONCLUIDA");
    expect(ingerirVendaNormalizadaMock).toHaveBeenCalledTimes(1);
  });

  it("devolve OCIOSO quando não há nenhuma tarefa pendente", async () => {
    const resultado = await executarFila("user-1", "conta-1");
    expect(resultado.status).toBe("OCIOSO");
  });
});
