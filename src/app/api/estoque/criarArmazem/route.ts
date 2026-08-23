import { verifyUser } from "@/helpers/verifyUser";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function POST(req: NextRequest) {
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

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    const armazens = await prisma.armazem.findMany({
      where: { userId: user.id },
    });
    return NextResponse.json(armazens, { status: 200 });
  } catch (error) {
    console.error("Erro ao buscar armazéns:", error);
    return NextResponse.json({ error: "Erro ao buscar Armazém" }, { status: 500 });
  }
}
