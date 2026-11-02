import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku";
import { normalizarTexto } from "./listaProdutos";
import { sugerirUnidadesPeloTitulo } from "./unidadesAnuncio";

export type ConfiancaSugestao = "alta" | "media" | "baixa";

export interface SugestaoVinculo {
  anuncioId: string;
  mlItemId: string;
  mlTitle: string;
  mlSellerSku: string | null;
  produtoId: string;
  produtoNome: string;
  produtoSku: string;
  confianca: ConfiancaSugestao;
  motivo: string;
  unidadesSugeridas: number;
}

const LIMITE_PRODUTOS_PARA_TITULO = 3000;

/**
 * Sugere, para cada anúncio ativo sem vínculo, o produto mais provável:
 * SKU exato do anúncio = SKU do produto (confiança alta) ou o nome do
 * produto aparece dentro do título do anúncio (confiança baixa — pode
 * confundir produtos parecidos, por isso nunca aplica sozinho).
 *
 * EAN não entra aqui: o ML não sincroniza o GTIN do anúncio para
 * ProdutoMercadoLivre hoje (só o estoque/preço/título), então não há EAN
 * do anúncio pra comparar sem uma sincronização nova.
 */
export async function sugerirVinculos(contaId: string): Promise<SugestaoVinculo[]> {
  const [anuncios, produtos] = await Promise.all([
    prisma.produtoMercadoLivre.findMany({
      where: { mercadoLivreAccount: { userId: contaId }, produtoId: null, mlStatus: "active" },
      select: { id: true, mlItemId: true, mlTitle: true, mlSellerSku: true },
    }),
    prisma.produto.findMany({
      where: { userId: contaId, ativo: true, isKit: false },
      select: { id: true, nome: true, sku: true },
    }),
  ]);

  const porSku = new Map(produtos.map((p) => [normalizeSku(p.sku), p]));
  const produtosParaTitulo =
    produtos.length <= LIMITE_PRODUTOS_PARA_TITULO
      ? produtos.map((p) => ({ ...p, nomeNormalizado: normalizarTexto(p.nome) })).filter((p) => p.nomeNormalizado.length >= 4)
      : [];

  const sugestoes: SugestaoVinculo[] = [];

  for (const anuncio of anuncios) {
    const unidadesSugeridas = sugerirUnidadesPeloTitulo(anuncio.mlTitle) ?? 1;

    if (anuncio.mlSellerSku) {
      const produto = porSku.get(normalizeSku(anuncio.mlSellerSku));
      if (produto) {
        sugestoes.push({
          anuncioId: anuncio.id,
          mlItemId: anuncio.mlItemId,
          mlTitle: anuncio.mlTitle,
          mlSellerSku: anuncio.mlSellerSku,
          produtoId: produto.id,
          produtoNome: produto.nome,
          produtoSku: produto.sku,
          confianca: "alta",
          motivo: `SKU do anúncio igual ao do produto (${produto.sku})`,
          unidadesSugeridas,
        });
        continue;
      }
    }

    if (produtosParaTitulo.length > 0) {
      const tituloNormalizado = normalizarTexto(anuncio.mlTitle);
      const candidato = produtosParaTitulo.find((p) => tituloNormalizado.includes(p.nomeNormalizado));
      if (candidato) {
        sugestoes.push({
          anuncioId: anuncio.id,
          mlItemId: anuncio.mlItemId,
          mlTitle: anuncio.mlTitle,
          mlSellerSku: anuncio.mlSellerSku,
          produtoId: candidato.id,
          produtoNome: candidato.nome,
          produtoSku: candidato.sku,
          confianca: "baixa",
          motivo: "Nome do produto aparece no título do anúncio",
          unidadesSugeridas,
        });
      }
    }
  }

  return sugestoes;
}
