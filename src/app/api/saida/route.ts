import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

// Função para serializar BigInt como string
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

interface SaidaProduto {
  produtoId: string;
  quantidade: number;
  nome?: string;
  sku: string;
  isKit?: boolean;
  componentes?: {
    produtoId: string;
    quantidade: number;
    sku?: string;
    nome?: string;
  }[];
}

interface RequestBody {
  produtos: SaidaProduto[];
  armazemId: string;
}

export async function POST(request: NextRequest) {
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
        armazemId: armazemId,
      },
    });

    // Processamento da saída dos produtos
    for (const produto of produtos) {
      const { produtoId, quantidade, isKit = false } = produto;

      if (isKit) {
        const kitEncontrado = await prisma.produto.findUnique({
          where: { id: produtoId },
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

        // Registrar a saída do kit
        await prisma.detalhesSaida.create({
          data: {
            saidaId: saida.id,
            produtoId: kitEncontrado.id,
            quantidade,
            isKit: true,
          },
        });

        // Processar os componentes do kit
        for (const componente of kitEncontrado.componentes) {
          const estoqueComponente = await prisma.estoque.findFirst({
            where: {
              produtoId: componente.produtoId,
              armazemId: armazemId,
            },
          });

          if (
            !estoqueComponente ||
            estoqueComponente.quantidade < componente.quantidade * quantidade
          ) {
            return NextResponse.json(
              {
                error: `Estoque insuficiente para o componente ${componente.produto.nome}`,
              },
              { status: 400 }
            );
          }

          await prisma.estoque.update({
            where: {
              produtoId_armazemId: {
                produtoId: componente.produtoId,
                armazemId: armazemId,
              },
            },
            data: {
              quantidade: {
                decrement: componente.quantidade * quantidade,
              },
            },
          });
        }
      } else {
        const produtoEncontrado = await prisma.produto.findUnique({
          where: { id: produtoId },
        });

        if (!produtoEncontrado || produtoEncontrado.userId !== user.id) {
          return NextResponse.json(
            { error: "Produto não encontrado" },
            { status: 404 }
          );
        }

        const estoqueProduto = await prisma.estoque.findFirst({
          where: {
            produtoId: produtoId,
            armazemId: armazemId,
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
              produtoId: produtoId,
              armazemId: armazemId,
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
            produtoId: produtoId,
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
export async function GET(request: NextRequest) {
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
