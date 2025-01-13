import { NextResponse } from "next/server";
import type { NextRequest } from "next/server"; // Import explícito para tipagem
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Função para serializar BigInt
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

// Handler para o método GET
export async function GET(
  request: NextRequest,
  context: { params: { armazemId: string } }
) {
  const { armazemId } = context.params;

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

    return NextResponse.json(serializeBigInt(estoque), {
      status: 200,
    });
  } catch (error) {
    console.error("Erro ao buscar estoque:", error);
    return NextResponse.json(
      { error: "Erro ao buscar armazéns" },
      { status: 500 }
    );
  }
}
