import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { serializeWithEAN } from "@/utils/api";

const prisma = new PrismaClient();

interface TransferenciaItem {
  produtoId: string;
  quantidade: number;
}

interface RequestBody {
  armazemOrigemId: string;
  armazemDestinoId: string;
  observacoes?: string;
  itens: TransferenciaItem[];
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBody = await request.json();

    const { armazemOrigemId, armazemDestinoId, observacoes, itens } = body;

    if (!armazemOrigemId || !armazemDestinoId || !itens || itens.length === 0) {
      return NextResponse.json(
        { error: "Armazém origem, destino e itens são obrigatórios" },
        { status: 400 }
      );
    }

    if (armazemOrigemId === armazemDestinoId) {
      return NextResponse.json(
        { error: "Armazém origem deve ser diferente do armazém destino" },
        { status: 400 }
      );
    }

    const armazemOrigem = await prisma.armazem.findFirst({
      where: { id: armazemOrigemId, userId: user.id },
    });

    const armazemDestino = await prisma.armazem.findFirst({
      where: { id: armazemDestinoId, userId: user.id },
    });

    if (!armazemOrigem || !armazemDestino) {
      return NextResponse.json(
        { error: "Armazém de origem ou destino não encontrado" },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      for (const item of itens) {
        const { produtoId, quantidade } = item;

        if (quantidade <= 0) {
          throw new Error(`Quantidade deve ser maior que zero para o produto ${produtoId}`);
        }

        const produto = await tx.produto.findFirst({
          where: { id: produtoId, userId: user.id },
        });

        if (!produto) {
          throw new Error(`Produto com ID ${produtoId} não encontrado`);
        }

        const estoqueOrigem = await tx.estoque.findFirst({
          where: {
            produtoId: produtoId,
            armazemId: armazemOrigemId,
          },
        });

        if (!estoqueOrigem) {
          throw new Error(`Produto ${produto.nome} não encontrado no armazém de origem`);
        }

        if (estoqueOrigem.quantidade < quantidade) {
          throw new Error(
            `Estoque insuficiente para o produto ${produto.nome}. Disponível: ${estoqueOrigem.quantidade}, Solicitado: ${quantidade}`
          );
        }

        await tx.estoque.update({
          where: {
            produtoId_armazemId: {
              produtoId: produtoId,
              armazemId: armazemOrigemId,
            },
          },
          data: {
            quantidade: {
              decrement: quantidade,
            },
          },
        });

        const estoqueDestino = await tx.estoque.findFirst({
          where: {
            produtoId: produtoId,
            armazemId: armazemDestinoId,
          },
        });

        if (estoqueDestino) {
          await tx.estoque.update({
            where: {
              produtoId_armazemId: {
                produtoId: produtoId,
                armazemId: armazemDestinoId,
              },
            },
            data: {
              quantidade: {
                increment: quantidade,
              },
            },
          });
        } else {
          await tx.estoque.create({
            data: {
              produtoId: produtoId,
              armazemId: armazemDestinoId,
              quantidade: quantidade,
              estoqueSeguranca: 0,
            },
          });
        }
      }

      const transferencia = await tx.transferenciaEstoque.create({
        data: {
          userId: user.id,
          armazemOrigemId,
          armazemDestinoId,
          observacoes,
          itens: {
            create: itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
            })),
          },
        },
        include: {
          armazemOrigem: true,
          armazemDestino: true,
          itens: {
            include: {
              produto: true,
            },
          },
        },
      });

      return transferencia;
    });

    return NextResponse.json(serializeWithEAN(result), { status: 201 });
  } catch (error) {
    console.error("Erro ao realizar transferência:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao realizar transferência";

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const transferencias = await prisma.transferenciaEstoque.findMany({
      where: { userId: user.id },
      include: {
        armazemOrigem: true,
        armazemDestino: true,
        itens: {
          include: {
            produto: true,
          },
        },
      },
      orderBy: {
        data: "desc",
      },
    });

    return NextResponse.json(serializeWithEAN(transferencias), { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar transferências:", error);
    return NextResponse.json(
      { error: "Erro ao buscar transferências" },
      { status: 500 }
    );
  }
}