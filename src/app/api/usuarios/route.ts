import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";
import { UserRole } from "@prisma/client";

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
      where: { status: "PENDING", invitedById: { in: membrosIds } },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ users: membros, invitations });
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

    const { email, role } = await req.json();

    if (!email || !role) {
      return NextResponse.json({ error: "Email e papel são obrigatórios" }, { status: 400 });
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "Já existe um usuário com este e-mail" }, { status: 400 });
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: { email, status: "PENDING" },
    });
    if (existingInvitation) {
      return NextResponse.json(
        { error: "Já existe um convite pendente para este e-mail" },
        { status: 400 }
      );
    }

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

    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar convite:", error);
    return NextResponse.json({ error: "Erro ao criar convite" }, { status: 500 });
  }
}
