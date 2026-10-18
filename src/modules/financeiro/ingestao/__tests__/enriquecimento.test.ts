import { describe, it, expect, vi, beforeEach } from "vitest";

let vendas: Array<{ id: string; pedidoExternoId: string; contaCanalId: string; enriquecidoEm: Date | null; enriquecimentoTentativas: number; enriquecimentoErro: string | null; dataVenda: Date }> = [];
const ingerir = vi.fn(async (_conta: string, pedido: string) => {
  const venda = vendas.find((v) => v.pedidoExternoId === pedido)!;
  venda.enriquecidoEm = new Date();
  return { ingerido: true };
});

function pendentes() {
  return vendas
    .filter((v) => v.enriquecidoEm == null && v.enriquecimentoTentativas < 5)
    .sort((a, b) => b.dataVenda.getTime() - a.dataVenda.getTime());
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vendaCanal: {
      findMany: vi.fn(async ({ take }: { take: number }) => pendentes().slice(0, take)),
      count: vi.fn(async () => pendentes().length),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const venda = vendas.find((v) => v.id === where.id)!;
        if (data.enriquecimentoTentativas) venda.enriquecimentoTentativas += 1;
        if ("enriquecimentoErro" in data) venda.enriquecimentoErro = data.enriquecimentoErro as string;
        if ("enriquecidoEm" in data) venda.enriquecidoEm = data.enriquecidoEm as Date;
        return venda;
      }),
    },
  },
}));
vi.mock("@/lib/cache", () => ({ mlCache: { invalidatePattern: vi.fn(async () => 0) }, withUserCache: vi.fn() }));
vi.mock("../sincronizador", () => ({
  ingerirPedidoMercadoLivre: (...args: unknown[]) => ingerir(...(args as [string, string])),
  mensagemDeErro: (e: unknown) => (e instanceof Error ? e.message : "erro"),
}));

const { enriquecerVendasPendentes } = await import("../enriquecimento");

beforeEach(() => {
  vendas = Array.from({ length: 10 }, (_, i) => ({
    id: `v${i}`,
    pedidoExternoId: `P${i}`,
    contaCanalId: "conta-1",
    enriquecidoEm: null,
    enriquecimentoTentativas: 0,
    enriquecimentoErro: null,
    dataVenda: new Date(Date.UTC(2026, 9, 1 + i)),
  }));
  ingerir.mockClear();
});

describe("enriquecerVendasPendentes", () => {
  it("detalha todas as vendas pendentes, das mais recentes para as mais antigas", async () => {
    const r = await enriquecerVendasPendentes("conta-1", "user-1", 30000);
    expect(r.processados).toBe(10);
    expect(r.restantes).toBe(0);
    expect((ingerir.mock.calls[0] as unknown[])[1]).toBe("P9");
  });

  it("desiste de uma venda depois de 5 falhas, guardando o motivo, sem travar as outras", async () => {
    ingerir.mockImplementation(async (_c: string, pedido: string) => {
      if (pedido === "P3") throw new Error("Mercado Pago 403");
      vendas.find((v) => v.pedidoExternoId === pedido)!.enriquecidoEm = new Date();
      return { ingerido: true };
    });
    const r = await enriquecerVendasPendentes("conta-1", "user-1", 30000);
    const p3 = vendas.find((v) => v.pedidoExternoId === "P3")!;
    expect(p3.enriquecimentoTentativas).toBe(5);
    expect(p3.enriquecimentoErro).toContain("403");
    expect(r.restantes).toBe(0);
    expect(vendas.filter((v) => v.enriquecidoEm != null)).toHaveLength(9);
  });
});
