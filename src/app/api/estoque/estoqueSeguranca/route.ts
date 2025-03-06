import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function PUT(request: Request) {
  const body = await request.json();
  const { produtoId, armazemId, estoqueSeguranca } = body;

  if (
    typeof produtoId !== "string" ||
    typeof armazemId !== "string" ||
    typeof estoqueSeguranca !== "number"
  ) {
    return NextResponse.json(
      {
        message:
          "Produto ID, Armazém ID e estoque de segurança devem ser números válidos",
      },
      { status: 400 }
    );
  }

  try {
    const existingEstoque = await prisma.estoque.findUnique({
      where: { produtoId_armazemId: { produtoId, armazemId } },
    });

    if (!existingEstoque) {
      return NextResponse.json(
        { message: "Estoque não encontrado" },
        { status: 404 }
      );
    }

    const estoque = await prisma.estoque.update({
      where: { produtoId_armazemId: { produtoId, armazemId } },
      data: { estoqueSeguranca },
    });

    return NextResponse.json(estoque);
  } catch (error) {
    return NextResponse.json(
      { message: "Erro ao atualizar estoque de segurança" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
