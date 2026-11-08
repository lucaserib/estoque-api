import { OrigemVinculoProduto, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku";
import { revincularVendasDoAnuncio } from "@/modules/financeiro/ingestao/sincronizador";

export class VinculoErro extends Error {
  constructor(
    message: string,
    public readonly status: number = 400
  ) {
    super(message);
    this.name = "VinculoErro";
  }
}

export const UNIDADES_POR_VENDA_MAXIMO = 100;

export interface ComposicaoVinculo {
  produtoBaseId: string;
  produtoBaseNome: string;
  produtoBaseSku: string;
  unidadesPorVenda: number;
  produtoVinculadoId: string;
  ehKitDeQuantidade: boolean;
  ehKitMisto: boolean;
}

type ProdutoComComponentes = {
  id: string;
  nome: string;
  sku: string;
  isKit: boolean;
  componentes: Array<{ quantidade: number; produto: { id: string; nome: string; sku: string } }>;
};

export function descreverComposicao(produto: ProdutoComComponentes): ComposicaoVinculo {
  if (produto.isKit && produto.componentes.length === 1) {
    const [componente] = produto.componentes;
    return {
      produtoBaseId: componente.produto.id,
      produtoBaseNome: componente.produto.nome,
      produtoBaseSku: componente.produto.sku,
      unidadesPorVenda: componente.quantidade,
      produtoVinculadoId: produto.id,
      ehKitDeQuantidade: true,
      ehKitMisto: false,
    };
  }
  return {
    produtoBaseId: produto.id,
    produtoBaseNome: produto.nome,
    produtoBaseSku: produto.sku,
    unidadesPorVenda: 1,
    produtoVinculadoId: produto.id,
    ehKitDeQuantidade: false,
    ehKitMisto: produto.isKit && produto.componentes.length > 1,
  };
}

export const INCLUDE_COMPOSICAO = {
  componentes: {
    select: {
      quantidade: true,
      produto: { select: { id: true, nome: true, sku: true } },
    },
  },
} satisfies Prisma.ProdutoInclude;

function skuDoKit(skuBase: string, unidades: number, tentativa: number): string {
  const sufixo = tentativa === 0 ? "" : `-${tentativa + 1}`;
  return normalizeSku(`${skuBase}-KIT${unidades}${sufixo}`);
}

export async function obterOuCriarKitDeQuantidade(
  contaId: string,
  produtoBaseId: string,
  unidades: number
): Promise<{ id: string; criado: boolean }> {
  const base = await prisma.produto.findFirst({
    where: { id: produtoBaseId, userId: contaId },
    select: { id: true, nome: true, sku: true, isKit: true, imagemUrl: true, imagemThumbUrl: true, categoria: true, marca: true },
  });
  if (!base) throw new VinculoErro("Produto não encontrado", 404);
  if (base.isKit) {
    throw new VinculoErro(
      "Escolha o produto unitário (não um kit) e informe quantas unidades o anúncio vende."
    );
  }

  const candidatos = await prisma.produto.findMany({
    where: {
      userId: contaId,
      isKit: true,
      componentes: { some: { produtoId: base.id, quantidade: unidades } },
    },
    select: { id: true, ativo: true, _count: { select: { componentes: true } } },
  });
  const existente = candidatos.find((c) => c._count.componentes === 1);
  if (existente) {
    if (!existente.ativo) {
      await prisma.produto.update({ where: { id: existente.id }, data: { ativo: true } });
    }
    return { id: existente.id, criado: false };
  }

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const sku = skuDoKit(base.sku, unidades, tentativa);
    try {
      const kit = await prisma.produto.create({
        data: {
          userId: contaId,
          nome: `Kit ${unidades}x ${base.nome}`,
          sku,
          isKit: true,
          ativo: true,
          imagemUrl: base.imagemUrl,
          imagemThumbUrl: base.imagemThumbUrl,
          categoria: base.categoria,
          marca: base.marca,
          componentes: { create: { produtoId: base.id, quantidade: unidades } },
        },
        select: { id: true },
      });
      return { id: kit.id, criado: true };
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") continue;
      throw erro;
    }
  }
  throw new VinculoErro("Não foi possível gerar um SKU livre para o kit. Cadastre o kit manualmente.", 409);
}

export interface DefinirVinculoEntrada {
  contaId: string;
  anuncioId?: string;
  mercadoLivreAccountId?: string;
  mlItemId?: string;
  produtoId: string | null;
  unidadesPorVenda?: number;
}

export interface DefinirVinculoResultado {
  anuncioId: string;
  mlItemId: string;
  produtoVinculadoId: string | null;
  kitCriado: boolean;
  vendasRecalculadas: number;
}

async function localizarAnuncio(entrada: DefinirVinculoEntrada) {
  const where: Prisma.ProdutoMercadoLivreWhereInput = entrada.anuncioId
    ? { id: entrada.anuncioId }
    : entrada.mercadoLivreAccountId && entrada.mlItemId
      ? { mlItemId: entrada.mlItemId, mercadoLivreAccountId: entrada.mercadoLivreAccountId }
      : { id: "__nenhum__" };

  const anuncio = await prisma.produtoMercadoLivre.findFirst({
    where: { ...where, mercadoLivreAccount: { userId: entrada.contaId } },
    select: { id: true, mlItemId: true, mercadoLivreAccountId: true },
  });
  if (!anuncio) {
    throw new VinculoErro(
      "Anúncio não encontrado. Rode a sincronização do catálogo para trazer os anúncios do Mercado Livre.",
      404
    );
  }
  return anuncio;
}

export async function definirVinculoAnuncio(entrada: DefinirVinculoEntrada): Promise<DefinirVinculoResultado> {
  const anuncio = await localizarAnuncio(entrada);
  const unidades = Math.round(entrada.unidadesPorVenda ?? 1);
  if (!Number.isFinite(unidades) || unidades < 1 || unidades > UNIDADES_POR_VENDA_MAXIMO) {
    throw new VinculoErro(`Unidades por venda deve ficar entre 1 e ${UNIDADES_POR_VENDA_MAXIMO}.`);
  }

  let produtoVinculadoId: string | null = null;
  let kitCriado = false;

  if (entrada.produtoId) {
    const produto = await prisma.produto.findFirst({
      where: { id: entrada.produtoId, userId: entrada.contaId },
      select: { id: true },
    });
    if (!produto) throw new VinculoErro("Produto não encontrado", 404);

    if (unidades > 1) {
      const kit = await obterOuCriarKitDeQuantidade(entrada.contaId, produto.id, unidades);
      produtoVinculadoId = kit.id;
      kitCriado = kit.criado;
    } else {
      produtoVinculadoId = produto.id;
    }
  }

  await prisma.produtoMercadoLivre.update({
    where: { id: anuncio.id },
    data: produtoVinculadoId
      ? {
          produtoId: produtoVinculadoId,
          vinculoOrigem: OrigemVinculoProduto.MANUAL,
          vinculoConfirmado: true,
          syncStatus: "pending",
        }
      : {
          produtoId: null,
          vinculoOrigem: null,
          vinculoConfirmado: true,
          syncStatus: "pending_link",
        },
  });

  const vendasRecalculadas = await revincularVendasDoAnuncio({
    userId: entrada.contaId,
    contaCanalId: anuncio.mercadoLivreAccountId,
    anuncioExternoId: anuncio.mlItemId,
    produtoId: produtoVinculadoId,
  });

  return {
    anuncioId: anuncio.id,
    mlItemId: anuncio.mlItemId,
    produtoVinculadoId,
    kitCriado,
    vendasRecalculadas,
  };
}

export async function confirmarVinculoAnuncio(contaId: string, anuncioId: string): Promise<void> {
  const anuncio = await prisma.produtoMercadoLivre.findFirst({
    where: { id: anuncioId, mercadoLivreAccount: { userId: contaId }, produtoId: { not: null } },
    select: { id: true, mlItemId: true, mercadoLivreAccountId: true, produtoId: true },
  });
  if (!anuncio) throw new VinculoErro("Vínculo não encontrado", 404);

  await prisma.produtoMercadoLivre.update({
    where: { id: anuncio.id },
    data: { vinculoConfirmado: true, syncStatus: "matched" },
  });
  await revincularVendasDoAnuncio({
    userId: contaId,
    contaCanalId: anuncio.mercadoLivreAccountId,
    anuncioExternoId: anuncio.mlItemId,
    produtoId: anuncio.produtoId,
  });
}
