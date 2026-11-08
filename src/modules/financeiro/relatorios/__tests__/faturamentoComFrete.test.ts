import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModoFaturamento, RegimeTributario, StatusVendaCanal } from "@prisma/client";

let vendas: Array<Record<string, unknown>> = [];
let notas: Array<{ dataEmissao: Date; valorNota: number; valorFrete: number; vendaCanalId?: string }> = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    configuracaoGeral: {
      findUnique: vi.fn(async () => ({
        aliquotaImposto: 0,
        modoFaturamento: ModoFaturamento.PRODUTOS,
        regimeTributario: RegimeTributario.SIMPLES,
        usarImpostoEstimado: true,
      })),
    },
    vendaCanal: { findMany: vi.fn(async () => vendas) },
    notaFiscalVenda: {
      findMany: vi.fn(async ({ where }: { where: { vendaCanalId?: unknown } }) =>
        where.vendaCanalId ? notas.filter((n) => n.vendaCanalId).map((n) => ({ vendaCanalId: n.vendaCanalId })) : notas
      ),
    },
  },
}));

vi.mock("../cache", () => ({ comCacheFinanceiro: (_u: string, _c: string, fn: () => unknown) => fn() }));

const { calcularFaturamentoComFrete } = await import("../faturamentoComFrete");

function venda(id: string, data: string, bruto: number, freteComprador: number, freteVendedor: number, status: StatusVendaCanal = StatusVendaCanal.PAGA) {
  return {
    id,
    pedidoExternoId: id,
    dataVenda: new Date(data),
    status,
    logistica: "fulfillment",
    faturamentoBruto: bruto,
    valorEstornado: 0,
    descontoVendedor: 0,
    tarifaVenda: 0,
    freteVendedor,
    freteComprador,
    adsAtribuido: 0,
    cmv: 0,
    outrosCustos: 0,
    valorLiquidoReceber: null,
    retencaoDividas: 0,
    dataLiberacao: null,
    enriquecidoEm: new Date(),
    freteOrigem: "PAGAMENTO",
    faltando: [],
    itens: [],
  };
}

beforeEach(() => {
  vendas = [
    venda("v1", "2026-11-05T15:00:00Z", 10000, 0, 2000),
    venda("v2", "2026-11-05T18:00:00Z", 5000, 1500, 0),
    venda("v3", "2026-11-06T13:00:00Z", 8000, 0, 2500),
    venda("v4", "2026-11-06T14:00:00Z", 9000, 0, 1000, StatusVendaCanal.CANCELADA),
  ];
  notas = [
    { dataEmissao: new Date("2026-11-05T20:00:00Z"), valorNota: 12000, valorFrete: 2000, vendaCanalId: "v1" },
    { dataEmissao: new Date("2026-11-06T20:00:00Z"), valorNota: 10500, valorFrete: 2500, vendaCanalId: "v3" },
  ];
});

describe("calcularFaturamentoComFrete", () => {
  it("soma produtos + frete do comprador + frete do vendedor e ignora cancelada", async () => {
    const r = await calcularFaturamentoComFrete("conta", new Date("2026-11-05T03:00:00Z"), new Date("2026-11-07T02:59:59Z"));
    expect(r.totais.pedidos).toBe(3);
    expect(r.totais.produtos).toBe(23000);
    expect(r.totais.freteComprador).toBe(1500);
    expect(r.totais.freteVendedor).toBe(4500);
    expect(r.totais.comFrete).toBe(29000);
  });

  it("traz o valor faturado em nota e a cobertura de vendas com nota", async () => {
    const r = await calcularFaturamentoComFrete("conta", new Date("2026-11-05T03:00:00Z"), new Date("2026-11-07T02:59:59Z"));
    expect(r.totais.notasQuantidade).toBe(2);
    expect(r.totais.notasValor).toBe(22500);
    expect(r.totais.pedidosComNota).toBe(2);
    expect(r.coberturaNotas).toBeCloseTo(2 / 3);
    expect(r.temNotas).toBe(true);
  });

  it("separa por dia no fuso de São Paulo", async () => {
    const r = await calcularFaturamentoComFrete("conta", new Date("2026-11-05T03:00:00Z"), new Date("2026-11-07T02:59:59Z"));
    expect(r.dias).toHaveLength(2);
    expect(r.dias[0]).toMatchObject({ pedidos: 2, comFrete: 18500, notasValor: 12000 });
    expect(r.dias[1]).toMatchObject({ pedidos: 1, comFrete: 10500, notasValor: 10500 });
  });
});
