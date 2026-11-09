import { atualizarCustoDasVendasAposMudanca } from "@/modules/financeiro/ingestao/sincronizador";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { NextRequest, NextResponse } from "next/server";
import { serializeWithEAN } from "@/utils/api";
import { prepareBigIntEAN } from "@/utils/api";
import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { Prisma } from "@prisma/client";
import { exigirPermissao, permissaoErrorResponse, podeVer } from "@/lib/permissoes";

const safeEANConversion = (ean: string | null): bigint | null => {
  if (!ean) return null;
  if (ean === "") return null;

  const cleanEAN = String(ean).replace(/[^0-9]/g, "");

  if (!cleanEAN) return null;

  try {
    return BigInt(cleanEAN);
  } catch (error) {
    console.error("Erro ao converter EAN para BigInt:", error);
    return null;
  }
};

const produtoListInclude = {
  estoques: {
    include: {
      armazem: true,
    },
  },
  componentes: {
    include: {
      produto: true,
    },
  },
  fornecedores: {
    include: {
      fornecedor: {
        select: { id: true, nome: true },
      },
    },
    orderBy: {
      principal: "desc" as const,
    },
  },
  ProdutoMercadoLivre: {
    select: {
      mlItemId: true,
      mlAvailableQuantity: true,
      mlSoldQuantity: true,
      mlSold90Days: true,
      mlShippingMode: true,
      mlStatus: true,
      mlThumbnail: true,
    },
  },
} satisfies Prisma.ProdutoInclude;

type ProdutoComRelacoes = Prisma.ProdutoGetPayload<{
  include: typeof produtoListInclude;
}>;

function enriquecerProduto(produto: ProdutoComRelacoes, verCusto: boolean) {
  const totalVendas90d = produto.ProdutoMercadoLivre.reduce(
    (sum, ml) => sum + (ml.mlSold90Days || 0),
    0
  );

  const estoqueFullTotal = produto.ProdutoMercadoLivre.filter(
    (ml) => ml.mlShippingMode === "fulfillment"
  ).reduce((sum, ml) => sum + (ml.mlAvailableQuantity || 0), 0);

  const estoqueMLTotal = produto.ProdutoMercadoLivre.reduce(
    (sum, ml) => sum + (ml.mlAvailableQuantity || 0),
    0
  );

  const estoqueLocalTotal = produto.estoques.reduce(
    (sum, estoque) => sum + estoque.quantidade,
    0
  );

  const fornecedorPrincipal =
    produto.fornecedores.find((f) => f.principal) ?? produto.fornecedores[0];

  const imagemResolvida = normalizeImageUrl(
    produto.imagemUrl ??
      produto.ProdutoMercadoLivre.find((ml) => ml.mlThumbnail)?.mlThumbnail ??
      null
  );

  return {
    ...produto,
    custoMedio: verCusto ? produto.custoMedio : null,
    custoOrigem: verCusto ? produto.custoOrigem : null,
    custoAtualizadoEm: verCusto ? produto.custoAtualizadoEm : null,
    custoFreteManual: verCusto ? produto.custoFreteManual : null,
    custoEmbalagem: verCusto ? produto.custoEmbalagem : null,
    componentes: produto.componentes.map((componente) => ({
      ...componente,
      produto: { ...componente.produto, custoMedio: verCusto ? componente.produto.custoMedio : null },
    })),
    fornecedores: produto.fornecedores.map((fornecedor) => ({
      ...fornecedor,
      preco: verCusto ? fornecedor.preco : null,
      precoUnitario: verCusto ? fornecedor.precoUnitario : null,
    })),
    imagemUrl: imagemResolvida,
    _mlTotalVendas: totalVendas90d,
    _mlEstoqueFull: estoqueFullTotal,
    _mlEstoqueTotal: estoqueMLTotal,
    _estoqueLocalTotal: estoqueLocalTotal,
    _vinculadoML: produto.ProdutoMercadoLivre.length > 0,
    fornecedorPrincipal: fornecedorPrincipal
      ? {
          id: fornecedorPrincipal.fornecedor.id,
          nome: fornecedorPrincipal.fornecedor.nome,
          prazoEntregaDias: fornecedorPrincipal.prazoEntregaDias,
          precoUnitario: verCusto ? fornecedorPrincipal.precoUnitario : null,
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sku = searchParams.get("sku");
  const id = searchParams.get("id");
  const search = searchParams.get("search");

  try {
    const user = await verifyUserAtivo(req);
    const verCusto = podeVer(user.role, "VER_CUSTO");

    if (id) {
      const produto = await prisma.produto.findUnique({
        where: {
          id,
          userId: user.contaId,
        },
        include: produtoListInclude,
      });

      if (!produto) {
        return NextResponse.json(
          { error: "Produto não encontrado" },
          { status: 404 }
        );
      }

      return NextResponse.json(
        serializeWithEAN(enriquecerProduto(produto, verCusto))
      );
    }

    const where: Prisma.ProdutoWhereInput = { userId: user.contaId };

    if (search) {
      where.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    } else if (sku) {
      where.sku = { contains: normalizeSku(sku), mode: "insensitive" };
    }

    const produtos = await prisma.produto.findMany({
      where,
      include: produtoListInclude,
    });

    const produtosComDados = produtos
      .map((produto) => enriquecerProduto(produto, verCusto))
      .sort((a, b) => b._mlTotalVendas - a._mlTotalVendas);

    return NextResponse.json(serializeWithEAN(produtosComDados));
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao buscar produtos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produtos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);
    exigirPermissao(user.role, "EDITAR_PRODUTO");

    const body = await req.json();
    const {
      nome,
      sku: skuBruto,
      ean,
      componentes,
      isKit = false,
      descricao,
      marca,
      categoria,
      pesoGramas,
      alturaCm,
      larguraCm,
      comprimentoCm,
    } = body;

    if (!nome || !skuBruto) {
      return new Response(
        JSON.stringify({ error: "Nome e SKU são obrigatórios" }),
        { status: 400 }
      );
    }

    const sku = normalizeSku(skuBruto);

    const existingProduto = await prisma.produto.findFirst({
      where: {
        sku,
        userId: user.contaId,
      },
    });

    if (existingProduto) {
      return new Response(
        JSON.stringify({ error: `Já existe um produto com o SKU "${sku}"` }),
        { status: 400 }
      );
    }

    if (isKit || (componentes && componentes.length > 0)) {
      const novoKit = await prisma.produto.create({
        data: {
          userId: user.contaId,
          nome,
          sku,
          ean: prepareBigIntEAN(ean),
          isKit: true,
          componentes: {
            create: componentes.map(
              (componente: { quantidade: number; produtoId: string }) => ({
                quantidade: componente.quantidade,
                produto: {
                  connect: { id: componente.produtoId },
                },
              })
            ),
          },
        },
        include: {
          componentes: {
            include: {
              produto: true,
            },
          },
        },
      });

      if (componentes && componentes.length > 0) {
        for (const componente of componentes) {
          await prisma.estoque.updateMany({
            where: { produtoId: componente.produtoId },
            data: { quantidade: { decrement: componente.quantidade } },
          });
        }
      }

      return new Response(JSON.stringify(serializeWithEAN(novoKit)), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      const novoProduto = await prisma.produto.create({
        data: {
          userId: user.contaId,
          nome,
          sku,
          ean: safeEANConversion(ean),
          isKit: false,
          descricao: descricao || null,
          marca: marca || null,
          categoria: categoria || null,
          pesoGramas: pesoGramas ?? null,
          alturaCm: alturaCm ?? null,
          larguraCm: larguraCm ?? null,
          comprimentoCm: comprimentoCm ?? null,
        },
      });
      return new Response(JSON.stringify(serializeWithEAN(novoProduto)), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao criar produto ou kit:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar produto ou kit" }),
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);
    exigirPermissao(user.role, "EDITAR_PRODUTO");
    const body = await req.json();

    const {
      id,
      nome,
      sku: skuBruto,
      ean,
      descricao,
      marca,
      categoria,
      pesoGramas,
      alturaCm,
      larguraCm,
      comprimentoCm,
      ativo,
      custoMedio,
    } = body;
    if (!id || !nome || !skuBruto) {
      return NextResponse.json(
        {
          error: "ID, Nome, SKU são obrigatórios",
        },
        { status: 400 }
      );
    }

    const produtoExistente = await prisma.produto.findFirst({
      where: { id, userId: user.contaId },
    });

    if (!produtoExistente) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    let dadosCusto: { custoMedio: number; custoOrigem: "MANUAL" } | undefined;
    if (custoMedio !== undefined) {
      exigirPermissao(user.role, "VER_CUSTO");
      if (
        custoMedio !== null &&
        (typeof custoMedio !== "number" || !Number.isFinite(custoMedio) || custoMedio < 0)
      ) {
        return NextResponse.json(
          { error: "custoMedio deve ser um número em centavos, maior ou igual a zero" },
          { status: 400 }
        );
      }
      if (custoMedio !== null) {
        dadosCusto = { custoMedio: Math.round(custoMedio), custoOrigem: "MANUAL" };
      }
    }

    const sku = normalizeSku(skuBruto);

    if (sku !== produtoExistente.sku) {
      const skuEmUso = await prisma.produto.findFirst({
        where: { sku, userId: user.contaId, NOT: { id } },
      });

      if (skuEmUso) {
        return NextResponse.json(
          { error: `Já existe um produto com o SKU "${sku}"` },
          { status: 400 }
        );
      }
    }

    const produtoAtualizado = await prisma.produto.update({
      where: { id },
      data: {
        nome,
        sku,
        ean: safeEANConversion(ean),
        descricao: descricao || null,
        marca: marca || null,
        categoria: categoria || null,
        pesoGramas: pesoGramas ?? null,
        alturaCm: alturaCm ?? null,
        larguraCm: larguraCm ?? null,
        comprimentoCm: comprimentoCm ?? null,
        ...(typeof ativo === "boolean" ? { ativo } : {}),
        ...dadosCusto,
      },
    });
    if (dadosCusto) await atualizarCustoDasVendasAposMudanca(user.contaId, [id]);
    return new Response(JSON.stringify(serializeWithEAN(produtoAtualizado)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao atualizar produto:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar produto" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
    exigirPermissao(user.role, "EDITAR_PRODUTO");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const forceDelete = searchParams.get("forceDelete") === "true";

    if (!id) {
      return NextResponse.json(
        { message: "ID do produto é obrigatório" },
        { status: 400 }
      );
    }

    const produto = await prisma.produto.findFirst({
      where: {
        id,
        userId: user.contaId,
      },
      include: {
        _count: {
          select: {
            componentes: true,
            estoques: true,
            pedidos: true,
            saidas: true,
          },
        },
      },
    });

    if (!produto) {
      return NextResponse.json(
        { message: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const hasVinculos =
      produto._count.componentes > 0 ||
      produto._count.estoques > 0 ||
      produto._count.pedidos > 0 ||
      produto._count.saidas > 0;

    if (hasVinculos && !forceDelete) {
      return NextResponse.json(
        {
          message: "Produto possui vínculos ativos",
          hasVinculos: true,
          vinculos: {
            hasKits: produto._count.componentes > 0,
            hasEstoque: produto._count.estoques > 0,
            hasPedidos: produto._count.pedidos > 0,
            hasSaidas: produto._count.saidas > 0,
          },
        },
        { status: 409 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.componente.deleteMany({
        where: { produtoId: id },
      });

      await tx.componente.deleteMany({
        where: { kitId: id },
      });

      await tx.detalhesSaida.deleteMany({
        where: { produtoId: id },
      });

      await tx.saida.deleteMany({
        where: { produtoId: id },
      });

      await tx.pedidoProduto.deleteMany({
        where: { produtoId: id },
      });

      await tx.estoque.deleteMany({
        where: { produtoId: id },
      });

      await tx.produtoFornecedor.deleteMany({
        where: { produtoId: id },
      });

      await tx.produto.delete({
        where: { id },
      });
    });

    return NextResponse.json(
      { message: "Produto excluído com sucesso" },
      { status: 200 }
    );
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao excluir produto:", error);
    return NextResponse.json(
      { message: "Erro ao excluir produto" },
      { status: 500 }
    );
  }
}
