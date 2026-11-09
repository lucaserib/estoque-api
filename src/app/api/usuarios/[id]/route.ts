import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { UserRole } from "@prisma/client";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { auditarConta, ipDe } from "@/modules/conta/auditoria";
import { EquipeError, removerMembro } from "@/modules/usuarios/equipe";

const VALID_ROLES: UserRole[] = ["ADMIN", "COMPRAS", "ESTOQUE", "VENDAS", "LEITURA"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await verifyUserAtivo(req);
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const { id } = await params;

    if (id === currentUser.id) {
      return NextResponse.json(
        { error: "Não é possível alterar o seu próprio papel" },
        { status: 400 }
      );
    }

    const { role } = await req.json();
    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    const targetContaId = targetUser.contaId ?? targetUser.id;
    if (targetContaId !== currentUser.contaId) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    if (id === currentUser.contaId) {
      return NextResponse.json(
        { error: "Não é possível alterar o papel do dono da conta" },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
    });
    await auditarConta({
      contaId: currentUser.contaId,
      autorId: currentUser.id,
      acao: "PAPEL_ALTERADO",
      alvoTipo: "USUARIO",
      alvoId: id,
      detalhe: { de: targetUser.role, para: role },
      ip: ipDe(req.headers),
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao atualizar papel do usuário:", error);
    return NextResponse.json({ error: "Erro ao atualizar usuário" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await verifyUserAtivo(req);
    const { id } = await params;
    await removerMembro(
      { id: currentUser.id, contaId: currentUser.contaId, name: currentUser.name, email: currentUser.email, role: currentUser.role },
      id,
      { ip: ipDe(req.headers) }
    );
    return NextResponse.json({ removido: true });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    if (error instanceof EquipeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao remover membro da equipe:", error);
    return NextResponse.json({ error: "Erro ao remover da equipe" }, { status: 500 });
  }
}
