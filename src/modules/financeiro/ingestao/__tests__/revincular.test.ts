import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusVendaCanal } from "@prisma/client";

const txMock = { vendaCanalItem: { update: vi.fn() }, vendaCanal: { update: vi.fn() } };
const prismaMock = {
  vendaCanal: { findMany: vi.fn() },
  produto: { findUnique: vi.fn() },
  configuracaoGeral: { findUnique: vi.fn(async () => ({ aliquotaImposto: 0, custoEnvioFlex: null, diasLiberacaoPadrao: 14 })) },
  regraFreteLogistica: { findMany: vi.fn(async () => []) },
  componente: { findMany: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../../relatorios/cache", () => ({ invalidarCacheFinanceiro: vi.fn() }));
vi.mock("../../canais/registro", () => ({ obterAdaptador: vi.fn() }));

function venda(itemExtra: Record<string, unknown> = {}) {
  return {
    id: "v1",
    userId: "c1",
    status: StatusVendaCanal.PAGA,
    freteVendedor: 1000,
    adsAtribuido: 0,
    faltando: ["SEM_VINCULO", "LIBERACAO_ESTIMADA"],
    itens: [
      {
        id: "i1",
        anuncioExternoId: "MLB-KIT",
        produtoId: "adp",
        quantidade: 1,
        precoUnitario: 5000,
        tarifaVenda: 600,
        descontoRateado: 0,
        custoUnitario: 1200,
        ...itemExtra,
      },
    ],
  };
}

describe("revincularVendasDoAnuncio", () => {
  beforeEach(() => vi.clearAllMocks());

  it("venda antiga do 'kit com 2' passa a custar 2 unidades e perde a pendência de vínculo", async () => {
    prismaMock.vendaCanal.findMany.mockResolvedValue([venda()]);
    // kit de 2 adaptadores a R$ 12,00 cada
    prismaMock.produto.findUnique.mockResolvedValue({ isKit: true, custoMedio: null, custoFreteManual: null, custoEmbalagem: null });
    prismaMock.componente.findMany.mockResolvedValue([{ quantidade: 2, produto: { custoMedio: 1200 } }]);
    const { revincularVendasDoAnuncio } = await import("../sincronizador");

    const n = await revincularVendasDoAnuncio({ userId: "c1", contaCanalId: "ml", anuncioExternoId: "MLB-KIT", produtoId: "kit-2" });

    expect(n).toBe(1);
    expect(txMock.vendaCanalItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: expect.objectContaining({ produtoId: "kit-2", custoUnitario: 2400 }),
    });
    const dadosVenda = txMock.vendaCanal.update.mock.calls[0][0].data;
    expect(dadosVenda.cmv).toBe(2400);
    // 5000 - 600 tarifa - 1000 frete - 2400 custo
    expect(dadosVenda.margemContribuicao).toBe(1000);
    expect(dadosVenda.faltando).toEqual(["LIBERACAO_ESTIMADA"]);
    expect(dadosVenda.completo).toBe(true);
  });

  it("mesmo produto (só confirmando o vínculo) mantém o custo histórico da venda", async () => {
    prismaMock.vendaCanal.findMany.mockResolvedValue([venda({ produtoId: "adp", custoUnitario: 900 })]);
    prismaMock.produto.findUnique.mockResolvedValue({ isKit: false, custoMedio: 1500, custoFreteManual: null, custoEmbalagem: null });
    const { revincularVendasDoAnuncio } = await import("../sincronizador");

    await revincularVendasDoAnuncio({ userId: "c1", contaCanalId: "ml", anuncioExternoId: "MLB-KIT", produtoId: "adp" });

    expect(txMock.vendaCanalItem.update.mock.calls[0][0].data.custoUnitario).toBe(900);
  });

  it("desvincular deixa a venda sem custo e marcada sem vínculo", async () => {
    prismaMock.vendaCanal.findMany.mockResolvedValue([venda()]);
    const { revincularVendasDoAnuncio } = await import("../sincronizador");

    await revincularVendasDoAnuncio({ userId: "c1", contaCanalId: "ml", anuncioExternoId: "MLB-KIT", produtoId: null });

    const dadosVenda = txMock.vendaCanal.update.mock.calls[0][0].data;
    expect(dadosVenda.cmv).toBeNull();
    expect(dadosVenda.completo).toBe(false);
    expect(dadosVenda.faltando).toEqual(expect.arrayContaining(["SEM_CUSTO", "SEM_VINCULO", "LIBERACAO_ESTIMADA"]));
  });

  it("anúncio sem vendas não faz nada", async () => {
    prismaMock.vendaCanal.findMany.mockResolvedValue([]);
    const { revincularVendasDoAnuncio } = await import("../sincronizador");
    expect(
      await revincularVendasDoAnuncio({ userId: "c1", contaCanalId: "ml", anuncioExternoId: "X", produtoId: "adp" })
    ).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
