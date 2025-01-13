import { verifyUser } from "@/helpers/verifyUser";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const user = await verifyUser(req);
    const { nome } = await req.json();
    if (!nome) {
      return NextResponse.json(
        { mensagem: "O nome do armazem é obrigatório" },
        { status: 500 }
      );
    }

    const armazem = await prisma.armazem.create({
      data: { nome, userId: user.id },
    });
    return NextResponse.json(armazem, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { mensagem: "Erro ao criar Armazém" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const user = await verifyUser(req);
    const armazem = await prisma.armazem.findMany({
      where: { userId: user.id },
    });
    return NextResponse.json(armazem, { status: 200 });
  } catch {
    NextResponse.json({ error: "Erro ao buscar Armazém" }, { status: 500 });
  }
}
