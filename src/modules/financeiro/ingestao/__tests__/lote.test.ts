import { describe, it, expect, vi, beforeEach } from "vitest";

let existentes: Array<Record<string, unknown>> = [];
const persistir = vi.fn(async () => undefined);
const registrarErro = vi.fn(async () => undefined);

vi.mock("@/lib/prisma", () => ({
  prisma: { vendaCanal: { findMany: vi.fn(async () => existentes) } },
}));
vi.mock("@/lib/cache", () => ({ mlCache: { invalidatePattern: vi.fn(async () => 0) }, withUserCache: vi.fn() }));
vi.mock("../../canais/registro", () => ({ obterAdaptador: () => ({ canal: "MERCADO_LIVRE" }) }));
vi.mock("../sincronizador", () => ({
  persistirVendaNormalizada: (...args: unknown[]) => persistir(...(args as [])),
  obterConfigIngestao: vi.fn(async () => ({ aliquotaImposto: 0, custoEnvioFlex: null, diasLiberacaoPadrao: 14, regrasFreteLogistica: new Map() })),
  registrarErroPedido: (...args: unknown[]) => registrarErro(...(args as [])),
  resolverErroPedido: vi.fn(async () => undefined),
  mensagemDeErro: (e: unknown) => (e instanceof Error ? e.message : "erro"),
}));

const { ingerirPedidosEmLote } = await import("../lote");

function pedido(id: number, parcial: Record<string, unknown> = {}) {
  return {
    id,
    status: "paid",
    date_created: "2026-10-18T12:01:27.000-04:00",
    last_updated: "2026-10-18T12:05:00.000-04:00",
    total_amount: 34.7,
    paid_amount: 34.7,
    order_items: [{ item: { id: "MLB1", title: "Kit" }, quantity: 1, unit_price: 34.7, sale_fee: 2.99 }],
    payments: [{ id: 1, status: "approved", transaction_amount: 34.7 }],
    shipping: { id: 99 },
    buyer: {},
    seller: {},
    currency_id: "BRL",
    ...parcial,
  };
}

beforeEach(() => {
  existentes = [];
  persistir.mockClear();
  registrarErro.mockClear();
});

describe("ingerirPedidosEmLote", () => {
  it("grava os pedidos relevantes e ignora os que ainda não são venda", async () => {
    const r = await ingerirPedidosEmLote({ contaCanalId: "conta-1", userId: "user-1" }, [
      pedido(1),
      pedido(2, { status: "payment_required" }),
    ] as never);
    expect(r.gravados).toBe(1);
    expect(r.naoRelevantes).toBe(1);
    expect(persistir).toHaveBeenCalledTimes(1);
    expect((persistir.mock.calls[0] as unknown[])[3]).toMatchObject({ modo: "RAPIDO" });
  });

  it("pula o pedido que não mudou desde a última gravação, a menos que 'forcar'", async () => {
    existentes = [
      { pedidoExternoId: "1", atualizadoNoCanalEm: new Date("2026-10-18T16:05:00.000Z"), status: "PAGA", itens: [] },
    ];
    const semForcar = await ingerirPedidosEmLote({ contaCanalId: "conta-1", userId: "user-1" }, [pedido(1)] as never);
    expect(semForcar.semMudanca).toBe(1);
    expect(persistir).not.toHaveBeenCalled();

    const comForcar = await ingerirPedidosEmLote({ contaCanalId: "conta-1", userId: "user-1" }, [pedido(1)] as never, {
      forcar: true,
    });
    expect(comForcar.gravados).toBe(1);
  });

  it("erro em um pedido é registrado e não interrompe os demais", async () => {
    persistir.mockRejectedValueOnce(new Error("falhou"));
    const r = await ingerirPedidosEmLote({ contaCanalId: "conta-1", userId: "user-1" }, [pedido(1), pedido(2)] as never, {
      concorrencia: 1,
    });
    expect(r.erros).toBe(1);
    expect(r.gravados).toBe(1);
    expect(registrarErro).toHaveBeenCalledTimes(1);
  });
});
