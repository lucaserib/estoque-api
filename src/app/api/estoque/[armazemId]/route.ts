import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const armazemId = req.url.split("/").pop(); // Captura o último segmento da URL

  if (!armazemId) {
    console.error("ID do armazém não fornecido");
    return NextResponse.json(
      { error: "ID do armazém não fornecido" },
      { status: 400 }
    );
  }

  try {
    const estoque = await prisma.estoque.findMany({
      where: { armazemId: armazemId },
      include: { produto: true },
    });

    if (!estoque.length) {
      return NextResponse.json([], { status: 200 });
    }

    const serializedEstoque = estoque.map((item) => ({
      produtoId: item.produtoId,
      armazemId: item.armazemId,
      quantidade: item.quantidade,
      estoqueSeguranca: item.estoqueSeguranca ?? 0,
      produto: {
        id: item.produto.id,
        nome: item.produto.nome,
        sku: item.produto.sku,
        isKit: item.produto.isKit,
        custoMedio: item.produto.custoMedio
          ? Number(item.produto.custoMedio)
          : null,
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
