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
      valorUnitario,
    }: {
      armazemId: number;
      produtoId: number;
      quantidade: number;
      valorUnitario: number;
    } = body;

    if (!armazemId || !produtoId || !quantidade || !valorUnitario) {
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
        valorUnitario,
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

// Função para tratar requisições PUT
export async function PUT(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const body = await request.json();
    const {
      armazemId,
      produtoId,
      quantidade,
      valorUnitario,
    }: {
      armazemId: number;
      produtoId: number;
      quantidade: number;
      valorUnitario: number;
    } = body;

    if (!armazemId || !produtoId || !quantidade || !valorUnitario) {
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
        valorUnitario,
      },
      include: { produto: true },
    });

    return NextResponse.json(estoque, { status: 200 });
  } catch (error) {
    console.error("Erro ao atualizar estoque:", error);
    return NextResponse.json(
      { message: "Erro ao atualizar estoque" },
      { status: 500 }
    );
  }
}

// Função para tratar requisições DELETE
export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const body = await request.json();
    const { armazemId, produtoId }: { armazemId: number; produtoId?: number } =
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

    // Caso tenha produtoId, deleta o estoque específico
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
      // Deleta o armazém se apenas o armazemId for fornecido
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
