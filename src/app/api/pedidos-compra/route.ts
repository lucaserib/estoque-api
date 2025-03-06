import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

const calcularCustoMedio = async (produtoId: string) => {
  const pedidos = await prisma.pedidoProduto.findMany({
    where: { produtoId },
    select: { quantidade: true, custo: true },
  });

  const totalValor = pedidos.reduce(
    (acc, pedido) => acc + pedido.quantidade * (pedido.custo / 100),
    0
  );
  const totalQuantidade = pedidos.reduce(
    (acc, pedido) => acc + pedido.quantidade,
    0
  );

  return totalQuantidade > 0
    ? Math.round((totalValor / totalQuantidade) * 100)
    : 0;
};

interface ProdutoRecebido {
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador?: number;
}

interface RequestBodyPost {
  fornecedorId: string;
  produtos: ProdutoRecebido[];
  comentarios?: string;
  dataPrevista?: string;
}

interface RequestBodyPut {
  pedidoId: number;
  armazemId: string;
  produtosRecebidos: ProdutoRecebido[];
  comentarios?: string;
}

interface RequestBodyDelete {
  pedidoId: number;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBodyPost = await request.json();
    const { fornecedorId, produtos, comentarios, dataPrevista } = body;

    if (!fornecedorId || !produtos || produtos.length === 0) {
      return NextResponse.json(
        { error: "Fornecedor e produtos são obrigatórios" },
        { status: 400 }
      );
    }

    for (const produto of produtos) {
      if (!Number.isInteger(produto.custo) || produto.custo < 0) {
        return NextResponse.json(
          { error: "Custo deve ser um valor inteiro não-negativo em centavos" },
          { status: 400 }
        );
      }
    }

    const pedido = await prisma.pedidoCompra.create({
      data: {
        userId: user.id,
        fornecedorId,
        comentarios,
        status: "pendente",
        dataPrevista: dataPrevista ? new Date(dataPrevista) : null,
        produtos: {
          create: produtos.map((produto) => ({
            produtoId: produto.produtoId,
            quantidade: produto.quantidade,
            custo: produto.custo,
            multiplicador: produto.multiplicador || 1, // Salva o multiplicador
          })),
        },
      },
    });

    return NextResponse.json(serializeBigInt(pedido), { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido de compra:", error);
    return NextResponse.json(
      { error: "Erro ao criar pedido de compra" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const user = await verifyUser(request);
  try {
    const pedidos = await prisma.pedidoCompra.findMany({
      where: { userId: user.id },
      include: {
        produtos: {
          include: {
            produto: true,
          },
        },
        fornecedor: true,
      },
    });

    return NextResponse.json(serializeBigInt(pedidos), { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    return NextResponse.json(
      { error: "Erro ao buscar pedidos" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBodyPut = await request.json();
    const { pedidoId, armazemId, produtosRecebidos, comentarios } = body;

    if (!pedidoId || !armazemId || !produtosRecebidos) {
      return NextResponse.json(
        { error: "Pedido, armazém e produtos recebidos são obrigatórios" },
        { status: 400 }
      );
    }

    for (const produto of produtosRecebidos) {
      if (!Number.isInteger(produto.custo) || produto.custo < 0) {
        return NextResponse.json(
          { error: "Custo deve ser um valor inteiro não-negativo em centavos" },
          { status: 400 }
        );
      }
    }

    const armazemExiste = await prisma.armazem.findUnique({
      where: { id: armazemId },
    });
    if (!armazemExiste) {
      return NextResponse.json(
        { error: "Armazém não encontrado" },
        { status: 404 }
      );
    }

    const pedidoExiste = await prisma.pedidoCompra.findUnique({
      where: { id: pedidoId },
      include: { produtos: true },
    });
    if (!pedidoExiste) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    const produtosNaoRecebidos: ProdutoRecebido[] = [];

    await Promise.all(
      produtosRecebidos.map(async (produtoRecebido) => {
        const produtoPedido = pedidoExiste.produtos.find(
          (produto) => produto.produtoId === produtoRecebido.produtoId
        );

        if (produtoPedido) {
          const quantidadeNaoRecebida =
            produtoPedido.quantidade - produtoRecebido.quantidade;
          if (quantidadeNaoRecebida > 0) {
            produtosNaoRecebidos.push({
              produtoId: produtoPedido.produtoId,
              quantidade: quantidadeNaoRecebida,
              custo: produtoPedido.custo,
              multiplicador: produtoPedido.multiplicador,
            });
          }

          await prisma.pedidoProduto.update({
            where: { id: produtoPedido.id },
            data: {
              quantidade: produtoRecebido.quantidade,
              custo: produtoRecebido.custo,
              multiplicador:
                produtoRecebido.multiplicador ||
                produtoPedido.multiplicador ||
                1,
            },
          });

          const estoqueExiste = await prisma.estoque.findFirst({
            where: { produtoId: produtoRecebido.produtoId, armazemId },
          });

          const quantidadeFinal =
            produtoRecebido.quantidade *
            (produtoRecebido.multiplicador || produtoPedido.multiplicador || 1);

          if (estoqueExiste) {
            await prisma.estoque.update({
              where: {
                produtoId_armazemId: {
                  produtoId: produtoRecebido.produtoId,
                  armazemId,
                },
              },
              data: { quantidade: { increment: quantidadeFinal } },
            });
          } else {
            await prisma.estoque.create({
              data: {
                produtoId: produtoRecebido.produtoId,
                armazemId,
                quantidade: quantidadeFinal,
              },
            });
          }

          const custoMedio = await calcularCustoMedio(
            produtoRecebido.produtoId
          );
          await prisma.produto.update({
            where: { id: produtoRecebido.produtoId },
            data: { custoMedio },
          });
        }
      })
    );

    if (produtosNaoRecebidos.length > 0) {
      await prisma.pedidoCompra.create({
        data: {
          userId: user.id,
          fornecedorId: pedidoExiste.fornecedorId,
          comentarios: "Produtos Não recebidos do pedido #" + pedidoExiste.id,
          status: "pendente",
          produtos: {
            create: produtosNaoRecebidos.map((produto) => ({
              produtoId: produto.produtoId,
              quantidade: produto.quantidade,
              custo: produto.custo,
              multiplicador: produto.multiplicador || 1, // Mantém o multiplicador
            })),
          },
        },
      });
    }

    await prisma.pedidoCompra.update({
      where: { id: pedidoId },
      data: {
        status: "confirmado",
        armazemId,
        dataConclusao: new Date(),
        ...(comentarios && { comentarios }),
      },
    });

    return NextResponse.json({
      message: "Pedido confirmado e estoque atualizado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao confirmar pedido:", error);
    return NextResponse.json(
      { error: "Erro ao confirmar pedido e atualizar estoque" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBodyDelete = await request.json();
    const { pedidoId } = body;

    if (!pedidoId) {
      return NextResponse.json(
        { error: "ID do pedido é obrigatório" },
        { status: 400 }
      );
    }

    await prisma.pedidoProduto.deleteMany({ where: { pedidoId } });
    await prisma.pedidoCompra.delete({ where: { id: pedidoId } });

    return NextResponse.json({ message: "Pedido deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar pedido:", error);
    return NextResponse.json(
      { error: "Erro ao deletar pedido" },
      { status: 500 }
    );
  }
}
