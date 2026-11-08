import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";
import { UserRole } from "@prisma/client";
import { normalizarEmail, usuarioSemDadosProprios } from "@/modules/usuarios/convites";

const VALID_ROLES: UserRole[] = ["ADMIN", "COMPRAS", "ESTOQUE", "VENDAS", "LEITURA"];
const INVITE_EXPIRATION_DAYS = 7;

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

    const invitations = await prisma.invitation.findMany({
      where: { status: "PENDING", invitedById: { in: membrosIds }, expiresAt: { gt: new Date() } },
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
      users: membros,
      invitations: invitations.map(({ token, ...convite }) => ({ ...convite, caminho: `/register?invite=${token}` })),
    });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return NextResponse.json({ error: "Erro ao listar usuários" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await verifyUser(req);
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const corpo = await req.json().catch(() => ({}));
    const role = corpo.role as UserRole | undefined;
    const email = typeof corpo.email === "string" ? normalizarEmail(corpo.email) : "";

    if (!email || !role) {
      return NextResponse.json({ error: "Email e papel são obrigatórios" }, { status: 400 });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, contaId: true },
    });
    if (existingUser) {
      const contaDoExistente = existingUser.contaId ?? existingUser.id;
      if (contaDoExistente === currentUser.contaId) {
        return NextResponse.json({ error: "Essa pessoa já faz parte da sua equipe" }, { status: 400 });
      }
      if (existingUser.contaId || !(await usuarioSemDadosProprios(existingUser.id))) {
        return NextResponse.json(
          { error: "Este e-mail já usa o Skubo com uma loja própria. Peça para a pessoa usar outro e-mail." },
          { status: 400 }
        );
      }
    }

    const membros = await prisma.user.findMany({
      where: { OR: [{ id: currentUser.contaId }, { contaId: currentUser.contaId }] },
      select: { id: true },
    });
    await prisma.invitation.updateMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        status: "PENDING",
        invitedById: { in: membros.map((m) => m.id) },
      },
      data: { status: "REVOKED" },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRATION_DAYS);

    const invitation = await prisma.invitation.create({
      data: {
        email,
        role,
        token,
        expiresAt,
        invitedById: currentUser.id,
      },
    });

    return NextResponse.json(
      {
        invitation: { id: invitation.id, email: invitation.email, role: invitation.role, token: invitation.token },
        usuarioJaCadastrado: Boolean(existingUser),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar convite:", error);
    return NextResponse.json({ error: "Erro ao criar convite" }, { status: 500 });
  }
}
