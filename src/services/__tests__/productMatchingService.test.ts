import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeProdutoMl {
  id: string;
  mlItemId: string;
  mercadoLivreAccountId: string;
  produtoId: string | null;
  syncStatus: string;
  vinculoOrigem: string | null;
  vinculoConfirmado: boolean;
}

let produtosMl: FakeProdutoMl[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    produtoMercadoLivre: {
      findFirst: vi.fn(
        async ({
          where,
        }: {
          where: { mlItemId: string; mercadoLivreAccountId: string };
        }) =>
          produtosMl.find(
            (p) => p.mlItemId === where.mlItemId && p.mercadoLivreAccountId === where.mercadoLivreAccountId
          ) ?? null
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const produto = produtosMl.find((p) => p.id === where.id);
        if (!produto) throw new Error("não encontrado");
        Object.assign(produto, data);
        return produto;
      }),
    },
  },
}));

const { ProductMatchingService } = await import("../productMatchingService");

function matchBase(parcial: Partial<Parameters<typeof ProductMatchingService.applyMatches>[0][number]>) {
  return {
    localProduct: { id: "produto-1", sku: "SKU-1", nome: "Produto 1", ean: null },
    mlProduct: { mlItemId: "MLB1", mlTitle: "Produto 1", sellerSku: "SKU-1", ean: null },
    matchType: "sku" as const,
    confidence: 95,
    status: "matched" as const,
    ...parcial,
  };
}

beforeEach(() => {
  produtosMl = [
    { id: "ml-1", mlItemId: "MLB1", mercadoLivreAccountId: "conta-1", produtoId: null, syncStatus: "pending", vinculoOrigem: null, vinculoConfirmado: true },
  ];
});

describe("ProductMatchingService.applyMatches", () => {
  it("match por SKU exato: vincula com origem SKU_EXATO e confirmado=true", async () => {
    await ProductMatchingService.applyMatches([matchBase({ matchType: "sku" })], "conta-1");

    expect(produtosMl[0].produtoId).toBe("produto-1");
    expect(produtosMl[0].vinculoOrigem).toBe("SKU_EXATO");
    expect(produtosMl[0].vinculoConfirmado).toBe(true);
  });

  it("match por EAN: origem EAN e confirmado=true", async () => {
    await ProductMatchingService.applyMatches([matchBase({ matchType: "ean", confidence: 100 })], "conta-1");

    expect(produtosMl[0].vinculoOrigem).toBe("EAN");
    expect(produtosMl[0].vinculoConfirmado).toBe(true);
  });

  it("Ciclo 9 (Fase 5): match por similaridade (fuzzy) nasce SEMPRE não confirmado, mesmo com confiança alta", async () => {
    await ProductMatchingService.applyMatches(
      [matchBase({ matchType: "fuzzy", confidence: 92, status: "matched" })],
      "conta-1"
    );

    expect(produtosMl[0].produtoId).toBe("produto-1");
    expect(produtosMl[0].vinculoOrigem).toBe("SIMILARIDADE");
    expect(produtosMl[0].vinculoConfirmado).toBe(false);
    expect(produtosMl[0].syncStatus).toBe("pending_review");
  });

  it("Ciclo 9 (Fase 5): match fuzzy de confiança média (antes descartado silenciosamente) agora é persistido como não confirmado", async () => {
    await ProductMatchingService.applyMatches(
      [matchBase({ matchType: "fuzzy", confidence: 72, status: "pending_review" })],
      "conta-1"
    );

    expect(produtosMl[0].produtoId).toBe("produto-1");
    expect(produtosMl[0].vinculoConfirmado).toBe(false);
  });
});
