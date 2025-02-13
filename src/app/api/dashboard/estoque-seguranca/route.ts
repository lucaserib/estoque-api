import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const produtosCriticos = await prisma.estoque.findMany({
      where: {
        armazem: { userId: user.id },
        quantidade: { lte: prisma.estoque.fields.estoqueSeguranca },
      },
      include: {
        produto: true,
        armazem: true,
      },
    });

    const response = produtosCriticos.map((item) => ({
      id: item.produto.id,
      nome: item.produto.nome,
      sku: item.produto.sku,
      quantidade: item.quantidade,
      estoqueSeguranca: item.estoqueSeguranca ?? 0,
      armazem: item.armazem.nome,
    }));

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar produtos no estoque de segurança:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produtos no estoque de segurança" },
      { status: 500 }
    );
  }
}
