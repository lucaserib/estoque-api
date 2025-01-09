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

interface RequestBody {
  produtoId: number;
  fornecedorId: number;
  id?: number;
  preco: number;
  multiplicador: number;
  codigoNF: string;
}

// POST
export async function POST(request: Request) {
  const body: RequestBody = await request.json();

  const { produtoId, fornecedorId, preco, multiplicador, codigoNF } = body;

  if (!produtoId || !fornecedorId || !preco || !multiplicador || !codigoNF) {
    return NextResponse.json(
      {
        error:
          "Produto, Fornecedor, Preço, Multiplicador e Código NF são obrigatórios",
      },
      { status: 400 }
    );
  }

  try {
    const vinculoExistente = await prisma.produtoFornecedor.findFirst({
      where: { produtoId, fornecedorId },
    });

    if (vinculoExistente) {
      return NextResponse.json(
        { error: "Produto já vinculado a este fornecedor" },
        { status: 400 }
      );
    }

    const vinculo = await prisma.produtoFornecedor.create({
      data: {
        produtoId,
        fornecedorId,
        preco,
        multiplicador,
        codigoNF,
      },
    });

    return NextResponse.json(vinculo, { status: 201 });
  } catch (error) {
    console.error("Erro ao vincular fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao vincular fornecedor" },
      { status: 500 }
    );
  }
}

// GET
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fornecedorId = searchParams.get("fornecedorId");
  const produtoId = searchParams.get("produtoId");

  if (!fornecedorId && !produtoId) {
    return NextResponse.json(
      { error: "FornecedorId ou ProdutoId é obrigatório" },
      { status: 400 }
    );
  }

  try {
    if (fornecedorId) {
      const produtos = await prisma.produtoFornecedor.findMany({
        where: {
          fornecedorId: Number(fornecedorId),
        },
        include: {
          produto: true,
        },
      });
      console.log("Produtos encontrados:", produtos);
      return NextResponse.json(serializeBigInt(produtos), { status: 200 });
    } else if (produtoId) {
      const fornecedores = await prisma.produtoFornecedor.findMany({
        where: {
          produtoId: Number(produtoId),
        },
        include: {
          fornecedor: true,
        },
      });
      console.log("Fornecedores encontrados:", fornecedores);
      return NextResponse.json(serializeBigInt(fornecedores), { status: 200 });
    }
  } catch (error) {
    console.error("Erro ao buscar produtos ou fornecedores:", error);
    return NextResponse.json(
      { error: "Erro ao buscar produtos ou fornecedores" },
      { status: 500 }
    );
  }
}

// DELETE
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  try {
    await prisma.produtoFornecedor.delete({
      where: { id: Number(id) },
    });
    return NextResponse.json(null, { status: 204 });
  } catch (error) {
    console.error("Erro ao deletar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao deletar fornecedor" },
      { status: 500 }
    );
  }
}

// PUT
export async function PUT(request: Request) {
  const body: RequestBody = await request.json();

  const { id, preco, multiplicador, codigoNF } = body;

  if (!id || !preco || !multiplicador || !codigoNF) {
    return NextResponse.json(
      { error: "ID, Preço, Multiplicador e Código NF são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const vinculo = await prisma.produtoFornecedor.update({
      where: { id: Number(id) },
      data: {
        preco,
        multiplicador,
        codigoNF,
      },
    });

    return NextResponse.json(vinculo, { status: 200 });
  } catch (error) {
    console.error("Erro ao atualizar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar fornecedor" },
      { status: 500 }
    );
  }
}
