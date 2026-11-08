import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { serializeWithEAN } from "@/utils/api";
import { podeVer } from "@/lib/permissoes";
import { calcularCustoKit } from "@/lib/custo";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyUser(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID do produto não fornecido" },
        { status: 400 }
      );
    }

    const produto = await prisma.produto.findFirst({
      where: {
        id,
        userId: user.contaId,
      },
      include: {
        estoques: {
          include: {
            armazem: {
              select: {
                id: true,
                nome: true,
              },
            },
          },
        },
        componentes: {
          select: {
            quantidade: true,
            produto: { select: { id: true, nome: true, sku: true, custoMedio: true } },
          },
        },
        ProdutoMercadoLivre: {
          select: {
            id: true,
            mlSellerSku: true,
            mercadoLivreAccountId: true,
            mlItemId: true,
            mlTitle: true,
            mlAvailableQuantity: true,
            mlSoldQuantity: true,
            mlSold90Days: true,
            mlStatus: true,
            mlPrice: true,
            mlPermalink: true,
            mlThumbnail: true,
            mlTarifaVenda: true,
            mlCustoFrete: true,
            mlCustosAtualizadosEm: true,
            mlFreeShipping: true,
          },
        },
        kitsComponentes: {
          select: {
            quantidade: true,
            kit: {
              select: {
                id: true,
                nome: true,
                sku: true,
                ativo: true,
                _count: { select: { componentes: true } },
                ProdutoMercadoLivre: {
                  select: {
                    id: true,
                    mlSellerSku: true,
                    mercadoLivreAccountId: true,
                    mlItemId: true,
                    mlTitle: true,
                    mlAvailableQuantity: true,
                    mlSoldQuantity: true,
                    mlSold90Days: true,
                    mlStatus: true,
                    mlPrice: true,
                    mlPermalink: true,
                    mlThumbnail: true,
                    mlTarifaVenda: true,
                    mlCustoFrete: true,
                    mlCustosAtualizadosEm: true,
                    mlFreeShipping: true,
                  },
                },
              },
            },
          },
        },
        fornecedores: {
          include: {
            fornecedor: {
              select: { id: true, nome: true, cnpj: true, contato: true },
            },
          },
          orderBy: { principal: "desc" },
        },
        pedidos: {
          include: {
            pedido: {
              select: {
                id: true,
                status: true,
                dataConclusao: true,
                fornecedor: { select: { nome: true } },
              },
            },
          },
          orderBy: { id: "desc" },
          take: 20,
        },
        detalhesSaida: {
          include: {
            saida: {
              select: { id: true, data: true },
            },
          },
          orderBy: { id: "desc" },
          take: 20,
        },
        movimentacoesEstoque: {
          select: {
            id: true,
            quantidadeAnterior: true,
            quantidadeNova: true,
            origem: true,
            observacao: true,
            createdAt: true,
            armazem: { select: { nome: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
        },
      },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const verCusto = podeVer(user.role, "VER_CUSTO");
    const custoMedio = produto.isKit ? (await calcularCustoKit(produto.id)).custoMedio : produto.custoMedio;
    const { kitsComponentes, ...produtoBase } = produto;
    const anunciosViaKit = (kitsComponentes ?? []).flatMap((vinculoKit) =>
      vinculoKit.kit.ProdutoMercadoLivre.map((ml) => ({
        ...ml,
        mlPrice: ml.mlPrice ? Number(ml.mlPrice) : null,
        kit: {
          id: vinculoKit.kit.id,
          nome: vinculoKit.kit.nome,
          sku: vinculoKit.kit.sku,
          ativo: vinculoKit.kit.ativo,
          kitDeQuantidade: vinculoKit.kit._count.componentes === 1,
        },
        unidadesPorVenda: vinculoKit.quantidade,
      }))
    );

    const produtoSerialized = {
      ...produtoBase,
      anunciosViaKit,
      imagemUrl: normalizeImageUrl(produto.imagemUrl),
      custoMedio: verCusto && custoMedio != null ? Number(custoMedio) : null,
      estoques: produto.estoques.map((estoque) => ({
        ...estoque,
        quantidade: Number(estoque.quantidade),
      })),
      componentes: produto.componentes.map((componente) => ({
        ...componente,
        produto: { ...componente.produto, custoMedio: verCusto ? componente.produto.custoMedio : null },
      })),
      fornecedores: produto.fornecedores.map((fornecedor) => ({
        ...fornecedor,
        preco: verCusto ? fornecedor.preco : null,
        precoUnitario: verCusto ? fornecedor.precoUnitario : null,
      })),
      pedidos: produto.pedidos.map((item) => ({
        ...item,
        custo: verCusto ? item.custo : null,
      })),
      ProdutoMercadoLivre: produto.ProdutoMercadoLivre.map((ml) => ({
        ...ml,
        mlPrice: ml.mlPrice ? Number(ml.mlPrice) : null,
      })),
    };

    return NextResponse.json({
      success: true,
      produto: serializeWithEAN(produtoSerialized),
    });
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produto" },
      { status: 500 }
    );
  }
}
