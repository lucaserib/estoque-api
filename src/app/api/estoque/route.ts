import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const produtoId = searchParams.get("produtoId");
    const armazemId = searchParams.get("armazemId");

    // Validação dos parâmetros
    if (!produtoId || !armazemId) {
      return NextResponse.json(
        { message: "Produto e armazém são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se o armazém pertence ao usuário
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

    // Verificar se existe estoque para o produto no armazém
    const estoque = await prisma.estoque.findUnique({
      where: {
        produtoId_armazemId: {
          produtoId,
          armazemId,
        },
      },
    });

    if (!estoque) {
      return NextResponse.json(
        { message: "Estoque não encontrado para este produto no armazém" },
        { status: 404 }
      );
    }

    // Verificar se existem saídas registradas para este produto no armazém
    const saidas = await prisma.saida.findFirst({
      where: {
        produtoId,
        armazemId,
      },
    });

    if (saidas) {
      return NextResponse.json(
        {
          message:
            "Não é possível excluir o estoque pois existem saídas registradas",
          hasVinculos: true,
        },
        { status: 409 }
      );
    }

    // Excluir o estoque
    await prisma.estoque.delete({
      where: {
        produtoId_armazemId: {
          produtoId,
          armazemId,
        },
      },
    });

    return NextResponse.json(
      { message: "Estoque excluído com sucesso" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao excluir estoque:", error);
    return NextResponse.json(
      { message: "Erro ao excluir estoque" },
      { status: 500 }
    );
  }
}
