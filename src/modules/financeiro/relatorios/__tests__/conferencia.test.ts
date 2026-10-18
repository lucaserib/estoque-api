import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MLOrder } from "@/types/mercadolivre";
import { criarBancoFalso } from "../../__tests__/bancoFalso";

const banco = criarBancoFalso();
vi.mock("@/lib/prisma", () => ({ prisma: banco.prisma }));

let pedidosMl: MLOrder[] = [];
vi.mock("../../canais/mercadoLivre/cliente", () => ({
  listarPedidosCriadosNoPeriodo: vi.fn(async () => pedidosMl),
}));

const { mapearPedido } = await import("../../canais/mercadoLivre/mapeador");
const loteMock = vi.fn(async (_c: unknown, pedidos: MLOrder[]) => {
  for (const bruto of pedidos) {
    const n = mapearPedido(bruto, null)!;
    const existente = banco.dados.vendas.find((v) => v.pedidoExternoId === n.pedidoExternoId);
    const dados = {
      pedidoExternoId: n.pedidoExternoId,
      dataVenda: n.dataVenda,
      status: n.status,
      faturamentoBruto: n.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0),
      tarifaVenda: n.itens.reduce((s, i) => s + (i.tarifaTotal ?? 0), 0),
      enriquecidoEm: null,
      itens: n.itens.map((i) => ({ quantidade: i.quantidade, tarifaVenda: i.tarifaTotal })),
    };
    if (existente) Object.assign(existente, dados);
    else banco.dados.vendas.push(banco.venda(dados));
  }
  return { recebidos: pedidos.length, gravados: pedidos.length, semMudanca: 0, naoRelevantes: 0, erros: 0 };
});
vi.mock("../../ingestao/lote", () => ({ ingerirPedidosEmLote: (...a: unknown[]) => loteMock(...(a as [unknown, MLOrder[]])) }));
vi.mock("../../ingestao/sincronizador", () => ({ obterUserIdDaConta: vi.fn(async () => "user-1") }));

const { conferirMes, corrigirMes } = await import("../conferencia");

function pedidoMl(id: string, parcial: Partial<MLOrder> = {}): MLOrder {
  return {
    id,
    status: "paid",
    date_created: "2026-10-10T14:00:00.000-03:00",
    last_updated: "2026-10-10T14:05:00.000-03:00",
    order_items: [{ item: { id: "MLB1", title: "Produto" }, quantity: 1, unit_price: 34.7, sale_fee: 2.99 }],
    buyer: {},
    seller: {},
    currency_id: "BRL",
    shipping: { id: 555 },
    total_amount: 34.7,
    paid_amount: 34.7,
    payments: [{ id: 1, status: "approved", transaction_amount: 34.7 }],
    ...parcial,
  };
}

beforeEach(() => {
  banco.dados.vendas = [];
  pedidosMl = [];
  loteMock.mockClear();
});

describe("conferirMes", () => {
  it("compara pedidos, unidades, faturamento e cancelados com o Mercado Livre", async () => {
    pedidosMl = [
      pedidoMl("1"),
      pedidoMl("2"),
      pedidoMl("3", { status: "cancelled" }),
    ];
    banco.dados.vendas.push(
      banco.venda({ pedidoExternoId: "1", dataVenda: new Date("2026-10-10T17:00:00.000Z"), faturamentoBruto: 3470, tarifaVenda: 299, itens: [{ quantidade: 1 }] })
    );

    const r = await conferirMes("user-1", "conta-1", { ano: 2026, mes: 10 });

    expect(r.totalMl.pedidosValidos).toBe(2);
    expect(r.totalMl.faturamento).toBe(6940);
    expect(r.totalMl.cancelados).toBe(1);
    expect(r.totalApp.pedidosValidos).toBe(1);
    expect(r.faltando).toEqual(["2", "3"]);
    expect(r.confere).toBe(false);
    expect(r.coberturaPercentual).toBeCloseTo(33.3, 1);
  });

  it("aponta divergência de data quando a venda ficou gravada com outra data (ex.: data de fechamento)", async () => {
    pedidosMl = [pedidoMl("1")];
    banco.dados.vendas.push(
      banco.venda({ pedidoExternoId: "1", dataVenda: new Date("2026-10-10T17:05:00.000Z"), faturamentoBruto: 3470, tarifaVenda: 299, itens: [{ quantidade: 1 }] })
    );
    const r = await conferirMes("user-1", "conta-1", { ano: 2026, mes: 10 });
    expect(r.divergentes.map((d) => d.campo)).toEqual(["data"]);
  });
});

describe("corrigirMes", () => {
  it("grava de uma vez o que falta e o que diverge, e o mês passa a bater", async () => {
    pedidosMl = [pedidoMl("1"), pedidoMl("2"), pedidoMl("3", { status: "cancelled" })];
    banco.dados.vendas.push(
      banco.venda({ pedidoExternoId: "1", dataVenda: new Date("2026-10-10T17:00:00.000Z"), faturamentoBruto: 1000, tarifaVenda: 299, itens: [{ quantidade: 1 }] })
    );

    const r = await corrigirMes("conta-1", { ano: 2026, mes: 10 });

    expect(loteMock).toHaveBeenCalledTimes(1);
    expect((loteMock.mock.calls[0][1] as MLOrder[]).map((p) => p.id).sort()).toEqual(["1", "2", "3"]);
    expect(r.antes.confere).toBe(false);
    expect(r.depois.confere).toBe(true);
    expect(r.depois.totalApp.faturamento).toBe(r.depois.totalMl.faturamento);
  });
});
