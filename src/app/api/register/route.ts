import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email, password, name, inviteToken } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "Usuário já cadastrado" },
      { status: 400 }
    );
  }

  let invitation = null;
  let contaId: string | null = null;
  if (inviteToken) {
    invitation = await prisma.invitation.findUnique({
      where: { token: inviteToken },
      include: { invitedBy: { select: { id: true, contaId: true } } },
    });

    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt < new Date() ||
      invitation.email.toLowerCase() !== email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Convite inválido ou expirado" },
        { status: 400 }
      );
    }

    contaId = invitation.invitedBy.contaId ?? invitation.invitedBy.id;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      ...(invitation ? { role: invitation.role, contaId } : {}),
    },
  });

  if (invitation) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  }

  return NextResponse.json({ message: "Usuário registrado com sucesso", user });
}
