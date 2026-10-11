import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeItem {
  produtoId: string | null;
  quantidade: number;
  precoUnitario: number;
  descontoRateado: number;
  tarifaVenda: number;
  freteRateado: number | null;
  adsRateado: number;
  impostoRateado: number;
  custoUnitario: number | null;
  margemContribuicao: number | null;
  vendaUserId: string;
  vendaDataVenda: Date;
  vendaCanal: string;
}
interface FakeProduto {
  id: string;
  nome: string;
  sku: string;
}
interface FakeLancamento {
  userId: string;
  tipo: string;
  valor: number;
  competencia: Date;
  categoriaGrupoDre: string;
}

let itens: FakeItem[] = [];
let produtos: FakeProduto[] = [];
let lancamentos: FakeLancamento[] = [];
let rateioCustoFixo = "FATURAMENTO";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    vendaCanalItem: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            produtoId: { not?: null; in?: string[] };
            venda: { userId: string; dataVenda: { gte: Date; lte: Date }; canal?: string };
          };
        }) =>
          itens
            .filter((i) => {
              if (where.produtoId.in && !where.produtoId.in.includes(i.produtoId ?? "")) return false;
              if (where.produtoId.not === null && i.produtoId === null) return false;
              if (i.vendaUserId !== where.venda.userId) return false;
              if (i.vendaDataVenda < where.venda.dataVenda.gte || i.vendaDataVenda > where.venda.dataVenda.lte) return false;
              if (where.venda.canal && i.vendaCanal !== where.venda.canal) return false;
              return true;
            })
            .map((i) => ({
              produtoId: i.produtoId, quantidade: i.quantidade, precoUnitario: i.precoUnitario,
              descontoRateado: i.descontoRateado, tarifaVenda: i.tarifaVenda, freteRateado: i.freteRateado,
              adsRateado: i.adsRateado, impostoRateado: i.impostoRateado, custoUnitario: i.custoUnitario,
              margemContribuicao: i.margemContribuicao,
            }))
      ),
    },
    configuracaoGeral: {
      findUnique: vi.fn(async () => ({ rateioCustoFixo })),
    },
    produto: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        produtos.filter((p) => where.id.in.includes(p.id))
      ),
    },
    lancamentoFinanceiro: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; competencia: { gte: Date; lte: Date }; categoria: { grupoDre: string } };
        }) =>
          lancamentos.filter(
            (l) =>
              l.userId === where.userId &&
              l.competencia >= where.competencia.gte &&
              l.competencia <= where.competencia.lte &&
              l.categoriaGrupoDre === where.categoria.grupoDre
          )
      ),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  withUserCache: vi.fn(async (_userId: string, _key: string, fetcher: () => Promise<unknown>) => fetcher()),
  mlCache: { invalidatePattern: vi.fn(async () => 0) },
}));

const { gerarLucroPorProduto } = await import("../lucroPorProduto");

function item(parcial: Partial<FakeItem> = {}): FakeItem {
  return {
    produtoId: "produto-1", quantidade: 1, precoUnitario: 10000, descontoRateado: 0,
    tarifaVenda: 1000, freteRateado: 500, adsRateado: 0, impostoRateado: 0, custoUnitario: 3000,
    margemContribuicao: 5500, vendaUserId: "user-1", vendaDataVenda: new Date("2026-05-10"),
    vendaCanal: "MERCADO_LIVRE",
    ...parcial,
  };
}

const PERIODO = { desde: new Date("2026-05-01"), ate: new Date("2026-05-31") };

beforeEach(() => {
  itens = [];
  produtos = [{ id: "produto-1", nome: "Produto 1", sku: "SKU-1" }, { id: "produto-2", nome: "Produto 2", sku: "SKU-2" }];
  lancamentos = [];
  rateioCustoFixo = "FATURAMENTO";
});

describe("gerarLucroPorProduto", () => {
  it("agrega quantidade e faturamento multiplicando por item, não soma crua", async () => {
    itens.push(item({ produtoId: "produto-1", quantidade: 2, precoUnitario: 10000, custoUnitario: 3000 }));

    const linhas = await gerarLucroPorProduto("user-1", PERIODO);
    const linha = linhas.find((l) => l.produtoId === "produto-1")!;

    expect(linha.unidades).toBe(2);
    expect(linha.faturamentoBruto).toBe(20000);
    expect(linha.cmv).toBe(6000); // 3000 * 2
  });

  it("soma itens do mesmo produto em vendas diferentes", async () => {
    itens.push(item({ produtoId: "produto-1", quantidade: 1, precoUnitario: 10000 }));
    itens.push(item({ produtoId: "produto-1", quantidade: 1, precoUnitario: 20000 }));

    const linhas = await gerarLucroPorProduto("user-1", PERIODO);

    expect(linhas.find((l) => l.produtoId === "produto-1")!.faturamentoBruto).toBe(30000);
  });

  it("itens sem vínculo (produtoId null) não entram no relatório", async () => {
    itens.push(item({ produtoId: null }));

    const linhas = await gerarLucroPorProduto("user-1", PERIODO);

    expect(linhas).toHaveLength(0);
  });

  it("rateia custo fixo proporcional ao faturamento por padrão", async () => {
    itens.push(item({ produtoId: "produto-1", precoUnitario: 10000, quantidade: 1 }));
    itens.push(item({ produtoId: "produto-2", precoUnitario: 30000, quantidade: 1 }));
    lancamentos.push({ userId: "user-1", tipo: "DESPESA", valor: 400, competencia: new Date("2026-05-15"), categoriaGrupoDre: "DESPESA_OPERACIONAL" });

    const linhas = await gerarLucroPorProduto("user-1", PERIODO);

    const p1 = linhas.find((l) => l.produtoId === "produto-1")!;
    const p2 = linhas.find((l) => l.produtoId === "produto-2")!;
    expect(p1.custoFixoRateado).toBe(100); // 1/4 do faturamento
    expect(p2.custoFixoRateado).toBe(300); // 3/4 do faturamento
  });

  it("rateio por unidade usa unidadesVendidas quando configurado", async () => {
    rateioCustoFixo = "UNIDADE";
    itens.push(item({ produtoId: "produto-1", quantidade: 1, precoUnitario: 10000 }));
    itens.push(item({ produtoId: "produto-2", quantidade: 3, precoUnitario: 10000 }));
    lancamentos.push({ userId: "user-1", tipo: "DESPESA", valor: 400, competencia: new Date("2026-05-15"), categoriaGrupoDre: "DESPESA_OPERACIONAL" });

    const linhas = await gerarLucroPorProduto("user-1", PERIODO);

    expect(linhas.find((l) => l.produtoId === "produto-1")!.custoFixoRateado).toBe(100); // 1/4 das unidades
    expect(linhas.find((l) => l.produtoId === "produto-2")!.custoFixoRateado).toBe(300); // 3/4 das unidades
  });

  it("curva ABC: produto com margem negativa nunca é A ou B", async () => {
    itens.push(item({ produtoId: "produto-1", margemContribuicao: 10000 }));
    itens.push(item({ produtoId: "produto-2", margemContribuicao: -500 }));

    const linhas = await gerarLucroPorProduto("user-1", PERIODO);

    expect(linhas.find((l) => l.produtoId === "produto-1")!.curvaAbc).toBe("A");
    expect(linhas.find((l) => l.produtoId === "produto-2")!.curvaAbc).toBe("C");
  });

  it("curva ABC: 10 produtos com margem igual — os 8 primeiros (80%) ficam em A, os 2 últimos em B", async () => {
    produtos = Array.from({ length: 10 }, (_, i) => ({ id: `produto-${i}`, nome: `Produto ${i}`, sku: `SKU-${i}` }));
    for (let i = 0; i < 10; i++) {
      itens.push(item({ produtoId: `produto-${i}`, margemContribuicao: 10 }));
    }

    const linhas = await gerarLucroPorProduto("user-1", PERIODO);
    const porId = new Map(linhas.map((l) => [l.produtoId, l.curvaAbc]));

    const classificacoes = Array.from({ length: 10 }, (_, i) => porId.get(`produto-${i}`));
    expect(classificacoes.filter((c) => c === "A")).toHaveLength(8);
    expect(classificacoes.filter((c) => c === "B")).toHaveLength(2);
  });

  it("ordena pelo campo pedido, decrescente por padrão", async () => {
    itens.push(item({ produtoId: "produto-1", margemContribuicao: 1000 }));
    itens.push(item({ produtoId: "produto-2", margemContribuicao: 5000 }));

    const linhas = await gerarLucroPorProduto("user-1", PERIODO);

    expect(linhas.map((l) => l.produtoId)).toEqual(["produto-2", "produto-1"]);
  });

  it("sem itens no período devolve lista vazia", async () => {
    const linhas = await gerarLucroPorProduto("user-1", PERIODO);
    expect(linhas).toEqual([]);
  });
});
