import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku";

/** Vínculo direto por anúncio (ProdutoMercadoLivre) — usado por vendas e por ads. */
export async function vincularProdutoPorAnuncio(
  accountId: string,
  anuncioExternoId: string
): Promise<string | null> {
  const vinculo = await prisma.produtoMercadoLivre.findUnique({
    where: {
      mlItemId_mercadoLivreAccountId: {
        mlItemId: anuncioExternoId,
        mercadoLivreAccountId: accountId,
      },
    },
    select: { produtoId: true },
  });
  return vinculo?.produtoId ?? null;
}

/** Fallback por SKU normalizado — só vendas têm SKU disponível no próprio item do pedido. */
export async function vincularProdutoPorSku(
  userId: string,
  sku: string
): Promise<string | null> {
  const produto = await prisma.produto.findUnique({
    where: { sku_userId: { sku: normalizeSku(sku), userId } },
    select: { id: true },
  });
  return produto?.id ?? null;
}

export async function vincularProduto(
  userId: string,
  accountId: string,
  item: { anuncioExternoId: string; sku: string | null }
): Promise<string | null> {
  const porAnuncio = await vincularProdutoPorAnuncio(accountId, item.anuncioExternoId);
  if (porAnuncio) return porAnuncio;
  if (!item.sku) return null;
  return vincularProdutoPorSku(userId, item.sku);
}
