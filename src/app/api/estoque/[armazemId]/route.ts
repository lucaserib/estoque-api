import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { armazemId: string } }
) {
  const { armazemId } = params;

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

    return NextResponse.json(estoque);
  } catch (error) {
    console.error("Erro ao buscar estoque:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estoque" },
      { status: 500 }
    );
  }
}
