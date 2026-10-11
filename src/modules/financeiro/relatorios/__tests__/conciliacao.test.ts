import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda } from "@prisma/client";

let vendasAgregadas = { tarifaVenda: 0, freteVendedor: 0 };
let cobrancasAgrupadas: Array<{ tipoNormalizado: string; valor: number }> = [];
let categorias: Array<{ id: string; userId: string; nome: string; paiId: null }> = [];
let lancamentos: Array<{
  id: string;
  userId: string;
  chaveExterna: string;
  tipo: string;
  valor: number;
  categoriaId: string;
}> = [];
let proximoId = 1;

const seedPlanoContasPadraoMock = vi.fn();
vi.mock("../../lancamentos/planoContasPadrao", () => ({
  seedPlanoContasPadrao: (userId: string) => seedPlanoContasPadraoMock(userId),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vendaCanal: {
      aggregate: vi.fn(async () => ({ _sum: vendasAgregadas })),
    },
    cobrancaCanal: {
      groupBy: vi.fn(async () =>
        cobrancasAgrupadas.map((c) => ({ tipoNormalizado: c.tipoNormalizado, _sum: { valor: c.valor } }))
      ),
    },
    categoriaFinanceira: {
      findFirst: vi.fn(
        async ({ where }: { where: { userId: string; nome: string } }) =>
          categorias.find((c) => c.userId === where.userId && c.nome === where.nome) ?? null
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
          create: Omit<(typeof lancamentos)[number], "id">;
          update: Partial<(typeof lancamentos)[number]>;
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
    },
  },
}));

const { gerarRelatorioConciliacao, gerarLancamentoAjusteConciliacao } = await import("../conciliacao");

beforeEach(() => {
  vendasAgregadas = { tarifaVenda: 0, freteVendedor: 0 };
  cobrancasAgrupadas = [];
  categorias = [
    { id: "cat-tarifa", userId: "user-1", nome: "Tarifas de marketplace", paiId: null },
    { id: "cat-frete", userId: "user-1", nome: "Frete de vendas", paiId: null },
  ];
  lancamentos = [];
  proximoId = 1;
  seedPlanoContasPadraoMock.mockReset();
});

describe("gerarRelatorioConciliacao", () => {
  it("sem diferença, não gera alerta", async () => {
    vendasAgregadas = { tarifaVenda: 10000, freteVendedor: 5000 };
    cobrancasAgrupadas = [
      { tipoNormalizado: "TARIFA_VENDA", valor: 10000 },
      { tipoNormalizado: "FRETE", valor: 5000 },
    ];

    const relatorio = await gerarRelatorioConciliacao("user-1", CanalVenda.MERCADO_LIVRE, "2026-05");

    expect(relatorio.linhas.every((l) => !l.alerta)).toBe(true);
  });

  it("diferença acima de 1% gera alerta", async () => {
    vendasAgregadas = { tarifaVenda: 10000, freteVendedor: 0 };
    cobrancasAgrupadas = [{ tipoNormalizado: "TARIFA_VENDA", valor: 10300 }]; // 3% de diferença

    const relatorio = await gerarRelatorioConciliacao("user-1", CanalVenda.MERCADO_LIVRE, "2026-05");
    const linhaTarifa = relatorio.linhas.find((l) => l.tipo === "TARIFA_VENDA")!;

    expect(linhaTarifa.diferenca).toBe(300);
    expect(linhaTarifa.alerta).toBe(true);
  });

  it("sem pedidos no mês, diferençaPercentual é null em vez de dividir por zero", async () => {
    vendasAgregadas = { tarifaVenda: 0, freteVendedor: 0 };
    cobrancasAgrupadas = [{ tipoNormalizado: "TARIFA_VENDA", valor: 500 }];

    const relatorio = await gerarRelatorioConciliacao("user-1", CanalVenda.MERCADO_LIVRE, "2026-05");
    const linhaTarifa = relatorio.linhas.find((l) => l.tipo === "TARIFA_VENDA")!;

    expect(linhaTarifa.diferencaPercentual).toBeNull();
    expect(linhaTarifa.alerta).toBe(false);
  });
});

describe("gerarLancamentoAjusteConciliacao", () => {
  it("fatura maior que pedidos gera lançamento de DESPESA", async () => {
    const resultado = await gerarLancamentoAjusteConciliacao("user-1", "user-1", CanalVenda.MERCADO_LIVRE, "2026-05", {
      tipo: "TARIFA_VENDA",
      totalPedidos: 10000,
      totalFatura: 10300,
      diferenca: 300,
      diferencaPercentual: 0.03,
      alerta: true,
    });

    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0].tipo).toBe("DESPESA");
    expect(lancamentos[0].valor).toBe(300);
    expect(resultado.id).toBe(lancamentos[0].id);
  });

  it("fatura menor que pedidos gera lançamento de RECEITA", async () => {
    await gerarLancamentoAjusteConciliacao("user-1", "user-1", CanalVenda.MERCADO_LIVRE, "2026-05", {
      tipo: "TARIFA_VENDA",
      totalPedidos: 10000,
      totalFatura: 9700,
      diferenca: -300,
      diferencaPercentual: -0.03,
      alerta: true,
    });

    expect(lancamentos[0].tipo).toBe("RECEITA");
    expect(lancamentos[0].valor).toBe(300);
  });

  it("clicar duas vezes atualiza o mesmo lançamento (chaveExterna), não duplica", async () => {
    const linha = {
      tipo: "TARIFA_VENDA" as const,
      totalPedidos: 10000,
      totalFatura: 10300,
      diferenca: 300,
      diferencaPercentual: 0.03,
      alerta: true,
    };
    await gerarLancamentoAjusteConciliacao("user-1", "user-1", CanalVenda.MERCADO_LIVRE, "2026-05", linha);
    await gerarLancamentoAjusteConciliacao("user-1", "user-1", CanalVenda.MERCADO_LIVRE, "2026-05", {
      ...linha,
      diferenca: 450,
    });

    expect(lancamentos).toHaveLength(1);
    expect(lancamentos[0].valor).toBe(450);
  });

  it("garante o plano de contas antes de resolver a categoria", async () => {
    await gerarLancamentoAjusteConciliacao("user-1", "user-1", CanalVenda.MERCADO_LIVRE, "2026-05", {
      tipo: "FRETE",
      totalPedidos: 100,
      totalFatura: 200,
      diferenca: 100,
      diferencaPercentual: 1,
      alerta: true,
    });

    expect(seedPlanoContasPadraoMock).toHaveBeenCalledWith("user-1");
  });
});
