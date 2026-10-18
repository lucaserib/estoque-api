import { describe, it, expect, vi, beforeEach } from "vitest";

interface TarefaFalsa {
  id: string;
  userId: string;
  canal: string;
  contaCanalId: string;
  tipo: string;
  desde: Date | null;
  ate: Date | null;
  cursor: unknown;
  forcar: boolean;
  status: string;
  prioridade: number;
  tentativas: number;
  processados: number;
  erro: string | null;
  bloqueadaAte: Date | null;
  criadaEm: Date;
  concluidaEm: Date | null;
}

let tarefas: TarefaFalsa[] = [];
let conta: { id: string; financeiroProcessandoAte: Date | null; ultimaSincronizacaoFinanceiraEm: Date | null };
let paginas: Map<string, Array<{ id: number }[]>> = new Map();
const chamadasBusca: Array<{ campoData: string; desde: Date; ate: Date; offset: number }> = [];
const lotes: Array<{ ids: number[]; forcar?: boolean }> = [];
let falharBusca = false;
let relogio = 0;

function aplicar(t: TarefaFalsa, data: Record<string, unknown>) {
  for (const [campo, valor] of Object.entries(data)) {
    if (valor && typeof valor === "object" && "increment" in (valor as Record<string, unknown>)) {
      (t as unknown as Record<string, number>)[campo] += (valor as { increment: number }).increment;
    } else {
      (t as unknown as Record<string, unknown>)[campo] = valor;
    }
  }
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tarefaSincronizacaoFinanceira: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        const candidatas = tarefas
          .filter((t) => t.tentativas < 5)
          .filter((t) => t.status === "PENDENTE" || (t.status === "EM_ANDAMENTO" && (!t.bloqueadaAte || t.bloqueadaAte.getTime() < Date.now())))
          .filter((t) => !where.contaCanalId || t.contaCanalId === where.contaCanalId)
          .sort((a, b) => b.prioridade - a.prioridade || a.criadaEm.getTime() - b.criadaEm.getTime());
        if (where.tipo) return candidatas.find((t) => t.tipo === where.tipo) ?? null;
        return candidatas[0] ?? null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const t = tarefas.find((x) => x.id === where.id)!;
        aplicar(t, data);
        return t;
      }),
      count: vi.fn(async () => tarefas.filter((t) => t.tentativas < 5 && (t.status === "PENDENTE" || t.status === "EM_ANDAMENTO")).length),
      create: vi.fn(async ({ data }: { data: Partial<TarefaFalsa> }) => {
        const t = novaTarefa(data);
        tarefas.push(t);
        return t;
      }),
    },
    mercadoLivreAccount: {
      updateMany: vi.fn(async () => {
        if (conta.financeiroProcessandoAte && conta.financeiroProcessandoAte.getTime() > Date.now()) return { count: 0 };
        conta.financeiroProcessandoAte = new Date(Date.now() + 60000);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(conta, data);
        return conta;
      }),
      findUnique: vi.fn(async () => conta),
    },
  },
}));

vi.mock("../../canais/mercadoLivre/cliente", () => ({
  buscarPaginaPedidos: vi.fn(async (_conta: string, p: { campoData: string; desde: Date; ate: Date; offset: number }) => {
    relogio += 1000;
    if (falharBusca) throw new Error("Mercado Livre recusou a busca de pedidos (HTTP 500)");
    chamadasBusca.push(p);
    const chave = `${p.campoData}:${p.desde.toISOString()}`;
    const lista = paginas.get(chave) ?? [];
    const indice = p.offset / 50;
    const pedidos = lista[indice] ?? [];
    return { pedidos, total: lista.flat().length, proximoOffset: indice + 1 < lista.length ? p.offset + 50 : null };
  }),
}));

vi.mock("../lote", () => ({
  ingerirPedidosEmLote: vi.fn(async (_c: unknown, pedidos: Array<{ id: number }>, opcoes: { forcar?: boolean }) => {
    lotes.push({ ids: pedidos.map((p) => p.id), forcar: opcoes.forcar });
    return { recebidos: pedidos.length, gravados: pedidos.length, semMudanca: 0, naoRelevantes: 0, erros: 0 };
  }),
}));

const enriquecerMock = vi.fn(async () => ({ processados: 3, falhas: 0, restantes: 0 }));
vi.mock("../enriquecimento", () => ({
  enriquecerVendasPendentes: (...args: unknown[]) => enriquecerMock(...(args as [])),
  contarVendasAguardandoDetalhes: vi.fn(async () => 0),
}));
vi.mock("../ingestaoAds", () => ({ ingerirGastosAdsDoDia: vi.fn(async () => ({ processados: 0 })) }));
vi.mock("../ingestaoCobrancas", () => ({ ingerirCobrancasDoMes: vi.fn(async () => ({ processadas: 2, naoMapeadas: 0 })) }));
vi.mock("../sincronizador", () => ({
  mensagemDeErro: (e: unknown) => (e instanceof Error ? e.message : "erro"),
  obterUserIdDaConta: vi.fn(async () => "user-1"),
  tempoMaximoLoteMs: () => 40000,
}));

const { executarFila } = await import("../fila");

let sequencia = 0;
function novaTarefa(parcial: Partial<TarefaFalsa>): TarefaFalsa {
  sequencia++;
  return {
    id: `t${sequencia}`,
    userId: "user-1",
    canal: "MERCADO_LIVRE",
    contaCanalId: "conta-1",
    tipo: "PEDIDOS_PERIODO",
    desde: null,
    ate: null,
    cursor: null,
    forcar: false,
    status: "PENDENTE",
    prioridade: 0,
    tentativas: 0,
    processados: 0,
    erro: null,
    bloqueadaAte: null,
    criadaEm: new Date(Date.now() - 1000 * (100 - sequencia)),
    concluidaEm: null,
    ...parcial,
  };
}

function lote(inicio: number, quantidade: number) {
  return Array.from({ length: quantidade }, (_, i) => ({ id: inicio + i }));
}

beforeEach(() => {
  tarefas = [];
  paginas = new Map();
  chamadasBusca.length = 0;
  lotes.length = 0;
  falharBusca = false;
  relogio = 0;
  conta = { id: "conta-1", financeiroProcessandoAte: null, ultimaSincronizacaoFinanceiraEm: null };
  enriquecerMock.mockClear();
});

const INICIO_SET = new Date("2026-09-01T03:00:00.000Z");
const INICIO_OUT = new Date("2026-10-01T03:00:00.000Z");
const FIM_OUT = new Date("2026-11-01T02:59:59.999Z");

describe("executarFila — importação por período", () => {
  it("vai do mês mais recente para o mais antigo, página a página, e conclui", async () => {
    paginas.set(`date_created:${INICIO_OUT.toISOString()}`, [lote(1, 50), lote(51, 14)]);
    paginas.set(`date_created:${INICIO_SET.toISOString()}`, [lote(200, 30)]);
    tarefas.push(novaTarefa({ desde: INICIO_SET, ate: FIM_OUT, forcar: true }));

    const resultado = await executarFila("user-1", "conta-1", 60000);

    expect(chamadasBusca.map((c) => [c.desde.toISOString(), c.offset])).toEqual([
      [INICIO_OUT.toISOString(), 0],
      [INICIO_OUT.toISOString(), 50],
      [INICIO_SET.toISOString(), 0],
    ]);
    expect(chamadasBusca.every((c) => c.campoData === "date_created")).toBe(true);
    expect(lotes.flatMap((l) => l.ids)).toHaveLength(94);
    expect(lotes.every((l) => l.forcar === true)).toBe(true);
    expect(tarefas[0].status).toBe("CONCLUIDA");
    expect(tarefas[0].processados).toBe(94);
    expect(resultado.processados).toBe(94);
    expect(enriquecerMock).toHaveBeenCalled();
    expect(conta.financeiroProcessandoAte).toBeNull();
  });

  it("retoma do cursor salvo (mês e offset) sem repetir páginas", async () => {
    paginas.set(`date_created:${INICIO_OUT.toISOString()}`, [lote(1, 50), lote(51, 10)]);
    tarefas.push(
      novaTarefa({ desde: INICIO_OUT, ate: FIM_OUT, cursor: { inicioJanela: INICIO_OUT.toISOString(), offset: 50 }, processados: 50 })
    );

    await executarFila("user-1", "conta-1", 60000);

    expect(chamadasBusca).toHaveLength(1);
    expect(chamadasBusca[0].offset).toBe(50);
    expect(tarefas[0].status).toBe("CONCLUIDA");
    expect(tarefas[0].processados).toBe(60);
  });

  it("falha na API devolve a tarefa para PENDENTE com o erro e conta a tentativa", async () => {
    falharBusca = true;
    tarefas.push(novaTarefa({ desde: INICIO_OUT, ate: FIM_OUT }));

    const resultado = await executarFila("user-1", "conta-1", 60000);

    expect(resultado.status).toBe("ERRO");
    expect(tarefas[0].status).toBe("PENDENTE");
    expect(tarefas[0].tentativas).toBe(1);
    expect(tarefas[0].erro).toContain("HTTP 500");
    expect(conta.financeiroProcessandoAte).toBeNull();
  });

  it("devolve OCUPADO sem tocar em nada quando outra execução já está processando a conta", async () => {
    conta.financeiroProcessandoAte = new Date(Date.now() + 30000);
    tarefas.push(novaTarefa({ desde: INICIO_OUT, ate: FIM_OUT }));

    const resultado = await executarFila("user-1", "conta-1", 60000);

    expect(resultado.status).toBe("OCUPADO");
    expect(chamadasBusca).toHaveLength(0);
    expect(tarefas[0].status).toBe("PENDENTE");
  });

  it("sem tarefas, usa o tempo para detalhar vendas e fica OCIOSO quando não sobra nada", async () => {
    enriquecerMock.mockResolvedValueOnce({ processados: 0, falhas: 0, restantes: 0 });
    const resultado = await executarFila("user-1", "conta-1", 60000);
    expect(enriquecerMock).toHaveBeenCalled();
    expect(resultado.status).toBe("OCIOSO");
  });
});

describe("executarFila — incremental", () => {
  it("busca por data de alteração desde a última sincronização e grava o novo ponto de partida", async () => {
    conta.ultimaSincronizacaoFinanceiraEm = new Date("2026-10-18T10:00:00.000Z");
    const criadaEm = new Date("2026-10-18T20:00:00.000Z");
    tarefas.push(novaTarefa({ tipo: "PEDIDOS_INCREMENTAL", criadaEm }));
    paginas.set(`date_last_updated:${new Date("2026-10-18T08:00:00.000Z").toISOString()}`, [lote(1, 5)]);

    await executarFila("user-1", "conta-1", 60000);

    expect(chamadasBusca[0].campoData).toBe("date_last_updated");
    expect(chamadasBusca[0].desde.toISOString()).toBe("2026-10-18T08:00:00.000Z");
    expect(tarefas[0].status).toBe("CONCLUIDA");
    expect(conta.ultimaSincronizacaoFinanceiraEm?.toISOString()).toBe(criadaEm.toISOString());
  });
});
