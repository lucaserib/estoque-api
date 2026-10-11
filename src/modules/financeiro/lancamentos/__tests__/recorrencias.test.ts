import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeRecorrencia {
  id: string;
  userId: string;
  descricao: string;
  valor: number;
  categoriaId: string;
  contaFinanceiraId: string | null;
  fornecedorId: string | null;
  frequencia: string;
  diaVencimento: number;
  inicio: Date;
  fim: Date | null;
  ativo: boolean;
  geradoAte: Date | null;
}

interface FakeLancamento {
  id: string;
  userId: string;
  chaveExterna: string | null;
  recorrenciaId: string | null;
  descricao: string;
  valor: number;
  categoriaId: string;
  contaFinanceiraId: string | null;
  fornecedorId: string | null;
  vencimento: Date;
  status: string;
}

let recorrencias: FakeRecorrencia[] = [];
let lancamentos: FakeLancamento[] = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recorrenciaFinanceira: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
        const r = recorrencias.find((x) => x.id === where.id);
        if (!r) throw new Error("não encontrada");
        return r;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string } }) =>
          recorrencias.find((r) => r.id === where.id && r.userId === where.userId) ?? null
      ),
      findMany: vi.fn(
        async ({ where }: { where: { userId: string; ativo: boolean } }) =>
          recorrencias.filter((r) => r.userId === where.userId && r.ativo === where.ativo).map((r) => ({ id: r.id }))
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeRecorrencia> }) => {
          const r = recorrencias.find((x) => x.id === where.id);
          if (!r) throw new Error("não encontrada");
          Object.assign(r, data);
          return r;
        }
      ),
    },
    lancamentoFinanceiro: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { userId_chaveExterna: { userId: string; chaveExterna: string } };
          create: Omit<FakeLancamento, "id">;
          update: Partial<FakeLancamento>;
        }) => {
          const chave = where.userId_chaveExterna;
          const existente = lancamentos.find(
            (l) => l.userId === chave.userId && l.chaveExterna === chave.chaveExterna
          );
          if (existente) {
            Object.assign(existente, update);
            return existente;
          }
          const novo = { id: `id-${proximoId++}`, ...create };
          lancamentos.push(novo);
          return novo;
        }
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { recorrenciaId: string; status: string };
          data: Partial<FakeLancamento>;
        }) => {
          let count = 0;
          for (const l of lancamentos) {
            if (l.recorrenciaId === where.recorrenciaId && l.status === where.status) {
              Object.assign(l, data);
              count++;
            }
          }
          return { count };
        }
      ),
    },
  },
}));

const {
  gerarLancamentosDaRecorrencia,
  gerarLancamentosDeTodasAsRecorrencias,
  atualizarRecorrencia,
} = await import("../recorrencias");

function recorrenciaMensal(parcial: Partial<FakeRecorrencia> = {}): FakeRecorrencia {
  return {
    id: "rec-1",
    userId: "user-1",
    descricao: "Aluguel",
    valor: 150000,
    categoriaId: "cat-ocupacao",
    contaFinanceiraId: null,
    fornecedorId: null,
    frequencia: "MENSAL",
    diaVencimento: 10,
    inicio: new Date("2026-01-01T00:00:00.000Z"),
    fim: null,
    ativo: true,
    geradoAte: null,
    ...parcial,
  };
}

beforeEach(() => {
  recorrencias = [];
  lancamentos = [];
  proximoId = 1;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
});

describe("gerarLancamentosDaRecorrencia", () => {
  it("gera os lançamentos PREVISTO dos próximos 3 meses (mês atual + 2)", async () => {
    recorrencias.push(recorrenciaMensal());

    const resultado = await gerarLancamentosDaRecorrencia("rec-1");

    expect(resultado.gerados).toBe(3); // maio, junho, julho (hoje é maio, horizonte = 3 meses cheios)
    expect(lancamentos.every((l) => l.status === "PREVISTO")).toBe(true);
    expect(lancamentos.map((l) => l.vencimento.toISOString().slice(0, 10)).sort()).toEqual([
      "2026-05-10", "2026-06-10", "2026-07-10",
    ]);
  });

  it("rodar duas vezes não duplica (idempotente)", async () => {
    recorrencias.push(recorrenciaMensal());

    await gerarLancamentosDaRecorrencia("rec-1");
    const resultado = await gerarLancamentosDaRecorrencia("rec-1");

    expect(resultado.gerados).toBe(0);
    expect(lancamentos).toHaveLength(3);
  });

  it("recorrência inativa não gera nada", async () => {
    recorrencias.push(recorrenciaMensal({ ativo: false }));

    const resultado = await gerarLancamentosDaRecorrencia("rec-1");

    expect(resultado.gerados).toBe(0);
    expect(lancamentos).toHaveLength(0);
  });

  it("respeita a data de fim da recorrência", async () => {
    recorrencias.push(recorrenciaMensal({ fim: new Date("2026-06-15T00:00:00.000Z") }));

    await gerarLancamentosDaRecorrencia("rec-1");

    expect(lancamentos.map((l) => l.vencimento.toISOString().slice(0, 10)).sort()).toEqual([
      "2026-05-10", "2026-06-10",
    ]);
  });

  it("dia de vencimento 31 cai no último dia de fevereiro", async () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));
    recorrencias.push(recorrenciaMensal({ diaVencimento: 31, inicio: new Date("2026-01-01T00:00:00.000Z") }));

    await gerarLancamentosDaRecorrencia("rec-1");

    const fevereiro = lancamentos.find((l) => l.vencimento.toISOString().startsWith("2026-02"));
    expect(fevereiro?.vencimento.toISOString().slice(0, 10)).toBe("2026-02-28");
  });
});

describe("gerarLancamentosDeTodasAsRecorrencias", () => {
  it("gera para todas as recorrências ativas da conta", async () => {
    recorrencias.push(recorrenciaMensal({ id: "rec-1" }), recorrenciaMensal({ id: "rec-2" }));

    const resultado = await gerarLancamentosDeTodasAsRecorrencias("user-1");

    expect(resultado.gerados).toBe(6); // 3 de cada
  });
});

describe("atualizarRecorrencia", () => {
  it("só daqui pra frente: não toca nos lançamentos PREVISTO já gerados", async () => {
    recorrencias.push(recorrenciaMensal());
    await gerarLancamentosDaRecorrencia("rec-1");

    await atualizarRecorrencia("user-1", "rec-1", { valor: 200000 }, false);

    expect(lancamentos.every((l) => l.valor === 150000)).toBe(true);
    expect(recorrencias[0].valor).toBe(200000);
  });

  it("também para os previstos: atualiza os já gerados que ainda não foram pagos", async () => {
    recorrencias.push(recorrenciaMensal());
    await gerarLancamentosDaRecorrencia("rec-1");

    await atualizarRecorrencia("user-1", "rec-1", { valor: 200000 }, true);

    expect(lancamentos.every((l) => l.valor === 200000)).toBe(true);
  });
});
