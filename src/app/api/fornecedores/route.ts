import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";

export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);
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
        userId: user.id,
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

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUser(req);

    const fornecedores = await prisma.fornecedor.findMany({
      where: { userId: user.id },
    });
    return NextResponse.json(fornecedores, { status: 200 });
  } catch {
    NextResponse.json({ error: "Erro ao buscar Fornecedor" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await verifyUser(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID do fornecedor é obrigatorio" });
    }

    const fornecedor = await prisma.fornecedor.findUnique({
      where: { id: id },
    });

    if (!fornecedor) {
      return NextResponse.json(
        { error: "Fornecedor não encontrado ou não pertence a este usuário" },
        { status: 404 }
      );
    }

    await prisma.fornecedor.delete({ where: { id: id } });

    return NextResponse.json({}, { status: 204 });
  } catch (error) {
    console.error("Erro ao deletar fornecedor:", error);
    return NextResponse.json(
      { error: "Erro ao deletar fornecedor" },
      { status: 500 }
    );
  }
}
