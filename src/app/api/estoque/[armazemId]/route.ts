import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET({ params }: { params: { armazemId: string } }) {
  console.log(
    "Recebendo requisição para estoque com armazemId:",
    params.armazemId
  );

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

    // Serialização para evitar erro com BigInt
    const serializedEstoque = estoque.map((item) => ({
      produtoId: item.produtoId, // Já é um número inteiro
      armazemId: item.armazemId, // Já é um número inteiro
      quantidade: item.quantidade, // Já é um número inteiro
      valorUnitario: item.valorUnitario, // Já é float
      estoqueSeguranca: item.estoqueSeguranca ?? 0, // Se for null, define 0
      produto: {
        id: item.produto.id, // Já é um número inteiro
        nome: item.produto.nome,
        sku: item.produto.sku,
        isKit: item.produto.isKit,
        ean: item.produto.ean ? item.produto.ean.toString() : null, // BigInt convertido
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
