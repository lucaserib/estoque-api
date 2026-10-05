import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ produtoId: string }> }
) {
  try {
    const user = await verifyUser(request);
    const { produtoId } = await params;

    if (!produtoId) {
      return NextResponse.json(
        { error: "ID do produto inválido" },
        { status: 400 }
      );
    }

    const produto = await prisma.produto.findFirst({
      where: { id: produtoId, userId: user.contaId },
      select: { id: true },
    });

    if (!produto) {
      return NextResponse.json(
        { error: "Produto não encontrado" },
        { status: 404 }
      );
    }

    const estoque = await prisma.estoque.findMany({
      where: { produtoId },
      include: { armazem: true },
    });

    const serializedEstoque = estoque.map((item) => ({
      produtoId: item.produtoId,
      armazemId: item.armazemId,
      quantidade: item.quantidade,
      estoqueSeguranca: item.estoqueSeguranca ?? 0,
      armazem: {
        id: item.armazem.id,
        nome: item.armazem.nome,
      },
    }));

    return NextResponse.json(serializedEstoque);
  } catch (error) {
    if (error instanceof Error && error.message.includes("não autorizado")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Erro ao buscar estoque" },
      { status: 500 }
    );
  }
}
