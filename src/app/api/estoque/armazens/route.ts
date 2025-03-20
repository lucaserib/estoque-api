import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

// Função para tratar requisições GET
export async function GET(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    const armazens = await prisma.armazem.findMany({
      where: { userId: user.id },
    });
    return NextResponse.json(armazens, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar armazéns:", error);
    return NextResponse.json(
      { error: "Erro ao buscar armazéns" },
      { status: 500 }
    );
  }
}

// Função para tratar requisições POST
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const {
      armazemId,
      produtoId,
      quantidade,
    }: {
      armazemId: string;
      produtoId: string;
      quantidade: number;
    } = body;

    if (!armazemId || !produtoId || !quantidade) {
      return NextResponse.json(
        {
          message:
            "Armazém, produto, quantidade e valor unitário são obrigatórios",
        },
        { status: 400 }
      );
    }

    const armazem = await prisma.armazem.findFirst({
      where: {
        id: armazemId,
        userId: user.id,
      },
    });

    if (!armazem) {
      return NextResponse.json(
        { message: "Armazém não encontrado" },
        { status: 404 }
      );
    }

    const estoque = await prisma.estoque.create({
      data: {
        armazemId,
        produtoId,
        quantidade,
      },
      include: { produto: true },
    });

    return NextResponse.json(estoque, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar estoque:", error);
    return NextResponse.json(
      { message: "Erro ao criar estoque" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const body = await request.json();
    const {
      armazemId,
      produtoId,
      quantidade,
    }: {
      armazemId: string;
      produtoId: string;
      quantidade: number;
    } = body;

    if (!armazemId || !produtoId || !quantidade) {
      return NextResponse.json(
        {
          message:
            "Armazém, produto, quantidade e valor unitário são obrigatórios",
        },
        { status: 400 }
      );
    }

    const armazem = await prisma.armazem.findFirst({
      where: {
        id: armazemId,
        userId: user.id,
      },
    });

    if (!armazem) {
      return NextResponse.json(
        { message: "Armazém não encontrado ou não pertence ao usuário" },
        { status: 404 }
      );
    }

    const estoque = await prisma.estoque.update({
      where: {
        produtoId_armazemId: {
          produtoId,
          armazemId,
        },
      },
      data: {
        quantidade,
      },
      include: { produto: true },
    });

    // Converter valores BigInt para números regulares
    const serializedEstoque = {
      produtoId: estoque.produtoId,
      armazemId: estoque.armazemId,
      quantidade: Number(estoque.quantidade),
      estoqueSeguranca: estoque.estoqueSeguranca
        ? Number(estoque.estoqueSeguranca)
        : null,
      produto: {
        id: estoque.produto.id,
        nome: estoque.produto.nome,
        sku: estoque.produto.sku,
        custoMedio: estoque.produto.custoMedio
          ? Number(estoque.produto.custoMedio)
          : null,
        isKit: estoque.produto.isKit,
        ean: estoque.produto.ean ? estoque.produto.ean.toString() : null,
        userId: estoque.produto.userId,
      },
    };

    return NextResponse.json(serializedEstoque, { status: 200 });
  } catch (error) {
    console.error("Erro ao atualizar estoque:", error);
    return NextResponse.json(
      { message: "Erro ao atualizar estoque" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const body = await request.json();
    const { armazemId, produtoId }: { armazemId: string; produtoId?: string } =
      body;

    if (!armazemId) {
      return NextResponse.json(
        { message: "ID do armazém é obrigatório" },
        { status: 400 }
      );
    }

    const armazem = await prisma.armazem.findFirst({
      where: {
        id: armazemId,
        userId: user.id,
      },
    });

    if (!armazem) {
      return NextResponse.json(
        { message: "Armazém não encontrado ou não pertence ao usuário" },
        { status: 404 }
      );
    }

    if (produtoId) {
      await prisma.estoque.delete({
        where: {
          produtoId_armazemId: {
            produtoId,
            armazemId,
          },
        },
      });

      return NextResponse.json(
        { message: "Estoque deletado com sucesso" },
        { status: 200 }
      );
    } else {
      await prisma.armazem.delete({
        where: {
          id: armazemId,
        },
      });

      return NextResponse.json(
        { message: "Armazém deletado com sucesso" },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Erro ao deletar armazém ou estoque:", error);
    return NextResponse.json(
      { message: "Erro ao deletar armazém ou estoque" },
      { status: 500 }
    );
  }
}
