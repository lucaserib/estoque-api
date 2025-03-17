// Modificação para src/app/api/kits/route.ts
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

// Função para converter EAN para BigInt de forma segura
const safeEANConversion = (ean: string | null): bigint | null => {
  if (!ean) return null;

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

  try {
    let produtos = [];

    if (sku) {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: true,
          sku: {
            contains: sku,
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
    } else if (armazemId) {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: true,
          estoques: {
            some: {
              armazemId: armazemId,
            },
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
    } else {
      produtos = await prisma.produto.findMany({
        where: { isKit: true },
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
    console.error("Erro ao buscar produtos:", error);
    return new Response(JSON.stringify({ error: "Erro ao buscar produtos" }), {
      status: 500,
    });
  }
}

// POST Handler - Cria um novo kit
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  const body = await req.json();

  const { nome, sku, ean, componentes } = body;

  if (!nome || !sku) {
    return new Response(
      JSON.stringify({ error: "Nome e SKU são obrigatórios" }),
      { status: 400 }
    );
  }

  try {
    if (componentes && componentes.length > 0) {
      const novoKit = await prisma.produto.create({
        data: {
          userId: user.id,
          nome,
          sku,
          ean: safeEANConversion(ean), // Usando a função para converter EAN de forma segura
          isKit: true,
          componentes: {
            create: componentes.map((componente: Componente) => ({
              quantidade: componente.quantidade,
              produto: { connect: { id: componente.produtoId } },
            })),
          },
        },
      });

      for (const componente of componentes) {
        await prisma.estoque.updateMany({
          where: { produtoId: componente.produtoId },
          data: { quantidade: { decrement: componente.quantidade } },
        });
      }

      const kitComComponentes = await prisma.produto.findUnique({
        where: { id: novoKit.id },
        include: {
          componentes: {
            include: {
              produto: true,
            },
          },
        },
      });

      return new Response(JSON.stringify(serializeBigInt(kitComComponentes)), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      return new Response(
        JSON.stringify({ error: "Componentes são obrigatórios para kits" }),
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Erro ao criar produto ou kit:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar produto ou kit" }),
      { status: 500 }
    );
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
    await prisma.produto.delete({
      where: { id: id },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    return new Response(JSON.stringify({ error: "Erro ao deletar produto" }), {
      status: 500,
    });
  }
}
