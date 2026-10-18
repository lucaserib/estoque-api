import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const estoques = new Map<string, number>();
const movimentos: unknown[] = [];
let armazem: Record<string, unknown> | null = { id: "full", nome: "Full (Mercado Livre)", tipo: "LOCAL" };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    produtoMercadoLivre: {
      findMany: vi.fn(async () => [
        { produtoId: "p1", mlFullDisponivel: 10 },
        { produtoId: "p1", mlFullDisponivel: 5 },
        { produtoId: "p2", mlFullDisponivel: null },
        { produtoId: "p3", mlFullDisponivel: 4 },
      ]),
    },
    armazem: {
      findFirst: vi.fn(async () => armazem),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(armazem!, data)),
      create: vi.fn(),
    },
    estoque: {
      findUnique: vi.fn(async ({ where }: { where: { produtoId_armazemId: { produtoId: string } } }) => {
        const q = estoques.get(where.produtoId_armazemId.produtoId);
        return q == null ? null : { quantidade: q };
      }),
      upsert: vi.fn(async ({ create }: { create: { produtoId: string; quantidade: number } }) => {
        estoques.set(create.produtoId, create.quantidade);
      }),
    },
    estoqueMovimentacao: { create: vi.fn(async (a: unknown) => movimentos.push(a)) },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
vi.mock("@/services/mercadoLivreService", () => ({ MercadoLivreService: {} }));
vi.mock("@/services/mercadoLivrePreco", () => ({ obterPrecoAtualAnuncio: vi.fn() }));

const { listarIdsAnunciosMl, atualizarEstoqueFullDosAnuncios } = await import("../anunciosMl");

beforeEach(() => {
  estoques.clear();
  estoques.set("p3", 4);
  movimentos.length = 0;
  armazem = { id: "full", nome: "Full (Mercado Livre)", tipo: "LOCAL" };
});
afterEach(() => vi.unstubAllGlobals());

describe("listarIdsAnunciosMl", () => {
  it("pagina até o total (o sync antigo parava nos primeiros 50)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const offset = Number(new URL(url).searchParams.get("offset"));
        const ids = Array.from({ length: offset === 0 ? 100 : 55 }, (_, i) => `MLB${offset + i}`);
        return new Response(JSON.stringify({ results: ids, paging: { total: 155 } }), { status: 200 });
      })
    );
    const ids = await listarIdsAnunciosMl("token", "99");
    expect(ids).toHaveLength(155);
  });
});

describe("atualizarEstoqueFullDosAnuncios", () => {
  it("soma os anúncios Full de cada produto, corrige o tipo do armazém e só grava o que mudou", async () => {
    const alterados = await atualizarEstoqueFullDosAnuncios("user-1", "ml-1");
    expect(armazem!.tipo).toBe("FULL_ML");
    expect(estoques.get("p1")).toBe(15);
    expect(estoques.has("p2")).toBe(false);
    expect(alterados).toBe(1);
    expect(movimentos).toHaveLength(1);
  });
});
