import { describe, it, expect, beforeEach, vi } from "vitest";

interface FakeConta {
  id: string;
  userId: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  saldoInicial: number;
  dataSaldoInicial: Date;
  automatica: boolean;
  saldoAtualExterno: number | null;
  saldoALiberarExterno: number | null;
  saldoExternoAtualizadoEm: Date | null;
  saldoExternoConfianca: string | null;
}

interface FakeLancamento {
  contaFinanceiraId: string;
  status: string;
  tipo: string;
  valor: number;
  pagamento: Date | null;
}

let contas: FakeConta[] = [];
let lancamentos: FakeLancamento[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contaFinanceira: {
      findMany: vi.fn(async ({ where }: { where: { userId: string; ativo: boolean } }) =>
        contas.filter((c) => c.userId === where.userId && c.ativo === where.ativo)
      ),
    },
    lancamentoFinanceiro: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { contaFinanceiraId: string; status: string; pagamento: { gte: Date; lte: Date } };
        }) =>
          lancamentos.filter(
            (l) =>
              l.contaFinanceiraId === where.contaFinanceiraId &&
              l.status === where.status &&
              l.pagamento &&
              l.pagamento >= where.pagamento.gte &&
              l.pagamento <= where.pagamento.lte
          )
      ),
    },
  },
}));

const { listarContasComSaldo, calcularSaldoTotalAtual } = await import("../saldoContas");

beforeEach(() => {
  contas = [];
  lancamentos = [];
});

function contaBase(parcial: Partial<FakeConta>): FakeConta {
  return {
    id: "conta-1",
    userId: "user-1",
    nome: "Banco",
    tipo: "BANCO",
    ativo: true,
    saldoInicial: 1000,
    dataSaldoInicial: new Date("2026-01-01"),
    automatica: false,
    saldoAtualExterno: null,
    saldoALiberarExterno: null,
    saldoExternoAtualizadoEm: null,
    saldoExternoConfianca: null,
    ...parcial,
  };
}

describe("listarContasComSaldo", () => {
  it("conta normal: saldo atual = saldo inicial + lançamentos pagos desde a data do saldo inicial", async () => {
    contas.push(contaBase({}));
    lancamentos.push(
      { contaFinanceiraId: "conta-1", status: "PAGO", tipo: "RECEITA", valor: 500, pagamento: new Date("2026-02-01") },
      { contaFinanceiraId: "conta-1", status: "PAGO", tipo: "DESPESA", valor: 200, pagamento: new Date("2026-02-02") }
    );

    const resultado = await listarContasComSaldo("user-1");

    expect(resultado[0].saldoAtual).toBe(1000 + 500 - 200);
    expect(resultado[0].origemSaldo).toBe("LANCAMENTOS");
  });

  it("carteira Mercado Pago com saldo confirmado: usa o saldo externo, ignora lançamentos", async () => {
    contas.push(
      contaBase({
        tipo: "CARTEIRA_MARKETPLACE",
        saldoAtualExterno: 7777,
        saldoALiberarExterno: 222,
        saldoExternoConfianca: "CONFIRMADO",
      })
    );
    lancamentos.push({ contaFinanceiraId: "conta-1", status: "PAGO", tipo: "RECEITA", valor: 99999, pagamento: new Date("2026-02-01") });

    const resultado = await listarContasComSaldo("user-1");

    expect(resultado[0].saldoAtual).toBe(7777);
    expect(resultado[0].saldoALiberarExterno).toBe(222);
    expect(resultado[0].origemSaldo).toBe("API_MERCADO_PAGO");
  });

  it("carteira Mercado Pago sem saldo confirmado ainda: cai para o cálculo por lançamentos", async () => {
    contas.push(contaBase({ tipo: "CARTEIRA_MARKETPLACE", saldoExternoConfianca: "ESTIMADO" }));

    const resultado = await listarContasComSaldo("user-1");

    expect(resultado[0].origemSaldo).toBe("LANCAMENTOS");
    expect(resultado[0].saldoAtual).toBe(1000);
  });
});

describe("calcularSaldoTotalAtual", () => {
  it("soma todas as contas exceto cartão de crédito", async () => {
    contas.push(
      contaBase({ id: "c1", saldoInicial: 1000 }),
      contaBase({ id: "c2", tipo: "CARTAO_CREDITO", saldoInicial: 99999 })
    );

    const total = await calcularSaldoTotalAtual("user-1");

    expect(total).toBe(1000);
  });
});
