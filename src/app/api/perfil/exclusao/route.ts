import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { auditarConta, ipDe } from "@/modules/conta/auditoria";

const corpoSchema = z.object({ motivo: z.string().trim().max(500).optional() });

export async function GET(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const pendente = await prisma.solicitacaoExclusao.findFirst({
      where: { userId: usuario.id, status: "PENDENTE" },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ pendente });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const usuario = await verifyUser(request);
    const corpo = corpoSchema.safeParse(await request.json().catch(() => ({})));
    if (!corpo.success) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

    const existente = await prisma.solicitacaoExclusao.findFirst({
      where: { userId: usuario.id, status: "PENDENTE" },
      select: { id: true, createdAt: true },
    });
    if (existente) return NextResponse.json({ pendente: existente });

    const solicitacao = await prisma.solicitacaoExclusao.create({
      data: {
        contaId: usuario.contaId,
        userId: usuario.id,
        email: usuario.email,
        motivo: corpo.data.motivo || null,
      },
      select: { id: true, createdAt: true },
    });
    await auditarConta({
      contaId: usuario.contaId,
      autorId: usuario.id,
      acao: "EXCLUSAO_SOLICITADA",
      alvoTipo: "USUARIO",
      alvoId: usuario.id,
      ip: ipDe(request.headers),
    });
    return NextResponse.json({ pendente: solicitacao }, { status: 201 });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao pedir exclusão:", error);
    return NextResponse.json({ error: "Não foi possível registrar o pedido agora." }, { status: 500 });
  }
}
