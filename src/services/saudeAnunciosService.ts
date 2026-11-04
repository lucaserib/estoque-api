import { prisma } from "@/lib/prisma";
import { calcularMargemUnitaria } from "@/lib/margem";
import { calcularReposicaoConta } from "./reposicaoService";

export type CategoriaProblemaAnuncio =
  | "PAUSADO"
  | "SEM_ESTOQUE"
  | "SEM_VINCULO"
  | "FULL_BAIXO"
  | "SEM_TARIFA_FRETE"
  | "PRECO_ABAIXO_CUSTO";

export interface AnuncioComProblema {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlThumbnail: string | null;
  mlPermalink: string | null;
  produtoId: string | null;
  produtoNome: string | null;
  produtoSku: string | null;
}

export interface GrupoProblemaAnuncios {
  categoria: CategoriaProblemaAnuncio;
  titulo: string;
  descricao: string;
  anuncios: AnuncioComProblema[];
  linkFiltro: string;
  acao: string;
}

export interface SaudeAnunciosResultado {
  totalAtivos: number;
  grupos: GrupoProblemaAnuncios[];
}

const ROTULOS: Record<
  CategoriaProblemaAnuncio,
  { titulo: string; descricao: string; acao: string }
> = {
  PAUSADO: {
    titulo: "Pausados",
    descricao: "Anúncios pausados — não aparecem para o comprador",
    acao: "Ver anúncios pausados",
  },
  SEM_ESTOQUE: {
    titulo: "Sem estoque",
    descricao: "Anúncios ativos com quantidade disponível zerada no Mercado Livre",
    acao: "Ver sem estoque",
  },
  SEM_VINCULO: {
    titulo: "Sem vínculo",
    descricao: "Anúncios ainda não ligados a um produto do catálogo",
    acao: "Vincular anúncios",
  },
  FULL_BAIXO: {
    titulo: "Full baixo",
    descricao: "Produto enviado ao Full com estoque abaixo do ponto de pedido",
    acao: "Ver reposição",
  },
  SEM_TARIFA_FRETE: {
    titulo: "Sem tarifa ou frete",
    descricao: "Anúncios ativos sem tarifa de venda ou custo de frete sincronizados — a margem não pode ser calculada",
    acao: "Ver produto",
  },
  PRECO_ABAIXO_CUSTO: {
    titulo: "Preço abaixo do custo",
    descricao: "Margem calculada é negativa — a venda dá prejuízo",
    acao: "Ver produto",
  },
};

export async function calcularSaudeAnuncios(
  contaId: string
): Promise<SaudeAnunciosResultado> {
  const [anuncios, aliquota, reposicao] = await Promise.all([
    prisma.produtoMercadoLivre.findMany({
      where: { mercadoLivreAccount: { userId: contaId } },
      select: {
        id: true,
        mlItemId: true,
        mlTitle: true,
        mlThumbnail: true,
        mlPermalink: true,
        mlStatus: true,
        mlPrice: true,
        mlAvailableQuantity: true,
        mlFreeShipping: true,
        mlTarifaVenda: true,
        mlCustoFrete: true,
        produtoId: true,
        produto: {
          select: {
            id: true,
            nome: true,
            sku: true,
            isKit: true,
            custoMedio: true,
            componentes: {
              select: { quantidade: true, produto: { select: { custoMedio: true } } },
            },
          },
        },
      },
    }),
    prisma.configuracaoGeral.findUnique({
      where: { userId: contaId },
      select: { aliquotaImposto: true },
    }),
    calcularReposicaoConta(contaId),
  ]);

  const reposicaoPorProduto = new Map(
    reposicao.sugestoes.map((s) => [s.produtoId, s])
  );

  const grupos = new Map<CategoriaProblemaAnuncio, AnuncioComProblema[]>();
  const adicionar = (categoria: CategoriaProblemaAnuncio, item: AnuncioComProblema) => {
    const lista = grupos.get(categoria) ?? [];
    lista.push(item);
    grupos.set(categoria, lista);
  };

  let totalAtivos = 0;

  for (const a of anuncios) {
    const item: AnuncioComProblema = {
      id: a.id,
      mlItemId: a.mlItemId,
      mlTitle: a.mlTitle,
      mlThumbnail: a.mlThumbnail,
      mlPermalink: a.mlPermalink,
      produtoId: a.produtoId,
      produtoNome: a.produto?.nome ?? null,
      produtoSku: a.produto?.sku ?? null,
    };

    const ativo = a.mlStatus === "active";
    if (ativo) totalAtivos += 1;

    if (a.mlStatus === "paused") {
      adicionar("PAUSADO", item);
    }

    if (ativo && a.mlAvailableQuantity === 0) {
      adicionar("SEM_ESTOQUE", item);
    }

    if (!a.produtoId) {
      adicionar("SEM_VINCULO", item);
    }

    if (a.produtoId) {
      const sugestao = reposicaoPorProduto.get(a.produtoId);
      if (sugestao && sugestao.temAnuncioFull && sugestao.status !== "ok") {
        adicionar("FULL_BAIXO", item);
      }
    }

    if (ativo) {
      const semTarifa = a.mlTarifaVenda == null;
      const semFrete = a.mlFreeShipping && a.mlCustoFrete == null;
      if (semTarifa || semFrete) {
        adicionar("SEM_TARIFA_FRETE", item);
      }
    }

    if (ativo && a.produto) {
      const custo = a.produto.isKit
        ? a.produto.componentes.some((c) => c.produto.custoMedio == null)
          ? null
          : a.produto.componentes.reduce((sum, c) => sum + (c.produto.custoMedio ?? 0), 0)
        : a.produto.custoMedio;

      const margem = calcularMargemUnitaria({
        precoVenda: a.mlPrice,
        tarifa: a.mlTarifaVenda,
        frete: a.mlCustoFrete,
        custo,
        aliquotaImposto: aliquota?.aliquotaImposto ?? 0,
      });

      if (margem.completo && margem.margemValor !== null && margem.margemValor < 0) {
        adicionar("PRECO_ABAIXO_CUSTO", item);
      }
    }
  }

  const linkFiltro: Record<CategoriaProblemaAnuncio, string> = {
    PAUSADO: "/mercado-livre/produtos?status=paused",
    SEM_ESTOQUE: "/mercado-livre/produtos?stock=out",
    SEM_VINCULO: "/mercado-livre/produtos?stock=unlinked",
    FULL_BAIXO: "/reposicao",
    SEM_TARIFA_FRETE: "/mercado-livre/produtos",
    PRECO_ABAIXO_CUSTO: "/mercado-livre/produtos",
  };

  const ordem: CategoriaProblemaAnuncio[] = [
    "PRECO_ABAIXO_CUSTO",
    "SEM_ESTOQUE",
    "FULL_BAIXO",
    "PAUSADO",
    "SEM_VINCULO",
    "SEM_TARIFA_FRETE",
  ];

  const resultado: GrupoProblemaAnuncios[] = ordem
    .map((categoria) => ({
      categoria,
      titulo: ROTULOS[categoria].titulo,
      descricao: ROTULOS[categoria].descricao,
      acao: ROTULOS[categoria].acao,
      linkFiltro: linkFiltro[categoria],
      anuncios: grupos.get(categoria) ?? [],
    }))
    .filter((g) => g.anuncios.length > 0);

  return { totalAtivos, grupos: resultado };
}
