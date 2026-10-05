import { verifyUser } from "@/helpers/verifyUser";
import { Produto } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { serializeWithEAN } from "@/utils/api";
import { NotificationService } from "@/services/notificationService";
import { prisma } from "@/lib/prisma";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";


async function notificarEstoquesCriticos(
  contaId: string,
  armazemId: string,
  notificarUserId: string
): Promise<void> {
  const criticos = await prisma.estoque.findMany({
    where: {
      armazemId,
      estoqueSeguranca: { not: null, gt: 0 },
      produto: { userId: contaId },
    },
    include: { produto: { select: { id: true, nome: true } } },
  });

  const atingiramMinimo = criticos.filter(
    (estoque) => estoque.quantidade <= (estoque.estoqueSeguranca ?? 0)
  );

  for (const estoque of atingiramMinimo) {
    await NotificationService.notifyEstoqueCritico(
      notificarUserId,
      estoque.produto.nome,
      estoque.produto.id
    );
  }
}

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
    exigirPermissao(user.role, "ESTOQUE_AJUSTAR");
    const body: RequestBody = await request.json();


    const { produtos, armazemId } = body;

    if (!produtos || !produtos.length || !armazemId) {
      return NextResponse.json(
        { error: "Produtos e armazém são obrigatórios" },
        { status: 400 }
      );
    }

    const armazem = await prisma.armazem.findUnique({
      where: { id: armazemId, userId: user.contaId },
    });

    if (!armazem) {
      return NextResponse.json(
        { error: "Armazém não encontrado ou não pertence ao usuário" },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const saida = await tx.saida.create({
        data: {
          userId: user.contaId,
          armazemId: armazemId,
          data: new Date(),
        },
      });


      for (const produto of produtos) {
        const { produtoId, quantidade, isKit } = produto;

        const produtoInfo = (await tx.produto.findFirst({
          where: {
            id: produtoId,
            userId: user.contaId,
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


        await tx.detalhesSaida.create({
          data: {
            saidaId: saida.id,
            produtoId: produtoId,
            quantidade: quantidade,
            isKit: isKit,
          },
        });

        if (isKit && produtoInfo.componentes) {
          for (const componente of produtoInfo.componentes) {
            const quantidadeComponente = componente.quantidade * quantidade;

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

          }
        } else if (!isKit) {
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

        }
      }

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

    await notificarEstoquesCriticos(user.contaId, armazemId, user.id).catch((error) =>
      console.error("Erro ao verificar estoques críticos:", error)
    );

    return NextResponse.json(serializeWithEAN(result), { status: 201 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao registrar saída:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao registrar saída";

    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const saidas = await prisma.saida.findMany({
      where: { userId: user.contaId },
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

    return NextResponse.json(serializeWithEAN(saidas), { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar saídas:", error);
    return NextResponse.json(
      { error: "Erro ao buscar saídas" },
      { status: 500 }
    );
  }
}
