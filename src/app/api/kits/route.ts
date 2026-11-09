import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { NextRequest, NextResponse } from "next/server";
import { serializeWithEAN } from "@/utils/api";
import { prepareBigIntEAN } from "@/utils/api";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";

interface Componente {
  produtoId: string;
  quantidade: number;
}

const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

const safeEANConversion = (ean: string | null): bigint | null => {
  if (!ean) return null;
  if (ean === "") return null;

  const cleanEAN = String(ean).replace(/[^0-9]/g, "");

  if (!cleanEAN) return null;

  try {
    return BigInt(cleanEAN);
  } catch (error) {
    console.error("Erro ao converter EAN para BigInt:", error);
    return null;
  }
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sku = url.searchParams.get("sku");
  const armazemId = url.searchParams.get("armazemId");
  const id = url.searchParams.get("id");

  try {
    const user = await verifyUserAtivo(req);
    let produtos = [];

    if (id) {
      const kit = await prisma.produto.findUnique({
        where: {
          id: id,
          isKit: true,
          userId: user.contaId,
        },
        include: {
          componentes: {
            include: {
              produto: true,
            },
          },
        },
      });

      return new Response(JSON.stringify(serializeWithEAN(kit)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else if (sku) {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: true,
          sku: {
            contains: sku,
          },
          userId: user.contaId,
        },
        include: {
          componentes: {
            include: {
              produto: true,
            },
          },
        },
      });
    } else if (armazemId) {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: true,
          estoques: {
            some: {
              armazemId: armazemId,
            },
          },
          userId: user.contaId,
        },
        include: {
          componentes: {
            include: {
              produto: true,
            },
          },
        },
      });
    } else {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: true,
          userId: user.contaId,
        },
        include: {
          componentes: {
            include: {
              produto: true,
            },
          },
        },
      });
    }

    return new Response(JSON.stringify(serializeWithEAN(produtos)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao buscar kits:", error);
    return new Response(JSON.stringify({ error: "Erro ao buscar kits" }), {
      status: 500,
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);
    const body = await req.json();

    const { nome, sku, ean, componentes } = body;

    if (!nome || !sku) {
      return new Response(
        JSON.stringify({ error: "Nome e SKU são obrigatórios" }),
        { status: 400 }
      );
    }

    const existingProduto = await prisma.produto.findFirst({
      where: { sku, userId: user.contaId },
    });

    if (existingProduto) {
      return new Response(JSON.stringify({ error: "SKU já existe" }), {
        status: 400,
      });
    }

    if (!componentes || componentes.length === 0) {
      return new Response(
        JSON.stringify({ error: "Componentes são obrigatórios para kits" }),
        { status: 400 }
      );
    }

    for (const componente of componentes) {
      if (
        !componente.produtoId ||
        !componente.quantidade ||
        componente.quantidade <= 0
      ) {
        return new Response(
          JSON.stringify({
            error: "Os componentes devem ter produtoId e quantidade válida",
          }),
          { status: 400 }
        );
      }

      const produtoExiste = await prisma.produto.findUnique({
        where: { id: componente.produtoId },
      });

      if (!produtoExiste) {
        return new Response(
          JSON.stringify({
            error: `Produto com ID ${componente.produtoId} não existe`,
          }),
          { status: 400 }
        );
      }
    }

    const novoKit = await prisma.produto.create({
      data: {
        userId: user.contaId,
        nome,
        sku,
        ean: safeEANConversion(ean),
        isKit: true,
        componentes: {
          create: componentes.map((componente: Componente) => ({
            quantidade: componente.quantidade,
            produto: { connect: { id: componente.produtoId } },
          })),
        },
      },
      include: {
        componentes: {
          include: {
            produto: true,
          },
        },
      },
    });

    for (const componente of componentes) {
      const estoques = await prisma.estoque.findMany({
        where: { produtoId: componente.produtoId },
      });

      if (estoques.length > 0) {
        let quantidadeRestante = componente.quantidade;

        for (const estoque of estoques) {
          if (quantidadeRestante <= 0) break;

          const quantidadeReduzir = Math.min(
            estoque.quantidade,
            quantidadeRestante
          );

          await prisma.estoque.update({
            where: {
              produtoId_armazemId: {
                produtoId: estoque.produtoId,
                armazemId: estoque.armazemId,
              },
            },
            data: { quantidade: { decrement: quantidadeReduzir } },
          });

          quantidadeRestante -= quantidadeReduzir;
        }
      }
    }

    return new Response(JSON.stringify(serializeWithEAN(novoKit)), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao criar kit:", error);
    return new Response(JSON.stringify({ error: "Erro ao criar kit" }), {
      status: 500,
    });
  }
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "ID é obrigatório" }), {
      status: 400,
    });
  }

  try {
    const user = await verifyUserAtivo(req);

    const kit = await prisma.produto.findFirst({
      where: {
        id: id,
        userId: user.contaId,
        isKit: true,
      },
    });

    if (!kit) {
      return new Response(
        JSON.stringify({
          error: "Kit não encontrado ou não pertence ao usuário",
        }),
        {
          status: 404,
        }
      );
    }

    await prisma.produto.delete({
      where: { id: id },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao deletar kit:", error);
    return new Response(JSON.stringify({ error: "Erro ao deletar kit" }), {
      status: 500,
    });
  }
}
