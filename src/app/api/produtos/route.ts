import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Função para serializar BigInt como string
const serializeBigInt = (obj: unknown): unknown => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
};

// Handler para o método GET
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sku = searchParams.get("sku");
  const armazemId = searchParams.get("armazemId");

  try {
    let produtos = [];

    if (sku) {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: false,
          sku: {
            contains: sku,
          },
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
              armazemId: Number(armazemId),
            },
          },
        },
        include: {
          estoques: true,
        },
      });
    } else {
      produtos = await prisma.produto.findMany({
        where: {
          isKit: false,
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

// Handler para o método POST
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { nome, sku, ean, componentes } = body;

    if (!nome || !sku || !ean) {
      return new Response(
        JSON.stringify({ error: "Nome, SKU e EAN são obrigatórios" }),
        { status: 400 }
      );
    }

    const existingProduto = await prisma.produto.findUnique({ where: { sku } });

    if (existingProduto) {
      return new Response(JSON.stringify({ error: "SKU já existe" }), {
        status: 400,
      });
    }

    if (componentes && componentes.length > 0) {
      // Criar um kit
      const novoKit = await prisma.produto.create({
        data: {
          nome,
          sku,
          ean: BigInt(ean),
          isKit: true,
          componentes: {
            create: componentes.map(
              (componente: { quantidade: number; produtoId: number }) => ({
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
      // Criar um produto
      const novoProduto = await prisma.produto.create({
        data: {
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

// Handler para o método DELETE
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "ID é obrigatório" }), {
      status: 400,
    });
  }

  try {
    await prisma.produto.delete({
      where: { id: Number(id) },
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    return new Response(JSON.stringify({ error: "Erro ao deletar produto" }), {
      status: 500,
    });
  }
}
