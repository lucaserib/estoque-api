import { describe, it, expect, vi, beforeEach } from "vitest";
import { CanalVenda, StatusVendaCanal } from "@prisma/client";

interface FakeVenda {
  userId: string;
  canal: CanalVenda;
  dataVenda: Date;
  status: StatusVendaCanal;
  logistica: string | null;
  faturamentoBruto: number;
  freteVendedor: number | null;
  margemContribuicao: number | null;
}

let vendas: FakeVenda[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vendaCanal: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; dataVenda: { gte: Date; lte: Date }; status: { in: string[] }; canal?: CanalVenda };
        }) =>
          vendas.filter(
            (v) =>
              v.userId === where.userId &&
              v.dataVenda >= where.dataVenda.gte &&
              v.dataVenda <= where.dataVenda.lte &&
              where.status.in.includes(v.status) &&
              (!where.canal || v.canal === where.canal)
          )
      ),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  withUserCache: vi.fn(async (_userId: string, _key: string, fetcher: () => Promise<unknown>) => fetcher()),
  mlCache: { invalidatePattern: vi.fn(async () => 0) },
}));

const { calcularResumoPorLogistica } = await import("../porLogistica");

beforeEach(() => {
  vendas = [];
});

function venda(parcial: Partial<FakeVenda>): FakeVenda {
  return {
    userId: "user-1",
    canal: CanalVenda.MERCADO_LIVRE,
    dataVenda: new Date("2026-05-10T12:00:00.000Z"),
    status: StatusVendaCanal.PAGA,
    logistica: "fulfillment",
    faturamentoBruto: 0,
    freteVendedor: null,
    margemContribuicao: null,
    ...parcial,
  };
}

describe("calcularResumoPorLogistica", () => {
  it("agrupa por logística, somando pedidos/faturamento/MC e calculando frete médio", async () => {
    vendas.push(
      venda({ logistica: "fulfillment", faturamentoBruto: 10000, freteVendedor: 500, margemContribuicao: 3000 }),
      venda({ logistica: "fulfillment", faturamentoBruto: 20000, freteVendedor: 700, margemContribuicao: 6000 }),
      venda({ logistica: "self_service", faturamentoBruto: 5000, freteVendedor: 300, margemContribuicao: 1000 })
    );

    const resultado = await calcularResumoPorLogistica(
      "user-1",
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-31T23:59:59.000Z")
    );

    const full = resultado.find((r) => r.logistica === "fulfillment");
    expect(full).toEqual({ logistica: "fulfillment", pedidos: 2, faturamentoBruto: 30000, freteMedio: 600, margemContribuicao: 9000 });

    const flex = resultado.find((r) => r.logistica === "self_service");
    expect(flex).toEqual({ logistica: "self_service", pedidos: 1, faturamentoBruto: 5000, freteMedio: 300, margemContribuicao: 1000 });
  });

  it("vendas canceladas/devolvidas totalmente não entram no agrupamento", async () => {
    vendas.push(
      venda({ status: StatusVendaCanal.CANCELADA, faturamentoBruto: 50000 }),
      venda({ status: StatusVendaCanal.DEVOLVIDA, faturamentoBruto: 50000 }),
      venda({ status: StatusVendaCanal.PAGA, faturamentoBruto: 1000 })
    );

    const resultado = await calcularResumoPorLogistica(
      "user-1",
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-31T23:59:59.000Z")
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0].faturamentoBruto).toBe(1000);
  });

  it("frete desconhecido em todas as vendas do grupo: freteMedio é null, nunca zero inventado", async () => {
    vendas.push(venda({ logistica: "drop_off", faturamentoBruto: 1000, freteVendedor: null }));

    const resultado = await calcularResumoPorLogistica(
      "user-1",
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-31T23:59:59.000Z")
    );

    expect(resultado[0].freteMedio).toBeNull();
  });

  it("logistica null vira o grupo DESCONHECIDA, sem descartar a venda", async () => {
    vendas.push(venda({ logistica: null, faturamentoBruto: 1000 }));

    const resultado = await calcularResumoPorLogistica(
      "user-1",
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-05-31T23:59:59.000Z")
    );

    expect(resultado[0].logistica).toBe("DESCONHECIDA");
    expect(resultado[0].faturamentoBruto).toBe(1000);
  });
});
