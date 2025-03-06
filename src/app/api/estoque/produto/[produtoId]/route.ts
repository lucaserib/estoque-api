// app/api/estoque/produto/[produtoId]/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const produtoId = req.url.split("/").pop();

  if (!produtoId) {
    console.error("ID do produto inválido:", produtoId);
    return NextResponse.json(
      { error: "ID do produto inválido" },
      { status: 400 }
    );
  }

  try {
    const estoque = await prisma.estoque.findMany({
      where: { produtoId: produtoId },
      include: { armazem: true }, // Inclui informações do armazém
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
    console.error("Erro ao buscar estoque por produto:", error);
    return NextResponse.json(
      { error: "Erro ao buscar estoque" },
      { status: 500 }
    );
  }
}
