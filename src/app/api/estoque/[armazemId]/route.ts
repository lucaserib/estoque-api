import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const armazemId = searchParams.get("armazemId");

  if (!armazemId || isNaN(Number(armazemId))) {
    return NextResponse.json(
      { error: "ID do armazém inválido" },
      { status: 400 }
    );
  }

  try {
    const estoque = await prisma.estoque.findMany({
      where: {
        armazemId: Number(armazemId),
      },
      include: {
        produto: true,
      },
    });

    // Convert BigInt values to strings
    const serializedEstoque = estoque.map((item) => ({
      ...item,
      produtoId: item.produtoId.toString(),
      produto: {
        ...item.produto,
        id: item.produto.id.toString(),
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
