import { verifyUser } from "@/helpers/verifyUser";
import { brlToCents } from "@/utils/currency";
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

interface RequestBody {
  produtoId: string;
  fornecedorId: string;
  id?: number;
  preco: number;
  multiplicador: number;
  codigoNF: string;
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body: RequestBody = await request.json();

    const { produtoId, fornecedorId, preco, multiplicador, codigoNF } = body;

    if (!produtoId || !fornecedorId || !preco || !multiplicador || !codigoNF) {
      return NextResponse.json(
        {
          error: "Todos os campos são obrigatórios!",
        },
        { status: 400 }
      );
    }

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
        preco: Math.round(preco * 100),
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

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const { searchParams } = new URL(request.url);
    const fornecedorId = searchParams.get("fornecedorId");
    const produtoId = searchParams.get("produtoId");

    if (!fornecedorId && !produtoId) {
      return NextResponse.json(
        { error: "FornecedorId ou ProdutoId é obrigatório" },
        { status: 400 }
      );
    }
    if (fornecedorId) {
      const produtos = await prisma.produtoFornecedor.findMany({
        where: {
          fornecedorId: fornecedorId,
        },
        include: {
          produto: true,
        },
      });

      return NextResponse.json(serializeBigInt(produtos), { status: 200 });
    } else if (produtoId) {
      const fornecedores = await prisma.produtoFornecedor.findMany({
        where: {
          produtoId: produtoId,
        },
        include: {
          fornecedor: true,
        },
      });
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

export async function DELETE(request: NextRequest) {
  const user = await verifyUser(request);
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  try {
    await prisma.produtoFornecedor.delete({
      where: { id: Number(id) },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Erro ao deletar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao deletar fornecedor" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const body: RequestBody = await request.json();

  const { id, preco, multiplicador, codigoNF } = body;

  if (!id || !preco || !multiplicador || !codigoNF) {
    return NextResponse.json(
      { error: "ID, Preço, Multiplicador e Código NF são obrigatórios" },
      { status: 400 }
    );
  }

  try {
    const user = await verifyUser(request);
    const vinculo = await prisma.produtoFornecedor.update({
      where: { id: Number(id) },
      data: {
        preco: Math.round(preco * 100),
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
