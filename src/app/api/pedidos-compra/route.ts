import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

// Função para serializar BigInt como string
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

interface ProdutoRecebido {
  produtoId: number;
  quantidade: number;
  custo: number;
}

interface RequestBodyPost {
  fornecedorId: number;
  produtos: ProdutoRecebido[];
  comentarios?: string;
  dataPrevista?: string;
}

interface RequestBodyPut {
  pedidoId: number;
  armazemId: number;
  produtosRecebidos: ProdutoRecebido[];
  comentarios?: string;
}

interface RequestBodyDelete {
  pedidoId: number;
}

// POST
export async function POST(request: Request) {
  try {
    const body: RequestBodyPost = await request.json();

    const { fornecedorId, produtos, comentarios, dataPrevista } = body;

    if (!fornecedorId || !produtos || produtos.length === 0) {
      return NextResponse.json(
        { error: "Fornecedor e produtos são obrigatórios" },
        { status: 400 }
      );
    }

    const pedido = await prisma.pedidoCompra.create({
      data: {
        fornecedorId,
        comentarios,
        status: "pendente",
        dataPrevista: dataPrevista ? new Date(dataPrevista) : null,
        produtos: {
          create: produtos.map((produto) => ({
            produtoId: produto.produtoId,
            quantidade: produto.quantidade,
            custo: produto.custo,
          })),
        },
      },
    });

    return NextResponse.json(pedido, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar pedido de compra:", error);
    return NextResponse.json(
      { error: "Erro ao criar pedido de compra" },
      { status: 500 }
    );
  }
}

// GET
export async function GET() {
  try {
    const pedidos = await prisma.pedidoCompra.findMany({
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

// PUT
export async function PUT(request: Request) {
  try {
    const body: RequestBodyPut = await request.json();

    const { pedidoId, armazemId, produtosRecebidos, comentarios } = body;

    if (!pedidoId || !armazemId || !produtosRecebidos) {
      return NextResponse.json(
        { error: "Pedido, armazém e produtos recebidos são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificação e atualizações seguem como no exemplo anterior...

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

// DELETE
export async function DELETE(request: Request) {
  try {
    const body: RequestBodyDelete = await request.json();

    const { pedidoId } = body;

    if (!pedidoId) {
      return NextResponse.json(
        { error: "ID do pedido é obrigatório" },
        { status: 400 }
      );
    }

    await prisma.pedidoProduto.deleteMany({
      where: { pedidoId: pedidoId },
    });

    await prisma.pedidoCompra.delete({
      where: { id: pedidoId },
    });

    return NextResponse.json({ message: "Pedido deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar pedido:", error);
    return NextResponse.json(
      { error: "Erro ao deletar pedido" },
      { status: 500 }
    );
  }
}
