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

const calcularCustoMedioPonderado = async (
  produtoId: string,
  novaQuantidade: number,
  novoCusto: number
) => {
  try {
    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: { custoMedio: true },
    });

    const estoques = await prisma.estoque.findMany({
      where: { produtoId },
      select: { quantidade: true },
    });

    const quantidadeAtual = estoques.reduce(
      (total, estoque) => total + estoque.quantidade,
      0
    );

    const custoMedioAtual = produto?.custoMedio || 0;

    // Se não há estoque anterior ou o custo médio atual é zero,
    // significa que é a primeira compra do produto
    if (quantidadeAtual === 0 || custoMedioAtual === 0) {
      console.log(
        "Primeira compra do produto - definindo custo médio como:",
        novoCusto
      );
      return novoCusto;
    }

    const valorTotal =
      quantidadeAtual * custoMedioAtual + novaQuantidade * novoCusto;
    const quantidadeTotal = quantidadeAtual + novaQuantidade;

    if (quantidadeTotal <= 0) return 0;

    const novoCustoMedio = Math.round(valorTotal / quantidadeTotal);

    console.log({
      quantidadeAtual,
      custoMedioAtual,
      valorEstoqueAtual: quantidadeAtual * custoMedioAtual,
      novaQuantidade,
      novoCusto,
      valorNovoEstoque: novaQuantidade * novoCusto,
      quantidadeTotal,
      valorTotal,
      novoCustoMedio,
    });

    return novoCustoMedio;
  } catch (error) {
    console.error("Erro ao calcular custo médio ponderado:", error);
    throw error;
  }
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
            custo: Math.round(produto.custo),
            multiplicador: produto.multiplicador || 1,
          })),
        },
      },
      include: {
        fornecedor: true,
        produtos: {
          include: {
            produto: true,
          },
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
  try {
    const user = await verifyUser(request);
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
      orderBy: {
        id: "desc",
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
      include: {
        produtos: true,
        fornecedor: true,
      },
    });

    if (!pedidoExiste) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    if (pedidoExiste.userId !== user.id) {
      return NextResponse.json(
        { error: "Não autorizado a modificar este pedido" },
        { status: 403 }
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

          const novoCustoMedio = await calcularCustoMedioPonderado(
            produtoRecebido.produtoId,
            quantidadeFinal,
            produtoRecebido.custo
          );
          await prisma.produto.update({
            where: { id: produtoRecebido.produtoId },
            data: { custoMedio: novoCustoMedio },
          });
        }
      })
    );

    let novoPedidoId = null;
    if (produtosNaoRecebidos.length > 0) {
      const novoPedido = await prisma.pedidoCompra.create({
        data: {
          userId: user.id,
          fornecedorId: pedidoExiste.fornecedorId,
          comentarios: `Produtos não recebidos do pedido #${pedidoExiste.id}`,
          status: "pendente",
          produtos: {
            create: produtosNaoRecebidos.map((produto) => ({
              produtoId: produto.produtoId,
              quantidade: produto.quantidade,
              custo: produto.custo,
              multiplicador: produto.multiplicador || 1,
            })),
          },
        },
      });

      novoPedidoId = novoPedido.id;
    }

    const pedidoAtualizado = await prisma.pedidoCompra.update({
      where: { id: pedidoId },
      data: {
        status: "confirmado",
        armazemId,
        dataConclusao: new Date(),
        comentarios:
          comentarios !== undefined ? comentarios : pedidoExiste.comentarios,
      },
      include: {
        produtos: {
          include: {
            produto: true,
          },
        },
        fornecedor: true,
      },
    });

    return NextResponse.json({
      message: "Pedido confirmado e estoque atualizado com sucesso",
      pedido: serializeBigInt(pedidoAtualizado),
      novoPedidoId,
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

    const pedido = await prisma.pedidoCompra.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      return NextResponse.json(
        { error: "Pedido não encontrado" },
        { status: 404 }
      );
    }

    if (pedido.userId !== user.id) {
      return NextResponse.json(
        { error: "Não autorizado a excluir este pedido" },
        { status: 403 }
      );
    }

    await prisma.pedidoProduto.deleteMany({ where: { pedidoId } });

    await prisma.pedidoCompra.delete({ where: { id: pedidoId } });

    return NextResponse.json({
      message: "Pedido deletado com sucesso",
      pedidoId,
    });
  } catch (error) {
    console.error("Erro ao deletar pedido:", error);
    return NextResponse.json(
      { error: "Erro ao deletar pedido" },
      { status: 500 }
    );
  }
}
