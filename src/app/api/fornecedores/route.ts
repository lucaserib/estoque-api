import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: Request) {
  try {
    const { nome, cnpj, inscricaoEstadual, contato, endereco } =
      await req.json();

    if (!nome) {
      return NextResponse.json(
        { error: "Nome do fornecedor é orbigatorio" },
        { status: 400 }
      );
    }
    const fornecedor = await prisma.fornecedor.create({
      data: {
        nome,
        cnpj,
        inscricaoEstadual,
        contato,
        endereco,
      },
    });

    return NextResponse.json(fornecedor, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao criar fonecedor" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const fornecedores = await prisma.fornecedor.findMany();
    return NextResponse.json(fornecedores, { status: 200 });
  } catch {
    NextResponse.json({ error: "Erro ao buscar Fornecedor" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID do fornecedor é obrigatorio" });
    }

    await prisma.fornecedor.delete({ where: { id: Number(id) } });
    return NextResponse.json({}, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: "Erro ao deletar fornecedor" },
      { status: 500 }
    );
  }
}
