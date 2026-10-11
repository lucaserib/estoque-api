import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolverMesReferenciaFatura,
  calcularFechamentoEVencimento,
} from "../cartao";

describe("resolverMesReferenciaFatura", () => {
  it("compra antes do fechamento entra na fatura do mesmo mês", () => {
    expect(resolverMesReferenciaFatura(10, new Date("2026-05-05T00:00:00.000Z"))).toBe("2026-05");
  });

  it("compra exatamente no dia do fechamento entra na fatura que fecha nesse dia (inclusive)", () => {
    expect(resolverMesReferenciaFatura(10, new Date("2026-05-10T00:00:00.000Z"))).toBe("2026-05");
  });

  it("compra depois do fechamento rola para a fatura do mês seguinte", () => {
    expect(resolverMesReferenciaFatura(10, new Date("2026-05-11T00:00:00.000Z"))).toBe("2026-06");
  });

  it("compra em dezembro depois do fechamento vira janeiro do ano seguinte", () => {
    expect(resolverMesReferenciaFatura(10, new Date("2026-12-15T00:00:00.000Z"))).toBe("2027-01");
  });
});

describe("calcularFechamentoEVencimento", () => {
  it("vencimento depois do fechamento fica no mesmo mês", () => {
    const { fechamento, vencimento } = calcularFechamentoEVencimento(10, 17, "2026-05");

    expect(fechamento.toISOString().slice(0, 10)).toBe("2026-05-10");
    expect(vencimento.toISOString().slice(0, 10)).toBe("2026-05-17");
  });

  it("vencimento antes do fechamento (numericamente) cai no mês seguinte", () => {
    const { vencimento } = calcularFechamentoEVencimento(25, 5, "2026-05");
    expect(vencimento.toISOString().slice(0, 10)).toBe("2026-06-05");
  });

  it("fechamento em dezembro com vencimento no mês seguinte vira janeiro do ano seguinte", () => {
    const { vencimento } = calcularFechamentoEVencimento(25, 5, "2026-12");
    expect(vencimento.toISOString().slice(0, 10)).toBe("2027-01-05");
  });
});

interface FakeConta {
  id: string;
  userId: string;
  tipo: string;
  diaFechamento: number | null;
  diaVencimento: number | null;
}
interface FakeFatura {
  id: string;
  userId: string;
  contaFinanceiraId: string;
  mesReferencia: string;
  fechamento: Date;
  vencimento: Date;
  status: string;
  lancamentoPagamentoId: string | null;
}
interface FakeLancamento {
  id: string;
  userId: string;
  faturaCartaoId: string | null;
  valor: number;
  status: string;
  tipo: string;
  categoriaId: string;
  contaFinanceiraId: string | null;
  pagamento: Date | null;
}

let contas: FakeConta[] = [];
let faturas: FakeFatura[] = [];
let lancamentos: FakeLancamento[] = [];
let categorias: Array<{ id: string; userId: string; nome: string; paiId: null }> = [];
let proximoId = 1;

const seedPlanoContasPadraoMock = vi.fn();
vi.mock("../planoContasPadrao", () => ({
  seedPlanoContasPadrao: (userId: string) => seedPlanoContasPadraoMock(userId),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contaFinanceira: {
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string; tipo: string } }) =>
          contas.find((c) => c.id === where.id && c.userId === where.userId && c.tipo === where.tipo) ?? null
      ),
    },
    faturaCartao: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { contaFinanceiraId_mesReferencia: { contaFinanceiraId: string; mesReferencia: string } };
        }) => {
          const chave = where.contaFinanceiraId_mesReferencia;
          return (
            faturas.find(
              (f) => f.contaFinanceiraId === chave.contaFinanceiraId && f.mesReferencia === chave.mesReferencia
            ) ?? null
          );
        }
      ),
      create: vi.fn(async ({ data }: { data: Omit<FakeFatura, "id" | "lancamentoPagamentoId"> }) => {
        const nova = { id: `fat-${proximoId++}`, lancamentoPagamentoId: null, ...data };
        faturas.push(nova);
        return nova;
      }),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string } }) =>
          faturas.find((f) => f.id === where.id && f.userId === where.userId) ?? null
      ),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Partial<FakeFatura> }) => {
          const fatura = faturas.find((f) => f.id === where.id);
          if (!fatura) throw new Error("não encontrada");
          Object.assign(fatura, data);
          return fatura;
        }
      ),
    },
    categoriaFinanceira: {
      findFirst: vi.fn(
        async ({ where }: { where: { userId: string; nome: string } }) =>
          categorias.find((c) => c.userId === where.userId && c.nome === where.nome) ?? null
      ),
    },
    lancamentoFinanceiro: {
      create: vi.fn(async ({ data }: { data: Omit<FakeLancamento, "id"> }) => {
        const novo = { id: `lanc-${proximoId++}`, ...data };
        lancamentos.push(novo);
        return novo;
      }),
      findMany: vi.fn(
        async ({ where }: { where: { faturaCartaoId: string } }) =>
          lancamentos.filter((l) => l.faturaCartaoId === where.faturaCartaoId)
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { faturaCartaoId: string; status: { not: string } };
          data: Partial<FakeLancamento>;
        }) => {
          let count = 0;
          for (const l of lancamentos) {
            if (l.faturaCartaoId === where.faturaCartaoId && l.status !== where.status.not) {
              Object.assign(l, data);
              count++;
            }
          }
          return { count };
        }
      ),
    },
    $transaction: vi.fn(async (arg: Array<Promise<unknown>>) => Promise.all(arg)),
  },
}));

const { registrarCompraNoCartao, pagarFatura, FaturaJaPagaError } = await import("../cartao");

beforeEach(() => {
  contas = [{ id: "cartao-1", userId: "user-1", tipo: "CARTAO_CREDITO", diaFechamento: 10, diaVencimento: 17 }];
  faturas = [];
  lancamentos = [];
  categorias = [{ id: "cat-outras", userId: "user-1", nome: "Outras", paiId: null }];
  proximoId = 1;
  seedPlanoContasPadraoMock.mockReset();
});

describe("registrarCompraNoCartao", () => {
  it("compra no dia do fechamento entra na fatura que fecha nesse dia, com o vencimento certo", async () => {
    await registrarCompraNoCartao("user-1", "user-1", "cartao-1", {
      descricao: "Compra", valor: 5000, categoriaId: "cat-1", dataCompra: new Date("2026-05-10T00:00:00.000Z"),
    });

    expect(faturas).toHaveLength(1);
    expect(faturas[0].mesReferencia).toBe("2026-05");
    expect(lancamentos[0].faturaCartaoId).toBe(faturas[0].id);
  });

  it("duas compras no mesmo mês de fatura reaproveitam a mesma fatura", async () => {
    await registrarCompraNoCartao("user-1", "user-1", "cartao-1", {
      descricao: "Compra 1", valor: 5000, categoriaId: "cat-1", dataCompra: new Date("2026-05-01T00:00:00.000Z"),
    });
    await registrarCompraNoCartao("user-1", "user-1", "cartao-1", {
      descricao: "Compra 2", valor: 3000, categoriaId: "cat-1", dataCompra: new Date("2026-05-05T00:00:00.000Z"),
    });

    expect(faturas).toHaveLength(1);
    expect(lancamentos).toHaveLength(2);
  });

  it("recusa conta que não é cartão de crédito configurado", async () => {
    contas.push({ id: "banco-1", userId: "user-1", tipo: "BANCO", diaFechamento: null, diaVencimento: null });

    await expect(
      registrarCompraNoCartao("user-1", "user-1", "banco-1", {
        descricao: "Compra", valor: 5000, categoriaId: "cat-1", dataCompra: new Date(),
      })
    ).rejects.toThrow();
  });
});

describe("pagarFatura", () => {
  it("soma os lançamentos da fatura, cria a transferência e marca tudo como pago", async () => {
    await registrarCompraNoCartao("user-1", "user-1", "cartao-1", {
      descricao: "Compra 1", valor: 5000, categoriaId: "cat-1", dataCompra: new Date("2026-05-01T00:00:00.000Z"),
    });
    await registrarCompraNoCartao("user-1", "user-1", "cartao-1", {
      descricao: "Compra 2", valor: 3000, categoriaId: "cat-1", dataCompra: new Date("2026-05-05T00:00:00.000Z"),
    });

    const resultado = await pagarFatura("user-1", faturas[0].id, "banco-1");

    const pagamento = lancamentos.find((l) => l.id === resultado.lancamentoPagamentoId)!;
    expect(pagamento.valor).toBe(8000);
    expect(pagamento.tipo).toBe("TRANSFERENCIA");
    expect(pagamento.contaFinanceiraId).toBe("banco-1");
    expect(lancamentos.every((l) => l.status === "PAGO")).toBe(true);
    expect(faturas[0].status).toBe("PAGO");
    expect(faturas[0].lancamentoPagamentoId).toBe(resultado.lancamentoPagamentoId);
  });

  it("não permite pagar a mesma fatura duas vezes", async () => {
    await registrarCompraNoCartao("user-1", "user-1", "cartao-1", {
      descricao: "Compra", valor: 5000, categoriaId: "cat-1", dataCompra: new Date("2026-05-01T00:00:00.000Z"),
    });

    await pagarFatura("user-1", faturas[0].id, "banco-1");

    await expect(pagarFatura("user-1", faturas[0].id, "banco-1")).rejects.toThrow(FaturaJaPagaError);
  });
});
