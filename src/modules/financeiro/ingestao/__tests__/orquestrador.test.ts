import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda } from "@prisma/client";

let contas: Array<{ id: string; userId: string }> = [];
let sincronizacoes: Array<{
  id: string;
  userId: string;
  canal: CanalVenda;
  tipo: string;
  status: string;
  iniciadoEm: Date;
  concluidoEm: Date | null;
  processados: number;
  erro: string | null;
}> = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoLivreAccount: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const conta = contas.find((c) => c.id === where.id);
        if (!conta) throw new Error("conta não encontrada");
        return conta;
      }),
    },
    sincronizacaoFinanceira: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const nova = {
          id: `sinc-${proximoId++}`,
          iniciadoEm: new Date(),
          concluidoEm: null,
          processados: 0,
          erro: null,
          ...data,
        } as typeof sincronizacoes[number];
        sincronizacoes.push(nova);
        return nova;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const s = sincronizacoes.find((s) => s.id === where.id);
        if (!s) throw new Error("sincronização não encontrada");
        Object.assign(s, data);
        return s;
      }),
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; canal: CanalVenda; status: string; iniciadoEm: { gte: Date } };
        }) =>
          sincronizacoes.find(
            (s) =>
              s.userId === where.userId &&
              s.canal === where.canal &&
              s.status === where.status &&
              s.iniciadoEm.getTime() >= where.iniciadoEm.gte.getTime()
          ) ?? null
      ),
    },
  },
}));

interface ResultadoExecucaoFilaFake {
  tarefaId: string | null;
  tipo: string | null;
  status: "OCIOSO" | "CONCLUIDA" | "EM_ANDAMENTO" | "ERRO";
  processados: number;
}

const enfileirarIncrementalMock = vi.fn(async (..._args: unknown[]) => ({ id: "tarefa-1" }));
const enfileirarPeriodoMock = vi.fn(async (..._args: unknown[]) => ({ id: "tarefa-1" }));
const executarFilaMock = vi.fn(
  async (..._args: unknown[]): Promise<ResultadoExecucaoFilaFake> => ({
    tarefaId: "tarefa-1",
    tipo: "PEDIDOS_PERIODO",
    status: "CONCLUIDA",
    processados: 3,
  })
);
vi.mock("../fila", () => ({
  enfileirarIncremental: (...args: unknown[]) => enfileirarIncrementalMock(...args),
  enfileirarPeriodo: (...args: unknown[]) => enfileirarPeriodoMock(...args),
  executarFila: (...args: unknown[]) => executarFilaMock(...args),
}));

const ingerirGastosAdsDoDiaMock = vi.fn(async () => ({ processados: 0 }));
vi.mock("../ingestaoAds", () => ({ ingerirGastosAdsDoDia: ingerirGastosAdsDoDiaMock }));

const ingerirCobrancasDoMesMock = vi.fn(async () => ({ processadas: 0, naoMapeadas: 0 }));
vi.mock("../ingestaoCobrancas", () => ({ ingerirCobrancasDoMes: ingerirCobrancasDoMesMock }));

const { sincronizarFinanceiro, obterTravaAtiva } = await import("../orquestrador");

beforeEach(() => {
  contas = [{ id: "conta-1", userId: "user-1" }];
  sincronizacoes = [];
  proximoId = 1;
  enfileirarIncrementalMock.mockClear();
  enfileirarPeriodoMock.mockClear();
  executarFilaMock.mockClear().mockResolvedValue({
    tarefaId: "tarefa-1",
    tipo: "PEDIDOS_PERIODO",
    status: "CONCLUIDA",
    processados: 3,
  });
  ingerirGastosAdsDoDiaMock.mockClear();
  ingerirCobrancasDoMesMock.mockClear();
});

describe("sincronizarFinanceiro", () => {
  it("INCREMENTAL enfileira PEDIDOS_INCREMENTAL, executa a fila e ingere ads/cobranças do período", async () => {
    const resultado = await sincronizarFinanceiro("conta-1", { modo: "INCREMENTAL" });

    expect(enfileirarIncrementalMock).toHaveBeenCalledWith("conta-1", 10);
    expect(executarFilaMock).toHaveBeenCalledWith("user-1", "conta-1");
    expect(ingerirGastosAdsDoDiaMock).toHaveBeenCalled();
    expect(ingerirCobrancasDoMesMock).toHaveBeenCalled();
    expect(resultado.status).toBe("CONCLUIDO");
    expect(resultado.processados).toBe(3);
  });

  it("BACKFILL enfileira PEDIDOS_PERIODO com prioridade alta e devolve EM_ANDAMENTO quando a fila ainda não terminou", async () => {
    executarFilaMock.mockResolvedValueOnce({
      tarefaId: "tarefa-1",
      tipo: "PEDIDOS_PERIODO",
      status: "EM_ANDAMENTO",
      processados: 10,
    });

    const resultado = await sincronizarFinanceiro("conta-1", { modo: "BACKFILL" });

    expect(enfileirarPeriodoMock).toHaveBeenCalledWith("conta-1", expect.anything(), expect.anything(), 20);
    expect(resultado.status).toBe("EM_ANDAMENTO");
    expect(resultado.proximoPasso).toBe("CONTINUAR");
  });

  it("PERIODO enfileira PEDIDOS_PERIODO com o desde/até pedidos e ingere cobranças de todos os meses entre eles", async () => {
    await sincronizarFinanceiro("conta-1", {
      modo: "PERIODO",
      desde: new Date("2026-03-15T00:00:00.000Z"),
      ate: new Date("2026-05-10T00:00:00.000Z"),
    });

    expect(enfileirarPeriodoMock).toHaveBeenCalledWith(
      "conta-1",
      new Date("2026-03-15T00:00:00.000Z"),
      new Date("2026-05-10T00:00:00.000Z"),
      10
    );
    expect(ingerirCobrancasDoMesMock).toHaveBeenCalledTimes(3);
  });

  it("registra a sincronização como CONCLUIDO quando a fila termina", async () => {
    await sincronizarFinanceiro("conta-1", { modo: "INCREMENTAL" });

    expect(sincronizacoes).toHaveLength(1);
    expect(sincronizacoes[0].status).toBe("CONCLUIDO");
    expect(sincronizacoes[0].processados).toBe(3);
  });

  it("marca ERRO e relança quando a fila falha", async () => {
    executarFilaMock.mockRejectedValueOnce(new Error("falha de rede"));

    await expect(sincronizarFinanceiro("conta-1", { modo: "INCREMENTAL" })).rejects.toThrow("falha de rede");
    expect(sincronizacoes[0].status).toBe("ERRO");
  });
});

describe("obterTravaAtiva", () => {
  it("devolve null quando não há sincronização em andamento recente", async () => {
    const trava = await obterTravaAtiva("user-1", CanalVenda.MERCADO_LIVRE);
    expect(trava).toBeNull();
  });

  it("devolve a sincronização em andamento dentro da janela de expiração", async () => {
    sincronizacoes.push({
      id: "sinc-ativa", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, tipo: "INCREMENTAL",
      status: "EM_ANDAMENTO", iniciadoEm: new Date(), concluidoEm: null, processados: 0, erro: null,
    });

    const trava = await obterTravaAtiva("user-1", CanalVenda.MERCADO_LIVRE);
    expect(trava?.id).toBe("sinc-ativa");
  });

  it("ignora uma sincronização EM_ANDAMENTO velha (trava expirada)", async () => {
    sincronizacoes.push({
      id: "sinc-velha", userId: "user-1", canal: CanalVenda.MERCADO_LIVRE, tipo: "INCREMENTAL",
      status: "EM_ANDAMENTO", iniciadoEm: new Date(Date.now() - 10 * 60 * 1000), concluidoEm: null,
      processados: 0, erro: null,
    });

    const trava = await obterTravaAtiva("user-1", CanalVenda.MERCADO_LIVRE);
    expect(trava).toBeNull();
  });
});
