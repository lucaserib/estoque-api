import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatusVendaCanal } from "@prisma/client";

const txMock = { vendaCanalItem: { update: vi.fn() }, vendaCanal: { update: vi.fn() } };
const prismaMock = {
  vendaCanal: { findMany: vi.fn() },
  produto: { findUnique: vi.fn() },
  configuracaoGeral: { findUnique: vi.fn(async () => ({ aliquotaImposto: 0, custoEnvioFlex: null, diasLiberacaoPadrao: 14 })) },
  regraFreteLogistica: { findMany: vi.fn(async () => []) },
  componente: { findMany: vi.fn(async (): Promise<Array<{ kitId: string }>> => []) },
  $transaction: vi.fn(async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock)),
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
const invalidarCacheFinanceiro = vi.fn();
vi.mock("../../relatorios/cache", () => ({ invalidarCacheFinanceiro }));
vi.mock("../../canais/registro", () => ({ obterAdaptador: vi.fn() }));

const { preencherCustoDasVendasSemCusto, atualizarCustoDasVendasAposMudanca } = await import("../sincronizador");

function venda(id: string, itens: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) {
  return {
    id,
    userId: "c1",
    status: StatusVendaCanal.PAGA,
    freteVendedor: 1000,
    adsAtribuido: 0,
    faltando: ["SEM_CUSTO", "LIBERACAO_ESTIMADA"],
    itens: itens.map((item, i) => ({
      id: `${id}-i${i}`,
      anuncioExternoId: "MLB1",
      produtoId: "p1",
      quantidade: 1,
      precoUnitario: 5000,
      tarifaVenda: 600,
      descontoRateado: 0,
      custoUnitario: null,
      ...item,
    })),
    ...extra,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("preencherCustoDasVendasSemCusto", () => {
  it("preenche o custo das vendas sem custo com o custo atual do produto e tira a pendência SEM_CUSTO", async () => {
    prismaMock.vendaCanal.findMany.mockResolvedValue([venda("v1", [{ quantidade: 2 }])]);
    prismaMock.produto.findUnique.mockResolvedValue({ isKit: false, custoMedio: 1500, custoFreteManual: null, custoEmbalagem: 100 });

    const r = await preencherCustoDasVendasSemCusto({ userId: "c1", produtoIds: ["p1"] });

    expect(r).toEqual({ vendasAtualizadas: 1, itensPreenchidos: 1, restantes: false });
    expect(txMock.vendaCanalItem.update).toHaveBeenCalledWith({
      where: { id: "v1-i0" },
      data: expect.objectContaining({ custoUnitario: 1600 }),
    });
    const dados = txMock.vendaCanal.update.mock.calls[0][0].data;
    expect(dados.cmv).toBe(3200);
    expect(dados.faltando).toEqual(["LIBERACAO_ESTIMADA"]);
    expect(dados.completo).toBe(true);
    expect(invalidarCacheFinanceiro).toHaveBeenCalledWith("c1");
  });

  it("nunca sobrescreve o custo histórico de um item que já tinha custo", async () => {
    prismaMock.vendaCanal.findMany.mockResolvedValue([
      venda("v2", [{ produtoId: "p1", custoUnitario: 900 }, { produtoId: "p2", custoUnitario: null }]),
    ]);
    prismaMock.produto.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      isKit: false,
      custoMedio: where.id === "p2" ? 700 : 9999,
      custoFreteManual: null,
      custoEmbalagem: null,
    }));

    await preencherCustoDasVendasSemCusto({ userId: "c1" });

    expect(txMock.vendaCanalItem.update).toHaveBeenCalledTimes(1);
    expect(txMock.vendaCanalItem.update).toHaveBeenCalledWith({ where: { id: "v2-i1" }, data: expect.objectContaining({ custoUnitario: 700 }) });
    expect(txMock.vendaCanal.update.mock.calls[0][0].data.cmv).toBe(1600);
  });

  it("não mexe na venda quando o produto continua sem custo", async () => {
    prismaMock.vendaCanal.findMany.mockResolvedValue([venda("v3", [{}])]);
    prismaMock.produto.findUnique.mockResolvedValue({ isKit: false, custoMedio: null, custoFreteManual: null, custoEmbalagem: null });
    const r = await preencherCustoDasVendasSemCusto({ userId: "c1", produtoIds: ["p1"] });
    expect(r.vendasAtualizadas).toBe(0);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(invalidarCacheFinanceiro).not.toHaveBeenCalled();
  });

  it("custo novo de um componente também alcança as vendas dos kits que o usam", async () => {
    prismaMock.componente.findMany.mockResolvedValueOnce([{ kitId: "kit-1" }]);
    prismaMock.vendaCanal.findMany.mockResolvedValue([]);
    await preencherCustoDasVendasSemCusto({ userId: "c1", produtoIds: ["p1"] });
    const where = prismaMock.vendaCanal.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ userId: "c1", itens: { some: { custoUnitario: null, produtoId: { in: ["p1", "kit-1"] } } } });
  });

  it("processa em lotes e avisa quando sobram vendas", async () => {
    prismaMock.vendaCanal.findMany.mockResolvedValue([venda("a", [{}]), venda("b", [{}]), venda("c", [{}])]);
    prismaMock.produto.findUnique.mockResolvedValue({ isKit: false, custoMedio: 100, custoFreteManual: null, custoEmbalagem: null });
    const r = await preencherCustoDasVendasSemCusto({ userId: "c1", limite: 2 });
    expect(r).toMatchObject({ vendasAtualizadas: 2, restantes: true });
    expect(prismaMock.produto.findUnique).toHaveBeenCalledTimes(1);
  });

  it("a versão usada pelas rotas nunca derruba quem chamou", async () => {
    prismaMock.vendaCanal.findMany.mockRejectedValueOnce(new Error("banco fora"));
    const silencio = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(atualizarCustoDasVendasAposMudanca("c1", ["p1"])).resolves.toBeNull();
    expect(JSON.stringify(silencio.mock.calls)).not.toContain("banco fora");
    silencio.mockRestore();
  });
});
