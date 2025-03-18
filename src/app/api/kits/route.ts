// src/app/api/kits/route.ts
import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";

const prisma = new PrismaClient();

interface Componente {
  produtoId: string;
  quantidade: number;
}

// Função para serializar BigInt como string
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

// Função melhorada para converter EAN para BigInt de forma segura
const safeEANConversion = (ean: string | null): bigint | null => {
  if (!ean) return null;
  if (ean === "") return null;

  // Remove caracteres não numéricos
  const cleanEAN = String(ean).replace(/[^0-9]/g, "");

  // Se não houver dígitos após a limpeza, retorna null
  if (!cleanEAN) return null;

  try {
    return BigInt(cleanEAN);
  } catch (error) {
    console.error("Erro ao converter EAN para BigInt:", error);
    return null;
  }
};

// GET Handler - Busca kits
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sku = url.searchParams.get("sku");
  const armazemId = url.searchParams.get("armazemId");
  const id = url.searchParams.get("id");

  try {
    const user = await verifyUser(req);
    let produtos = [];

    if (id) {
      // Buscar um kit específico pelo ID
      const kit = await prisma.produto.findUnique({
        where: {
          id: id,
          isKit: true,
          userId: user.id,
        },
        include: {
          componentes: {
            include: {
              produto: true,
            },
          },
        },
      });

      return new Response(JSON.stringify(serializeBigInt(kit)), {
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
          userId: user.id,
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
          userId: user.id,
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
          userId: user.id,
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

    return new Response(JSON.stringify(serializeBigInt(produtos)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao buscar kits:", error);
    return new Response(JSON.stringify({ error: "Erro ao buscar kits" }), {
      status: 500,
    });
  }
}

// POST Handler - Cria um novo kit
export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    const body = await req.json();

    const { nome, sku, ean, componentes } = body;

    if (!nome || !sku) {
      return new Response(
        JSON.stringify({ error: "Nome e SKU são obrigatórios" }),
        { status: 400 }
      );
    }

    // Verificar se já existe um produto com o mesmo SKU
    const existingProduto = await prisma.produto.findFirst({
      where: { sku, userId: user.id },
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

    // Verificação de componentes
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

      // Verificar se o produto existe
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

    // Criar o kit
    const novoKit = await prisma.produto.create({
      data: {
        userId: user.id,
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

    // Atualizar estoque dos componentes (opcional - dependendo da regra de negócio)
    for (const componente of componentes) {
      const estoques = await prisma.estoque.findMany({
        where: { produtoId: componente.produtoId },
      });

      // Se existir estoque, decrementar a quantidade
      if (estoques.length > 0) {
        // Distribuir a redução entre os armazéns disponíveis
        let quantidadeRestante = componente.quantidade;

        for (const estoque of estoques) {
          if (quantidadeRestante <= 0) break;

          const quantidadeReduzir = Math.min(
            estoque.quantidade,
            quantidadeRestante
          );

          await prisma.estoque.update({
            where: { id: estoque.id },
            data: { quantidade: { decrement: quantidadeReduzir } },
          });

          quantidadeRestante -= quantidadeReduzir;
        }
      }
    }

    return new Response(JSON.stringify(serializeBigInt(novoKit)), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao criar kit:", error);
    return new Response(JSON.stringify({ error: "Erro ao criar kit" }), {
      status: 500,
    });
  }
}

// DELETE Handler
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "ID é obrigatório" }), {
      status: 400,
    });
  }

  try {
    const user = await verifyUser(req);

    // Verificar se o kit pertence ao usuário
    const kit = await prisma.produto.findFirst({
      where: {
        id: id,
        userId: user.id,
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

    // Remover o kit
    await prisma.produto.delete({
      where: { id: id },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Erro ao deletar kit:", error);
    return new Response(JSON.stringify({ error: "Erro ao deletar kit" }), {
      status: 500,
    });
  }
}
