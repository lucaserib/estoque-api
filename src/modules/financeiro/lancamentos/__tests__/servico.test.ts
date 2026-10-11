import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeLancamento {
  id: string;
  userId: string;
  tipo: string;
  descricao: string;
  valor: number;
  categoriaId: string;
  contaFinanceiraId: string | null;
  competencia: Date;
  vencimento: Date;
  pagamento: Date | null;
  status: string;
  origem: string;
  fornecedorId: string | null;
}

let lancamentos: FakeLancamento[] = [];
let proximoId = 1;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lancamentoFinanceiro: {
      create: vi.fn(async ({ data }: { data: Omit<FakeLancamento, "id"> }) => {
        const novo = { id: `id-${proximoId++}`, ...data };
        lancamentos.push(novo);
        return novo;
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; status?: string; categoriaId?: string; vencimento?: { gte?: Date; lte?: Date } };
        }) =>
          lancamentos.filter((l) => {
            if (l.userId !== where.userId) return false;
            if (where.status && l.status !== where.status) return false;
            if (where.categoriaId && l.categoriaId !== where.categoriaId) return false;
            if (where.vencimento?.gte && l.vencimento < where.vencimento.gte) return false;
            if (where.vencimento?.lte && l.vencimento > where.vencimento.lte) return false;
            return true;
          })
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string } }) =>
          lancamentos.find((l) => l.id === where.id && l.userId === where.userId) ?? null
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeLancamento> }) => {
          const lancamento = lancamentos.find((l) => l.id === where.id);
          if (!lancamento) throw new Error("not found");
          Object.assign(lancamento, data);
          return lancamento;
        }
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        lancamentos = lancamentos.filter((l) => l.id !== where.id);
        return {};
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: { in: string[] }; userId: string; status?: string };
          data: Partial<FakeLancamento>;
        }) => {
          let count = 0;
          for (const lancamento of lancamentos) {
            if (
              where.id.in.includes(lancamento.id) &&
              lancamento.userId === where.userId &&
              (!where.status || lancamento.status === where.status)
            ) {
              Object.assign(lancamento, data);
              count++;
            }
          }
          return { count };
        }
      ),
      deleteMany: vi.fn(
        async ({ where }: { where: { id: { in: string[] }; userId: string; status: string } }) => {
          const antes = lancamentos.length;
          lancamentos = lancamentos.filter(
            (l) => !(where.id.in.includes(l.id) && l.userId === where.userId && l.status === where.status)
          );
          return { count: antes - lancamentos.length };
        }
      ),
    },
  },
}));

const {
  criarLancamento,
  listarLancamentos,
  atualizarLancamento,
  excluirLancamento,
  marcarComoPagoEmLote,
  alterarCategoriaEmLote,
  excluirPrevistosEmLote,
  LancamentoNaoEncontradoError,
} = await import("../servico");

function dadosBase() {
  return {
    tipo: "DESPESA" as const,
    descricao: "Aluguel",
    valor: 150000,
    categoriaId: "cat-ocupacao",
    competencia: new Date("2026-05-01"),
    vencimento: new Date("2026-05-10"),
  };
}

beforeEach(() => {
  lancamentos = [];
  proximoId = 1;
});

describe("criarLancamento", () => {
  it("cria como PREVISTO quando não há data de pagamento", async () => {
    const lancamento = await criarLancamento("user-1", "user-1", dadosBase());
    expect(lancamento.status).toBe("PREVISTO");
  });

  it("cria já como PAGO quando a data de pagamento é informada", async () => {
    const lancamento = await criarLancamento("user-1", "user-1", { ...dadosBase(), pagamento: new Date("2026-05-10") });
    expect(lancamento.status).toBe("PAGO");
  });
});

describe("listarLancamentos", () => {
  it("filtra por status e por período de vencimento", async () => {
    await criarLancamento("user-1", "user-1", dadosBase());
    await criarLancamento("user-1", "user-1", { ...dadosBase(), vencimento: new Date("2026-06-10") });

    const resultado = await listarLancamentos("user-1", { desde: new Date("2026-05-01"), ate: new Date("2026-05-31") });
    expect(resultado).toHaveLength(1);
  });

  it("não devolve lançamentos de outra conta", async () => {
    await criarLancamento("user-1", "user-1", dadosBase());
    await criarLancamento("user-2", "user-2", dadosBase());

    const resultado = await listarLancamentos("user-1", {});
    expect(resultado).toHaveLength(1);
  });
});

describe("atualizarLancamento / excluirLancamento", () => {
  it("lança LancamentoNaoEncontradoError para lançamento de outra conta", async () => {
    const lancamento = await criarLancamento("user-1", "user-1", dadosBase());

    await expect(atualizarLancamento("user-2", lancamento.id, { valor: 1 })).rejects.toThrow(
      LancamentoNaoEncontradoError
    );
    await expect(excluirLancamento("user-2", lancamento.id)).rejects.toThrow(LancamentoNaoEncontradoError);
  });

  it("atualiza e exclui normalmente dentro da própria conta", async () => {
    const lancamento = await criarLancamento("user-1", "user-1", dadosBase());

    await atualizarLancamento("user-1", lancamento.id, { valor: 999 });
    expect(lancamentos[0].valor).toBe(999);

    await excluirLancamento("user-1", lancamento.id);
    expect(lancamentos).toHaveLength(0);
  });
});

describe("ações em lote", () => {
  it("marca como pago só os ids da própria conta", async () => {
    const a = await criarLancamento("user-1", "user-1", dadosBase());
    const b = await criarLancamento("user-2", "user-2", dadosBase());

    const resultado = await marcarComoPagoEmLote("user-1", [a.id, b.id]);

    expect(resultado.atualizados).toBe(1);
    expect(lancamentos.find((l) => l.id === a.id)!.status).toBe("PAGO");
    expect(lancamentos.find((l) => l.id === b.id)!.status).toBe("PREVISTO");
  });

  it("altera categoria em lote", async () => {
    const a = await criarLancamento("user-1", "user-1", dadosBase());
    await alterarCategoriaEmLote("user-1", [a.id], "cat-nova");
    expect(lancamentos[0].categoriaId).toBe("cat-nova");
  });

  it("exclui em lote só os previstos, nunca os pagos", async () => {
    const previsto = await criarLancamento("user-1", "user-1", dadosBase());
    const pago = await criarLancamento("user-1", "user-1", { ...dadosBase(), pagamento: new Date() });

    const resultado = await excluirPrevistosEmLote("user-1", [previsto.id, pago.id]);

    expect(resultado.excluidos).toBe(1);
    expect(lancamentos.find((l) => l.id === pago.id)).toBeDefined();
    expect(lancamentos.find((l) => l.id === previsto.id)).toBeUndefined();
  });
});
