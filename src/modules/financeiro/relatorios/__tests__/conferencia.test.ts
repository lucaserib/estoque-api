import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusVendaCanal } from "@prisma/client";
import type { MLOrder } from "@/types/mercadolivre";

function pedidoMl(parcial: Partial<MLOrder> = {}): MLOrder {
  return {
    id: "1000001",
    status: "paid",
    date_created: "2026-05-10T14:00:00.000-04:00",
    date_closed: "2026-05-10T14:05:00.000-04:00",
    last_updated: "2026-05-10T14:05:00.000-04:00",
    order_items: [
      {
        item: { id: "MLB1", title: "Produto", seller_sku: "SKU-1" },
        quantity: 1,
        unit_price: 100,
        sale_fee: 10,
      },
    ],
    buyer: {},
    seller: {},
    currency_id: "BRL",
    shipping: { id: 555 },
    total_amount: 100,
    paid_amount: 100,
    payments: [{ id: 1, status: "approved", transaction_amount: 100 }],
    ...parcial,
  };
}

let pedidosMlRetornados: MLOrder[] = [];
const listarPedidosCriadosNoPeriodoMock = vi.fn(async (..._args: unknown[]) => pedidosMlRetornados);
vi.mock("../../canais/mercadoLivre/cliente", () => ({
  listarPedidosCriadosNoPeriodo: (...args: unknown[]) => listarPedidosCriadosNoPeriodoMock(...args),
}));

let vendas: Array<{
  pedidoExternoId: string;
  status: StatusVendaCanal;
  faturamentoBruto: number;
  tarifaVenda: number;
  itens: Array<{ quantidade: number }>;
}> = [];
const ingerirPedidoMercadoLivreMock = vi.fn(async (..._args: unknown[]) => ({ ingerido: true }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vendaCanal: {
      findMany: vi.fn(
        async ({ where }: { where: { pedidoExternoId: { in: string[] } } }) =>
          vendas.filter((v) => where.pedidoExternoId.in.includes(v.pedidoExternoId))
      ),
    },
  },
}));

vi.mock("../../ingestao/sincronizador", () => ({
  ingerirPedidoMercadoLivre: (...args: unknown[]) => ingerirPedidoMercadoLivreMock(...args),
}));

const { conferirMes, importarFaltantes, reprocessarDivergentes } = await import("../conferencia");

beforeEach(() => {
  pedidosMlRetornados = [];
  vendas = [];
  listarPedidosCriadosNoPeriodoMock.mockClear();
  ingerirPedidoMercadoLivreMock.mockClear();
});

describe("conferirMes", () => {
  it("mês sintético: 5 pedidos no ML, 2 faltando no app e 1 com faturamento divergente", async () => {
    pedidosMlRetornados = [
      pedidoMl({ id: "1" }),
      pedidoMl({ id: "2" }),
      pedidoMl({ id: "3" }),
      pedidoMl({ id: "4" }),
      pedidoMl({ id: "5" }),
    ];
    vendas = [
      { pedidoExternoId: "1", status: StatusVendaCanal.PAGA, faturamentoBruto: 10000, tarifaVenda: 1000, itens: [{ quantidade: 1 }] },
      { pedidoExternoId: "2", status: StatusVendaCanal.PAGA, faturamentoBruto: 10000, tarifaVenda: 1000, itens: [{ quantidade: 1 }] },
      { pedidoExternoId: "3", status: StatusVendaCanal.PAGA, faturamentoBruto: 5000, tarifaVenda: 1000, itens: [{ quantidade: 1 }] },
    ];

    const resultado = await conferirMes("user-1", "conta-1", { ano: 2026, mes: 5 });

    expect(resultado.totalMl.pedidos).toBe(5);
    expect(resultado.totalMl.faturamento).toBe(50000);
    expect(resultado.faltando.sort()).toEqual(["4", "5"]);
    expect(resultado.coberturaPercentual).toBe(60);
    expect(resultado.divergentes).toEqual([
      { pedidoExternoId: "3", campo: "faturamento", valorMl: 10000, valorApp: 5000 },
    ]);
  });

  it("sem pedidos no ML: cobertura 100%, nada faltando", async () => {
    pedidosMlRetornados = [];

    const resultado = await conferirMes("user-1", "conta-1", { ano: 2026, mes: 5 });

    expect(resultado.coberturaPercentual).toBe(100);
    expect(resultado.faltando).toEqual([]);
  });

  it("pedido cancelado sem pagamento aprovado não entra na conferência (ainda não existia financeiramente)", async () => {
    pedidosMlRetornados = [
      pedidoMl({ id: "1", status: "cancelled", paid_amount: undefined, payments: [] }),
    ];

    const resultado = await conferirMes("user-1", "conta-1", { ano: 2026, mes: 5 });

    expect(resultado.totalMl.pedidos).toBe(0);
    expect(resultado.faltando).toEqual([]);
  });
});

describe("importarFaltantes", () => {
  it("chama ingerirPedidoMercadoLivre para cada pedido e conta sucesso/erro", async () => {
    ingerirPedidoMercadoLivreMock
      .mockResolvedValueOnce({ ingerido: true })
      .mockRejectedValueOnce(new Error("falha"));

    const resultado = await importarFaltantes("conta-1", ["1", "2"]);

    expect(resultado.importados).toBe(1);
    expect(resultado.erros).toBe(1);
  });
});

describe("reprocessarDivergentes", () => {
  it("reprocessa cada pedido divergente uma única vez (sem duplicar ids repetidos)", async () => {
    await reprocessarDivergentes("conta-1", ["1", "1", "2"]);

    expect(ingerirPedidoMercadoLivreMock).toHaveBeenCalledTimes(2);
  });
});
