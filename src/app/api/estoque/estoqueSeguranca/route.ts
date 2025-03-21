import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function PUT(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { produtoId, armazemId, estoqueSeguranca } = body;

    // Validação dos campos
    if (!produtoId || !armazemId || estoqueSeguranca === undefined) {
      return NextResponse.json(
        { message: "Produto, armazém e estoque de segurança são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se o armazém pertence ao usuário
    const armazem = await prisma.armazem.findFirst({
      where: {
        id: armazemId,
        userId: user.id,
      },
    });

    if (!armazem) {
      return NextResponse.json(
        { message: "Armazém não encontrado ou não pertence ao usuário" },
        { status: 404 }
      );
    }

    // Atualizar o estoque de segurança
    const estoque = await prisma.estoque.update({
      where: {
        produtoId_armazemId: {
          produtoId,
          armazemId,
        },
      },
      data: {
        estoqueSeguranca,
      },
      include: {
        produto: true,
      },
    });

    // Converter valores BigInt para números regulares
    const serializedEstoque = {
      produtoId: estoque.produtoId,
      armazemId: estoque.armazemId,
      quantidade: Number(estoque.quantidade),
      estoqueSeguranca: estoque.estoqueSeguranca
        ? Number(estoque.estoqueSeguranca)
        : null,
      produto: {
        id: estoque.produto.id,
        nome: estoque.produto.nome,
        sku: estoque.produto.sku,
        isKit: estoque.produto.isKit,
        ean: estoque.produto.ean ? Number(estoque.produto.ean) : null,
        custoMedio: estoque.produto.custoMedio,
      },
    };

    return NextResponse.json(serializedEstoque, { status: 200 });
  } catch (error) {
    console.error("Erro ao atualizar estoque de segurança:", error);
    return NextResponse.json(
      { message: "Erro ao atualizar estoque de segurança" },
      { status: 500 }
    );
  }
}
