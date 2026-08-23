import { verifyUser } from "@/helpers/verifyUser";
import { NextRequest, NextResponse } from "next/server";
import { serializeWithEAN } from "@/utils/api";
import { prepareBigIntEAN } from "@/utils/api";
import { prisma } from "@/lib/prisma";
import { normalizeSku } from "@/lib/sku";
import { Prisma } from "@prisma/client";

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

function enriquecerProduto(produto: ProdutoComRelacoes) {
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

  const imagemResolvida =
    produto.imagemUrl ??
    produto.ProdutoMercadoLivre.find((ml) => ml.mlThumbnail)?.mlThumbnail ??
    null;

  return {
    ...produto,
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
          precoUnitario: fornecedorPrincipal.precoUnitario,
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
    const user = await verifyUser(req);

    if (id) {
      const produto = await prisma.produto.findUnique({
        where: {
          id,
          userId: user.id,
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
        serializeWithEAN(enriquecerProduto(produto))
      );
    }

    const where: Prisma.ProdutoWhereInput = { userId: user.id };

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
      .map(enriquecerProduto)
      .sort((a, b) => b._mlTotalVendas - a._mlTotalVendas);

    return NextResponse.json(serializeWithEAN(produtosComDados));
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produtos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);

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
        userId: user.id,
      },
    });

    if (existingProduto) {
      return new Response(
        JSON.stringify({ error: `Já existe um produto com o SKU "${sku}"` }),
        { status: 400 }
      );
    }

    if (isKit || (componentes && componentes.length > 0)) {
      // Criar um kit
      const novoKit = await prisma.produto.create({
        data: {
          userId: user.id,
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

      // Atualizar o estoque dos componentes (opcional - depende da regra de negócio)
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
      // Criar um produto simples
      const novoProduto = await prisma.produto.create({
        data: {
          userId: user.id,
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
    console.error("Erro ao criar produto ou kit:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar produto ou kit" }),
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await verifyUser(req);
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
      where: { id, userId: user.id },
    });

    if (!produtoExistente) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const sku = normalizeSku(skuBruto);

    if (sku !== produtoExistente.sku) {
      const skuEmUso = await prisma.produto.findFirst({
        where: { sku, userId: user.id, NOT: { id } },
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
      },
    });
    return new Response(JSON.stringify(serializeWithEAN(produtoAtualizado)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar produto" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const forceDelete = searchParams.get("forceDelete") === "true";

    if (!id) {
      return NextResponse.json(
        { message: "ID do produto é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se o produto pertence ao usuário
    const produto = await prisma.produto.findFirst({
      where: {
        id,
        userId: user.id,
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

    // Verificar vínculos
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

    // Excluir o produto e seus vínculos em uma transação
    await prisma.$transaction(async (tx) => {
      // Primeiro, excluir os componentes onde este produto é usado como componente
      await tx.componente.deleteMany({
        where: { produtoId: id },
      });

      // Depois, excluir os componentes onde este produto é um kit
      await tx.componente.deleteMany({
        where: { kitId: id },
      });

      // Excluir detalhes de saída
      await tx.detalhesSaida.deleteMany({
        where: { produtoId: id },
      });

      // Excluir saídas
      await tx.saida.deleteMany({
        where: { produtoId: id },
      });

      // Excluir pedidos de compra
      await tx.pedidoProduto.deleteMany({
        where: { produtoId: id },
      });

      // Excluir estoque
      await tx.estoque.deleteMany({
        where: { produtoId: id },
      });

      // Excluir vínculos com fornecedores
      await tx.produtoFornecedor.deleteMany({
        where: { produtoId: id },
      });

      // Por fim, excluir o produto
      await tx.produto.delete({
        where: { id },
      });
    });

    return NextResponse.json(
      { message: "Produto excluído com sucesso" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    return NextResponse.json(
      { message: "Erro ao excluir produto" },
      { status: 500 }
    );
  }
}
