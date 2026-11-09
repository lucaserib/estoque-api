import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { permissaoErrorResponse } from "@/lib/permissoes";
import { ipDe } from "@/modules/conta/auditoria";
import { EquipeError, criarConvite } from "@/modules/usuarios/equipe";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await verifyUser(req);
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const membros = await prisma.user.findMany({
      where: { OR: [{ id: currentUser.contaId }, { contaId: currentUser.contaId }] },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const membrosIds = membros.map((m) => m.id);
    const agora = new Date();

    const invitations = await prisma.invitation.findMany({
      where: {
        status: "PENDING",
        invitedById: { in: membrosIds },
        expiresAt: { gt: new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        email: true,
        role: true,
        token: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      users: membros.map((membro) => ({ ...membro, dono: membro.id === currentUser.contaId })),
      invitations: invitations.map(({ token, ...convite }) => ({
        ...convite,
        expirado: convite.expiresAt.getTime() <= agora.getTime(),
        caminho: `/register?invite=${token}`,
      })),
    });
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    console.error("Erro ao listar usuários:", error);
    return NextResponse.json({ error: "Erro ao listar usuários" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await verifyUserAtivo(req);
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const corpo = await req.json().catch(() => ({}));
    const role = corpo.role as UserRole | undefined;
    const email = typeof corpo.email === "string" ? corpo.email : "";
    if (!email || !role) {
      return NextResponse.json({ error: "Email e papel são obrigatórios" }, { status: 400 });
    }

    const { convite, usuarioJaCadastrado } = await criarConvite(
      { id: currentUser.id, contaId: currentUser.contaId, name: currentUser.name, email: currentUser.email },
      { email, role },
      { ip: ipDe(req.headers) }
    );

    return NextResponse.json(
      {
        invitation: { id: convite.id, email: convite.email, role: convite.role, token: convite.token },
        usuarioJaCadastrado,
        emailEnviado: true,
      },
      { status: 201 }
    );
  } catch (error) {
    const respostaAcesso = permissaoErrorResponse(error);
    if (respostaAcesso) return respostaAcesso;
    if (error instanceof EquipeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Erro ao criar convite:", error);
    return NextResponse.json({ error: "Erro ao criar convite" }, { status: 500 });
  }
}
