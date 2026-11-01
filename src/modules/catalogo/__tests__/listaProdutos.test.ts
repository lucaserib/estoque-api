import { describe, it, expect, vi, beforeEach } from "vitest";

const prismaMock = {
  produto: { findMany: vi.fn() },
  vendaCanalItem: { groupBy: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/cache", () => ({
  withCache: (_k: string, fn: () => unknown) => fn(),
  createCacheKey: (...p: string[]) => p.join(":"),
}));
vi.mock("@/services/pendenciasService", () => ({
  calcularTodasPendencias: vi.fn(async () => [
    { produtoId: "parado", pendencias: [{ codigo: "SEM_CUSTO", severidade: "critica", mensagem: "", acao: "" }] },
  ]),
}));

function produto(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    nome: id,
    sku: id.toUpperCase(),
    ean: null,
    isKit: false,
    ativo: true,
    custoMedio: 1000,
    imagemUrl: null,
    estoques: [],
    fornecedores: [],
    ProdutoMercadoLivre: [],
    componentes: [],
    ...extra,
  };
}

const LOCAL = { armazem: { tipo: "LOCAL" } };
const FULL = { armazem: { tipo: "FULL_ML" } };

describe("listarProdutos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.produto.findMany.mockResolvedValue([
      produto("parado", { estoques: [{ quantidade: 5, estoqueSeguranca: 0, ...LOCAL }] }),
      produto("inativo", { ativo: false }),
      produto("adaptador", {
        estoques: [
          { quantidade: 10, estoqueSeguranca: 2, ...LOCAL },
          { quantidade: 7, estoqueSeguranca: 0, ...FULL },
        ],
      }),
      produto("cabo"),
      produto("kit2", {
        isKit: true,
        componentes: [{ quantidade: 2, produto: { id: "adaptador", nome: "adaptador", sku: "ADAPTADOR", custoMedio: 1000 } }],
      }),
    ]);
    prismaMock.vendaCanalItem.groupBy.mockResolvedValue([
      { produtoId: "cabo", _sum: { quantidade: 15 } },
      { produtoId: "kit2", _sum: { quantidade: 10 } },
    ]);
  });

  it("ativos e mais vendidos primeiro — venda de kit conta para o componente", async () => {
    const { listarProdutos } = await import("../listaProdutos");
    const r = await listarProdutos("c1", {});
    // adaptador: 10 kits × 2 = 20 > cabo 15 > parado (com estoque) > ...
    expect(r.itens.map((i) => i.id)).toEqual(["adaptador", "cabo", "parado"]);
    expect(r.itens[0].vendas90d).toBe(20);
    expect(r.contagens).toEqual({ produtos: 3, kits: 1, inativos: 1 });
  });

  it("estoque local não soma o armazém Full", async () => {
    const { listarProdutos } = await import("../listaProdutos");
    const r = await listarProdutos("c1", { q: "adapt" });
    expect(r.itens[0].estoqueLocal).toBe(10);
  });

  it("aba de kits mostra quantos dá para montar e o custo pela composição", async () => {
    const { listarProdutos } = await import("../listaProdutos");
    const r = await listarProdutos("c1", { tipo: "kits" });
    expect(r.itens).toHaveLength(1);
    expect(r.itens[0].kitsMontaveis).toBe(5);
    expect(r.itens[0].custoMedio).toBe(2000);
  });

  it("pagina no servidor e avisa se tem mais", async () => {
    const { listarProdutos } = await import("../listaProdutos");
    const p1 = await listarProdutos("c1", { porPagina: 5, pagina: 1, status: "todos", tipo: "todos" });
    expect(p1.total).toBe(5);
    expect(p1.temMais).toBe(false);
    const p2 = await listarProdutos("c1", { porPagina: 5, pagina: 2, status: "todos", tipo: "todos" });
    expect(p2.itens).toHaveLength(0);
  });

  it("filtra por pendência e por busca sem acento", async () => {
    const { listarProdutos } = await import("../listaProdutos");
    expect((await listarProdutos("c1", { pendencia: "SEM_CUSTO" })).itens.map((i) => i.id)).toEqual(["parado"]);
    expect((await listarProdutos("c1", { status: "inativos", tipo: "todos" })).itens.map((i) => i.id)).toEqual(["inativo"]);
  });

  it("sem histórico no Financeiro, usa as vendas de 90 dias do anúncio", async () => {
    prismaMock.vendaCanalItem.groupBy.mockResolvedValue([]);
    prismaMock.produto.findMany.mockResolvedValue([
      produto("a", { ProdutoMercadoLivre: [{ mlSold90Days: 3, mlLogisticType: null, mlShippingMode: null, mlFullDisponivel: null, mlStatus: "active", mlThumbnail: null }] }),
      produto("b", { ProdutoMercadoLivre: [{ mlSold90Days: 9, mlLogisticType: "fulfillment", mlShippingMode: null, mlFullDisponivel: 4, mlStatus: "active", mlThumbnail: null }] }),
    ]);
    const { listarProdutos } = await import("../listaProdutos");
    const r = await listarProdutos("c1", {});
    expect(r.itens.map((i) => i.id)).toEqual(["b", "a"]);
    expect(r.itens[0].estoqueFull).toBe(4);
  });
});
