import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";


export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);
    const { nome } = await req.json();
    if (!nome) {
      return NextResponse.json(
        { mensagem: "O nome do armazem é obrigatório" },
        { status: 500 }
      );
    }

    const armazem = await prisma.armazem.create({
      data: { nome, userId: user.contaId },
    });
    return NextResponse.json(armazem, { status: 201 });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    return NextResponse.json(
      { mensagem: "Erro ao criar Armazém" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await verifyUserAtivo(req);
    const armazens = await prisma.armazem.findMany({
      where: { userId: user.contaId },
    });
    return NextResponse.json(armazens, { status: 200 });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao buscar armazéns:", error);
    return NextResponse.json({ error: "Erro ao buscar Armazém" }, { status: 500 });
  }
}
