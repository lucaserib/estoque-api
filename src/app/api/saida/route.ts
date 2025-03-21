// src/app/api/saida/route.ts
import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient, Produto } from "@prisma/client";
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
  sku: string;
  nome?: string;
  isKit: boolean;
}

interface RequestBody {
  produtos: SaidaProduto[];
  armazemId: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBody = await request.json();

    console.log(
      "Recebendo requisição de saída:",
      JSON.stringify(body, null, 2)
    );

    const { produtos, armazemId } = body;

    if (!produtos || !produtos.length || !armazemId) {
      return NextResponse.json(
        { error: "Produtos e armazém são obrigatórios" },
        { status: 400 }
      );
    }

    // Verificar se o armazém existe e pertence ao usuário
    const armazem = await prisma.armazem.findUnique({
      where: { id: armazemId, userId: user.id },
    });

    if (!armazem) {
      return NextResponse.json(
        { error: "Armazém não encontrado ou não pertence ao usuário" },
        { status: 403 }
      );
    }

    // Usar uma transação para garantir que todas as operações sejam realizadas ou nenhuma
    const result = await prisma.$transaction(async (tx) => {
      // Criar o registro de saída principal
      const saida = await tx.saida.create({
        data: {
          userId: user.id,
          armazemId: armazemId,
          data: new Date(),
        },
      });

      console.log(`Saída criada com ID: ${saida.id}`);

      // Processar cada produto/kit na saída
      for (const produto of produtos) {
        const { produtoId, quantidade, isKit } = produto;

        // Verificar se o produto/kit existe e pertence ao usuário
        const produtoInfo = (await tx.produto.findFirst({
          where: {
            id: produtoId,
            userId: user.id,
          },
          include: isKit
            ? {
                componentes: {
                  include: {
                    produto: true,
                  },
                },
              }
            : undefined,
        })) as
          | (Produto & {
              componentes?: {
                quantidade: number;
                produtoId: string;
                produto: Produto;
              }[];
            })
          | null;

        if (!produtoInfo) {
          throw new Error(`Produto/kit com ID ${produtoId} não encontrado`);
        }

        console.log(
          `Processando ${isKit ? "kit" : "produto"}: ${produtoInfo.nome}`
        );

        // Registrar o detalhe da saída
        await tx.detalhesSaida.create({
          data: {
            saidaId: saida.id,
            produtoId: produtoId,
            quantidade: quantidade,
            isKit: isKit,
          },
        });

        // Se for um kit, processa a saída dos componentes
        if (isKit && produtoInfo.componentes) {
          for (const componente of produtoInfo.componentes) {
            const quantidadeComponente = componente.quantidade * quantidade;

            // Verificar estoque do componente
            const estoqueComponente = await tx.estoque.findFirst({
              where: {
                produtoId: componente.produtoId,
                armazemId: armazemId,
              },
            });

            if (!estoqueComponente) {
              throw new Error(
                `Estoque do componente ${componente.produto.nome} não encontrado no armazém especificado`
              );
            }

            if (estoqueComponente.quantidade < quantidadeComponente) {
              throw new Error(
                `Estoque insuficiente para o componente ${componente.produto.nome}. Necessário: ${quantidadeComponente}, Disponível: ${estoqueComponente.quantidade}`
              );
            }

            // Atualizar o estoque do componente
            await tx.estoque.update({
              where: {
                produtoId_armazemId: {
                  produtoId: componente.produtoId,
                  armazemId: armazemId,
                },
              },
              data: {
                quantidade: {
                  decrement: quantidadeComponente,
                },
              },
            });

            console.log(
              `Estoque do componente ${componente.produto.nome} atualizado: -${quantidadeComponente}`
            );
          }
        } else if (!isKit) {
          // Produto simples - verificar e atualizar estoque
          const estoqueProduto = await tx.estoque.findFirst({
            where: {
              produtoId: produtoId,
              armazemId: armazemId,
            },
          });

          if (!estoqueProduto) {
            throw new Error(
              `Estoque do produto ${produtoInfo.nome} não encontrado no armazém especificado`
            );
          }

          if (estoqueProduto.quantidade < quantidade) {
            throw new Error(
              `Estoque insuficiente para o produto ${produtoInfo.nome}. Necessário: ${quantidade}, Disponível: ${estoqueProduto.quantidade}`
            );
          }

          // Atualizar o estoque do produto
          await tx.estoque.update({
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

          console.log(
            `Estoque do produto ${produtoInfo.nome} atualizado: -${quantidade}`
          );
        }
      }

      // Buscar a saída completa com todos os detalhes
      const saidaCompleta = await tx.saida.findUnique({
        where: { id: saida.id },
        include: {
          armazem: true,
          detalhes: {
            include: {
              produto: true,
            },
          },
        },
      });

      return saidaCompleta;
    });

    // Retornar o resultado completo
    return NextResponse.json(serializeBigInt(result), { status: 201 });
  } catch (error) {
    console.error("Erro ao registrar saída:", error);

    // Extrair a mensagem de erro
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao registrar saída";

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

// GET - Buscar saídas
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
      orderBy: {
        data: "desc",
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
