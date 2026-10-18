import { describe, it, expect, vi, beforeEach } from "vitest";

interface FakeVinculoMl {
  mlItemId: string;
  mercadoLivreAccountId: string;
  produtoId: string | null;
  vinculoConfirmado: boolean;
}
interface FakeProduto {
  id: string;
  sku: string;
  userId: string;
}

let vinculosMl: FakeVinculoMl[] = [];
let produtos: FakeProduto[] = [];

vi.mock("@/lib/prisma", () => ({
  prisma: {
    produtoMercadoLivre: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { mlItemId_mercadoLivreAccountId: { mlItemId: string; mercadoLivreAccountId: string } };
        }) => {
          const chave = where.mlItemId_mercadoLivreAccountId;
          const vinculo = vinculosMl.find(
            (v) => v.mlItemId === chave.mlItemId && v.mercadoLivreAccountId === chave.mercadoLivreAccountId
          );
          return vinculo
            ? { produtoId: vinculo.produtoId, vinculoConfirmado: vinculo.vinculoConfirmado }
            : null;
        }
      ),
    },
    produto: {
      findUnique: vi.fn(
        async ({ where }: { where: { sku_userId: { sku: string; userId: string } } }) => {
          const produto = produtos.find(
            (p) => p.sku === where.sku_userId.sku && p.userId === where.sku_userId.userId
          );
          return produto ? { id: produto.id } : null;
        }
      ),
    },
  },
}));

const { vincularProduto } = await import("../vinculo");

beforeEach(() => {
  vinculosMl = [];
  produtos = [];
});

describe("vincularProduto", () => {
  it("vínculo por anúncio confirmado: confirmado=true", async () => {
    vinculosMl.push({ mlItemId: "MLB1", mercadoLivreAccountId: "conta-1", produtoId: "produto-1", vinculoConfirmado: true });

    const resultado = await vincularProduto("user-1", "conta-1", { anuncioExternoId: "MLB1", sku: null });

    expect(resultado).toEqual({ produtoId: "produto-1", confirmado: true });
  });

  it("vínculo por anúncio não confirmado (ex.: similaridade): confirmado=false", async () => {
    vinculosMl.push({ mlItemId: "MLB1", mercadoLivreAccountId: "conta-1", produtoId: "produto-1", vinculoConfirmado: false });

    const resultado = await vincularProduto("user-1", "conta-1", { anuncioExternoId: "MLB1", sku: null });

    expect(resultado).toEqual({ produtoId: "produto-1", confirmado: false });
  });

  it("fallback por SKU normalizado é sempre confirmado=true", async () => {
    produtos.push({ id: "produto-2", sku: "SKU-1", userId: "user-1" });

    const resultado = await vincularProduto("user-1", "conta-1", { anuncioExternoId: "MLB2", sku: "SKU-1" });

    expect(resultado).toEqual({ produtoId: "produto-2", confirmado: true });
  });

  it("sem vínculo nenhum: produtoId null, confirmado=true (não se aplica)", async () => {
    const resultado = await vincularProduto("user-1", "conta-1", { anuncioExternoId: "MLB3", sku: null });

    expect(resultado).toEqual({ produtoId: null, confirmado: true });
  });
});
