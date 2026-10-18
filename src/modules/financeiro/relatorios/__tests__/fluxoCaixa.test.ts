import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeLancamento {
  userId: string;
  contaFinanceiraId?: string;
  tipo: string;
  status: string;
  valor: number;
  pagamento: Date | null;
  vencimento: Date;
}
interface FakeConta {
  id: string;
  userId: string;
  ativo: boolean;
  tipo: string;
  nome: string;
  saldoInicial: number;
  dataSaldoInicial: Date;
  automatica: boolean;
  saldoAtualExterno: number | null;
  saldoALiberarExterno: number | null;
  saldoExternoAtualizadoEm: Date | null;
  saldoExternoConfianca: string | null;
}
interface FakeVenda {
  userId: string;
  dataLiberacao: Date | null;
  valorLiquidoReceber: number | null;
}

let lancamentos: FakeLancamento[] = [];
let contas: FakeConta[] = [];
let vendas: FakeVenda[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lancamentoFinanceiro: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            userId?: string;
            contaFinanceiraId?: string;
            status: string;
            pagamento?: { gte: Date; lte: Date };
            vencimento?: { gte: Date; lte: Date };
          };
        }) =>
          lancamentos.filter((l) => {
            if (where.userId && l.userId !== where.userId) return false;
            if (where.contaFinanceiraId && l.contaFinanceiraId !== where.contaFinanceiraId) return false;
            if (l.status !== where.status) return false;
            if (where.pagamento) {
              if (!l.pagamento) return false;
              if (l.pagamento < where.pagamento.gte || l.pagamento > where.pagamento.lte) return false;
            }
            if (where.vencimento && (l.vencimento < where.vencimento.gte || l.vencimento > where.vencimento.lte)) return false;
            return true;
          })
      ),
    },
    mercadoLivreAccount: {
      findMany: vi.fn(async () => []),
    },
    contaFinanceira: {
      findMany: vi.fn(
        async ({ where }: { where: { userId: string; ativo: boolean } }) =>
          contas.filter((c) => c.userId === where.userId && c.ativo === where.ativo)
      ),
    },
    vendaCanal: {
      findMany: vi.fn(
        async ({ where }: { where: { userId: string; dataLiberacao: { gt: Date; lte: Date } } }) =>
          vendas.filter(
            (v) =>
              v.userId === where.userId &&
              v.dataLiberacao &&
              v.dataLiberacao > where.dataLiberacao.gt &&
              v.dataLiberacao <= where.dataLiberacao.lte
          )
      ),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  withUserCache: vi.fn(async (_userId: string, _key: string, fetcher: () => Promise<unknown>) => fetcher()),
  mlCache: { invalidatePattern: vi.fn(async () => 0) },
}));

const { gerarFluxoCaixa, gerarSaldoProjetado } = await import("../fluxoCaixa");

beforeEach(() => {
  lancamentos = [];
  contas = [];
  vendas = [];
});

describe("gerarFluxoCaixa", () => {
  it("agrupa realizado (pago) e previsto por dia", async () => {
    lancamentos.push(
      { userId: "user-1", tipo: "RECEITA", status: "PAGO", valor: 1000, pagamento: new Date("2026-05-10T12:00:00.000Z"), vencimento: new Date("2026-05-10") },
      { userId: "user-1", tipo: "DESPESA", status: "PREVISTO", valor: 300, pagamento: null, vencimento: new Date("2026-05-10T12:00:00.000Z") }
    );

    const fluxo = await gerarFluxoCaixa("user-1", new Date("2026-05-01"), new Date("2026-05-31"), "DIA");

    expect(fluxo.pontos).toHaveLength(1);
    expect(fluxo.pontos[0].realizado).toBe(1000);
    expect(fluxo.pontos[0].previsto).toBe(-300);
  });

  it("TRANSFERENCIA conta como saída de caixa (pagamento de fatura de cartão)", async () => {
    lancamentos.push({
      userId: "user-1", tipo: "TRANSFERENCIA", status: "PAGO", valor: 500,
      pagamento: new Date("2026-05-10T12:00:00.000Z"), vencimento: new Date("2026-05-10"),
    });

    const fluxo = await gerarFluxoCaixa("user-1", new Date("2026-05-01"), new Date("2026-05-31"), "DIA");

    expect(fluxo.pontos[0].realizado).toBe(-500);
  });

  it("agrupa por mês quando a granularidade é MES", async () => {
    lancamentos.push(
      { userId: "user-1", tipo: "RECEITA", status: "PAGO", valor: 100, pagamento: new Date("2026-05-05T12:00:00.000Z"), vencimento: new Date("2026-05-05") },
      { userId: "user-1", tipo: "RECEITA", status: "PAGO", valor: 200, pagamento: new Date("2026-05-25T12:00:00.000Z"), vencimento: new Date("2026-05-25") }
    );

    const fluxo = await gerarFluxoCaixa("user-1", new Date("2026-05-01"), new Date("2026-05-31"), "MES");

    expect(fluxo.pontos).toHaveLength(1);
    expect(fluxo.pontos[0].realizado).toBe(300);
  });

  it("pontos saem ordenados do mais antigo para o mais recente", async () => {
    lancamentos.push(
      { userId: "user-1", tipo: "RECEITA", status: "PAGO", valor: 1, pagamento: new Date("2026-05-20T12:00:00.000Z"), vencimento: new Date("2026-05-20") },
      { userId: "user-1", tipo: "RECEITA", status: "PAGO", valor: 1, pagamento: new Date("2026-05-10T12:00:00.000Z"), vencimento: new Date("2026-05-10") }
    );

    const fluxo = await gerarFluxoCaixa("user-1", new Date("2026-05-01"), new Date("2026-05-31"), "DIA");

    expect(fluxo.pontos[0].periodo.getTime()).toBeLessThan(fluxo.pontos[1].periodo.getTime());
  });
});

describe("gerarSaldoProjetado", () => {
  it("soma saldo atual das contas (exceto cartão de crédito), liberações futuras e previstos", async () => {
    contas.push(
      {
        id: "conta-1", userId: "user-1", ativo: true, tipo: "BANCO", nome: "Banco",
        saldoInicial: 10000, dataSaldoInicial: new Date("2026-01-01"),
        automatica: false, saldoAtualExterno: null, saldoALiberarExterno: null, saldoExternoAtualizadoEm: null, saldoExternoConfianca: null,
      },
      {
        id: "conta-2", userId: "user-1", ativo: true, tipo: "CARTAO_CREDITO", nome: "Cartão", // nunca deve entrar
        saldoInicial: 99999, dataSaldoInicial: new Date("2026-01-01"),
        automatica: false, saldoAtualExterno: null, saldoALiberarExterno: null, saldoExternoAtualizadoEm: null, saldoExternoConfianca: null,
      }
    );
    vendas.push({ userId: "user-1", dataLiberacao: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), valorLiquidoReceber: 2000 });
    lancamentos.push({
      userId: "user-1", tipo: "DESPESA", status: "PREVISTO", valor: 500,
      pagamento: null, vencimento: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });

    const resultado = await gerarSaldoProjetado("user-1", 30);

    expect(resultado.saldoAtual).toBe(10000); // cartão de crédito excluído, sem lançamentos pagos
    expect(resultado.liberacoesFuturas).toBe(2000);
    expect(resultado.lancamentosPrevistos).toBe(-500);
    expect(resultado.saldoProjetado).toBe(10000 + 2000 - 500);
  });
});
