import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function PUT(request: Request) {
  const body = await request.json();
  const { produtoId, armazemId, estoqueSeguranca } = body;

  // Validação de tipos mais rigorosa
  if (typeof produtoId !== "string") {
    return NextResponse.json(
      { message: "produtoId deve ser uma string" },
      { status: 400 }
    );
  }

  if (typeof armazemId !== "string") {
    return NextResponse.json(
      { message: "armazemId deve ser uma string" },
      { status: 400 }
    );
  }

  if (typeof estoqueSeguranca !== "number") {
    return NextResponse.json(
      {
        message: "estoqueSeguranca deve ser um número",
        received: estoqueSeguranca,
        type: typeof estoqueSeguranca,
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
    console.error("Erro ao atualizar estoque de segurança:", error);
    return NextResponse.json(
      {
        message: "Erro ao atualizar estoque de segurança",
        error: String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
