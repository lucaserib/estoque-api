import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const estoques = await prisma.estoque.findMany({
      where: { armazem: { userId: user.id } },
      include: {
        produto: {
          select: {
            custoMedio: true,
          },
        },
      },
    });

    const valorTotalEstoque = estoques.reduce((total, item) => {
      const custoMedioCentavos = item.produto.custoMedio ?? 0;
      return total + custoMedioCentavos * item.quantidade;
    }, 0);

    const quantidadeTotal = estoques.reduce(
      (total, item) => total + item.quantidade,
      0
    );

    return NextResponse.json(
      {
        valorTotal: valorTotalEstoque,
        quantidadeTotal,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erro ao buscar valor total do estoque:", error);
    return NextResponse.json(
      { error: "Erro ao buscar valor total do estoque" },
      { status: 500 }
    );
  }
}
