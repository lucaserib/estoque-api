import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  req: Request,
  { params }: { params: { armazemId: string } }
) {
  const armazemId = Number(params.armazemId);

  if (isNaN(armazemId)) {
    console.error("ID do armazém inválido:", params.armazemId);
    return NextResponse.json(
      { error: "ID do armazém inválido" },
      { status: 400 }
    );
  }

  try {
    const estoque = await prisma.estoque.findMany({
      where: { armazemId },
      include: { produto: true },
    });

    console.log("Estoque encontrado no banco:", estoque);

    if (!estoque.length) {
      console.warn("Nenhum produto encontrado para este armazém.");
      return NextResponse.json([], { status: 200 });
    }

    const serializedEstoque = estoque.map((item) => ({
      produtoId: item.produtoId,
      armazemId: item.armazemId,
      quantidade: item.quantidade,
      valorUnitario: item.valorUnitario,
      estoqueSeguranca: item.estoqueSeguranca ?? 0,
      produto: {
        id: item.produto.id,
        nome: item.produto.nome,
        sku: item.produto.sku,
        isKit: item.produto.isKit,
        ean: item.produto.ean ? item.produto.ean.toString() : null,
        userId: item.produto.userId,
      },
    }));

    return NextResponse.json(serializedEstoque);
  } catch (error) {
    console.error("Erro ao buscar estoque:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estoque" },
      { status: 500 }
    );
  }
}
