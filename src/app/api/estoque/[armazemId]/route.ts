import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

export async function GET(
  request: Request,
  { params }: { params: { armazemId: string } }
) {
  const { armazemId } = await params;

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

    return new Response(JSON.stringify(serializeBigInt(estoque)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar estoque:", error);
    return new Response(JSON.stringify({ error: "Erro ao buscar armazens" }), {
      status: 500,
    });
  }
}
