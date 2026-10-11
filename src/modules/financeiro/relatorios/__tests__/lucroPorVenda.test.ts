import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeVenda {
  id: string;
  userId: string;
  canal: string;
  status: string;
  completo: boolean;
  margemContribuicao: number | null;
  logistica: string | null;
  dataVenda: Date;
  itens: Array<{ produtoId: string | null }>;
}

let vendas: FakeVenda[] = [];

function aplicaFiltros(v: FakeVenda, where: Record<string, unknown>): boolean {
  if (v.userId !== where.userId) return false;
  if (where.canal && v.canal !== where.canal) return false;
  if (where.status && v.status !== where.status) return false;
  if (where.completo === false && v.completo !== false) return false;
  if (where.logistica && v.logistica !== where.logistica) return false;
  const margemFiltro = where.margemContribuicao as { lt: number } | undefined;
  if (margemFiltro && !(v.margemContribuicao != null && v.margemContribuicao < margemFiltro.lt)) return false;
  const itensFiltro = where.itens as { some: { produtoId: string } } | undefined;
  if (itensFiltro && !v.itens.some((i) => i.produtoId === itensFiltro.some.produtoId)) return false;
  return true;
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vendaCanal: {
      findMany: vi.fn(async ({ where, skip, take }: { where: Record<string, unknown>; skip: number; take: number }) => {
        const filtradas = vendas.filter((v) => aplicaFiltros(v, where));
        return filtradas.slice(skip, skip + take);
      }),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => vendas.filter((v) => aplicaFiltros(v, where)).length),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string } }) =>
          vendas.find((v) => v.id === where.id && v.userId === where.userId) ?? null
      ),
    },
  },
}));

const { listarVendasComLucro, obterDetalheVenda, VendaNaoEncontradaError } = await import("../lucroPorVenda");

function venda(parcial: Partial<FakeVenda> = {}): FakeVenda {
  return {
    id: `venda-${Math.random()}`, userId: "user-1", canal: "MERCADO_LIVRE", status: "PAGA",
    completo: true, margemContribuicao: 1000, logistica: "drop_off", dataVenda: new Date("2026-05-10"),
    itens: [],
    ...parcial,
  };
}

beforeEach(() => {
  vendas = [];
});

describe("listarVendasComLucro", () => {
  it("pagina os resultados", async () => {
    for (let i = 0; i < 5; i++) vendas.push(venda({ id: `v${i}` }));

    const resultado = await listarVendasComLucro("user-1", { porPagina: 2, pagina: 1 });

    expect(resultado.vendas).toHaveLength(2);
    expect(resultado.total).toBe(5);
  });

  it("soPrejuizo filtra só margemContribuicao negativa", async () => {
    vendas.push(venda({ id: "lucro", margemContribuicao: 500 }));
    vendas.push(venda({ id: "prejuizo", margemContribuicao: -200 }));

    const resultado = await listarVendasComLucro("user-1", { soPrejuizo: true });

    expect(resultado.vendas.map((v) => v.id)).toEqual(["prejuizo"]);
  });

  it("soIncompletas filtra completo=false", async () => {
    vendas.push(venda({ id: "completa", completo: true }));
    vendas.push(venda({ id: "incompleta", completo: false }));

    const resultado = await listarVendasComLucro("user-1", { soIncompletas: true });

    expect(resultado.vendas.map((v) => v.id)).toEqual(["incompleta"]);
  });

  it("filtra por produtoId entre os itens da venda", async () => {
    vendas.push(venda({ id: "com-produto", itens: [{ produtoId: "produto-1" }] }));
    vendas.push(venda({ id: "sem-produto", itens: [{ produtoId: "produto-2" }] }));

    const resultado = await listarVendasComLucro("user-1", { produtoId: "produto-1" });

    expect(resultado.vendas.map((v) => v.id)).toEqual(["com-produto"]);
  });

  it("limita porPagina ao máximo de 100", async () => {
    const resultado = await listarVendasComLucro("user-1", { porPagina: 500 });
    expect(resultado.porPagina).toBe(100);
  });
});

describe("obterDetalheVenda", () => {
  it("lança VendaNaoEncontradaError para venda de outra conta", async () => {
    vendas.push(venda({ id: "v1", userId: "outra-conta" }));

    await expect(obterDetalheVenda("user-1", "v1")).rejects.toThrow(VendaNaoEncontradaError);
  });

  it("devolve a venda da própria conta", async () => {
    vendas.push(venda({ id: "v1", userId: "user-1" }));

    const resultado = await obterDetalheVenda("user-1", "v1");
    expect(resultado.id).toBe("v1");
  });
});
