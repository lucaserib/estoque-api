// src/app/api/produtos/route.ts
import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

// Função para serializar BigInt como string de forma segura
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

// Função melhorada para converter EAN para BigInt de forma segura
const safeEANConversion = (ean: string | null): bigint | null => {
  if (!ean) return null;
  if (ean === "") return null;

  // Remove caracteres não numéricos
  const cleanEAN = String(ean).replace(/[^0-9]/g, "");

  // Se não houver dígitos após a limpeza, retorna null
  if (!cleanEAN) return null;

  try {
    return BigInt(cleanEAN);
  } catch (error) {
    console.error("Erro ao converter EAN para BigInt:", error);
    return null;
  }
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sku = searchParams.get("sku");
  const armazemId = searchParams.get("armazemId");
  const id = searchParams.get("id");
  const search = searchParams.get("search"); // Novo parâmetro para busca

  try {
    const user = await verifyUser(req);
    let produtos = [];

    if (id) {
      // Buscar um produto específico pelo ID
      const produto = await prisma.produto.findUnique({
        where: {
          id: id,
          userId: user.id,
        },
        include: {
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
        },
      });

      return new Response(JSON.stringify(serializeBigInt(produto)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (search) {
      // Busca por termo em nome ou SKU
      produtos = await prisma.produto.findMany({
        where: {
          OR: [
            {
              nome: {
                contains: search,
                mode: "insensitive", // Case insensitive
              },
            },
            {
              sku: {
                contains: search,
                mode: "insensitive", // Case insensitive
              },
            },
          ],
          userId: user.id,
        },
        include: {
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
        },
      });
    } else if (sku) {
      produtos = await prisma.produto.findMany({
        where: {
          sku: {
            contains: sku,
          },
          userId: user.id,
        },
        include: {
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
        },
      });
    } else {
      produtos = await prisma.produto.findMany({
        where: {
          userId: user.id,
        },
        include: {
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
        },
      });
    }

    return new Response(JSON.stringify(serializeBigInt(produtos)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    return new Response(JSON.stringify({ error: "Erro ao buscar produtos" }), {
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);

    const body = await req.json();
    const { nome, sku, ean, componentes, isKit = false } = body;

    if (!nome || !sku) {
      return new Response(
        JSON.stringify({ error: "Nome e SKU são obrigatórios" }),
        { status: 400 }
      );
    }

    const existingProduto = await prisma.produto.findFirst({
      where: {
        sku,
        userId: user.id,
      },
    });

    if (existingProduto) {
      return new Response(JSON.stringify({ error: "SKU já existe" }), {
        status: 400,
      });
    }

    if (isKit || (componentes && componentes.length > 0)) {
      // Criar um kit
      const novoKit = await prisma.produto.create({
        data: {
          userId: user.id,
          nome,
          sku,
          ean: safeEANConversion(ean),
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

      return new Response(JSON.stringify(serializeBigInt(novoKit)), {
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
        },
      });
      return new Response(JSON.stringify(serializeBigInt(novoProduto)), {
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

    const { id, nome, sku, ean } = body;
    if (!id || !nome || !sku) {
      return NextResponse.json(
        {
          error: "ID, Nome, SKU são obrigatórios",
        },
        { status: 400 }
      );
    }

    const produtoAtualizado = await prisma.produto.update({
      where: { id },
      data: {
        nome,
        sku,
        ean: safeEANConversion(ean),
      },
    });
    return new Response(JSON.stringify(serializeBigInt(produtoAtualizado)), {
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
