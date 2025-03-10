import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sku = searchParams.get("sku");
  const armazemId = searchParams.get("armazemId");

  try {
    const user = await verifyUser(req);
    let produtos = [];

    if (sku) {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: false,
          sku: {
            contains: sku,
          },
          userId: user.id,
        },
        include: {
          estoques: true,
        },
      });
    } else if (armazemId) {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: false,
          estoques: {
            some: {
              armazemId: armazemId,
            },
          },
          userId: user.id,
        },
        include: {
          estoques: true,
        },
      });
    } else {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: false,
          userId: user.id,
        },
        include: {
          estoques: true,
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

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);

    const body = await req.json();
    const { nome, sku, ean, componentes } = body;

    if (!nome || !sku || !ean) {
      return new Response(
        JSON.stringify({ error: "Nome, SKU e EAN são obrigatórios" }),
        { status: 400 }
      );
    }

    const existingProduto = await prisma.produto.findUnique({
      where: { sku, userId: user.id },
    });

    if (existingProduto) {
      return new Response(JSON.stringify({ error: "SKU já existe" }), {
        status: 400,
      });
    }

    if (componentes && componentes.length > 0) {
      const novoKit = await prisma.produto.create({
        data: {
          userId: user.id,
          nome,
          sku,
          ean: BigInt(ean),
          isKit: true,
          componentes: {
            create: componentes.map(
              (componente: { quantidade: number; produtoId: string }) => ({
                quantidade: componente.quantidade,
                produto: {
                  connect: { id: componente.produtoId },
                },
              })
            ),
          },
        },
      });

      for (const componente of componentes) {
        await prisma.estoque.updateMany({
          where: { produtoId: componente.produtoId },
          data: { quantidade: { decrement: componente.quantidade } },
        });
      }

      return new Response(JSON.stringify(serializeBigInt(novoKit)), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      const novoProduto = await prisma.produto.create({
        data: {
          userId: user.id,
          nome,
          sku,
          ean: BigInt(ean),
          isKit: false,
        },
      });
      return new Response(JSON.stringify(serializeBigInt(novoProduto)), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Erro ao criar produto ou kit:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao criar produto ou kit" }),
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    const body = await req.json();

    const { id, nome, sku, ean } = body;
    if (!id || !nome || !sku || !ean) {
      return NextResponse.json(
        {
          error: "ID, Nome, SKU e  EAN são obrigatórios",
        },
        { status: 400 }
      );
    }

    const produtoAtualizado = await prisma.produto.update({
      where: { id },
      data: {
        nome,
        sku,
        ean: BigInt(ean),
      },
    });
    return new Response(JSON.stringify(serializeBigInt(produtoAtualizado)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar produto" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

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
