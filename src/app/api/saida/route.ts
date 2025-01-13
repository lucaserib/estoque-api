import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

// Função para serializar BigInt como string
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

interface Produto {
  sku: string;
  quantidade: number;
  isKit: boolean;
}

interface RequestBody {
  produtos: Produto[];
  armazemId: number;
}

// POST
export async function POST(request: Request) {
  try {
    const user = await verifyUser(request);

    const body: RequestBody = await request.json();
    const { produtos, armazemId } = body;

    if (!produtos || !armazemId) {
      return NextResponse.json(
        { error: "Produtos e Armazém são obrigatórios" },
        { status: 400 }
      );
    }
    const armazem = await prisma.armazem.findUnique({
      where: { id: armazemId },
    });

    if (!armazem || armazem.userId !== user.id) {
      return NextResponse.json(
        { error: "Armazém não encontrado ou não pertence ao usuário" },
        { status: 403 }
      );
    }

    // Criar uma nova saída
    const saida = await prisma.saida.create({
      data: {
        userId: user.id,
        data: new Date(),
        armazemId: Number(armazemId),
      },
    });

    // Processamento da saída dos produtos
    for (const produto of produtos) {
      const { sku, quantidade, isKit } = produto;

      if (isKit) {
        const kitEncontrado = await prisma.produto.findUnique({
          where: { sku },
          include: {
            componentes: {
              include: { produto: true },
            },
          },
        });

        if (!kitEncontrado || kitEncontrado.userId !== user.id) {
          return NextResponse.json(
            { error: "Kit não encontrado" },
            { status: 404 }
          );
        }

        for (const componente of kitEncontrado.componentes) {
          const estoqueComponente = await prisma.estoque.findFirst({
            where: {
              produtoId: componente.produtoId,
              armazemId: Number(armazemId),
            },
          });

          if (
            !estoqueComponente ||
            estoqueComponente.quantidade < componente.quantidade * quantidade
          ) {
            return NextResponse.json(
              { error: "Estoque insuficiente para o componente" },
              { status: 400 }
            );
          }

          await prisma.estoque.update({
            where: {
              produtoId_armazemId: {
                produtoId: componente.produtoId,
                armazemId: Number(armazemId),
              },
            },
            data: {
              quantidade: {
                decrement: componente.quantidade * quantidade,
              },
            },
          });

          await prisma.detalhesSaida.create({
            data: {
              saidaId: saida.id,
              produtoId: componente.produtoId,
              quantidade: componente.quantidade * quantidade,
              isKit: true,
            },
          });
        }
      } else {
        const produtoEncontrado = await prisma.produto.findUnique({
          where: { sku },
        });

        if (!produtoEncontrado) {
          return NextResponse.json(
            { error: "Produto não encontrado" },
            { status: 404 }
          );
        }

        const estoqueProduto = await prisma.estoque.findFirst({
          where: {
            produtoId: produtoEncontrado.id,
            armazemId: Number(armazemId),
          },
        });

        if (!estoqueProduto || estoqueProduto.quantidade < quantidade) {
          return NextResponse.json(
            { error: "Estoque insuficiente" },
            { status: 400 }
          );
        }

        await prisma.estoque.update({
          where: {
            produtoId_armazemId: {
              produtoId: produtoEncontrado.id,
              armazemId: Number(armazemId),
            },
          },
          data: {
            quantidade: {
              decrement: quantidade,
            },
          },
        });

        await prisma.detalhesSaida.create({
          data: {
            saidaId: saida.id,
            produtoId: produtoEncontrado.id,
            quantidade,
            isKit: false,
          },
        });
      }
    }

    return NextResponse.json({ message: "Saída registrada com sucesso!" });
  } catch (error) {
    console.error("Erro ao registrar saída:", error);
    return NextResponse.json(
      { error: "Erro ao registrar saída" },
      { status: 500 }
    );
  }
}

// GET
export async function GET(request: Request) {
  try {
    const user = await verifyUser(request);
    const saidas = await prisma.saida.findMany({
      where: { userId: user.id },
      include: {
        armazem: true,
        detalhes: {
          include: {
            produto: true,
          },
        },
      },
    });

    return NextResponse.json(serializeBigInt(saidas), { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar saídas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar saídas" },
      { status: 500 }
    );
  }
}
