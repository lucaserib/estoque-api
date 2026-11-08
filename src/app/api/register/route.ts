import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizarEmail } from "@/modules/usuarios/convites";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

const SENHA_MINIMA = 8;

export async function POST(req: NextRequest) {
  const corpo = await req.json().catch(() => ({}));
  const email = typeof corpo.email === "string" ? normalizarEmail(corpo.email) : "";
  const password = typeof corpo.password === "string" ? corpo.password : "";
  const name = typeof corpo.name === "string" ? corpo.name.trim() : "";
  const inviteToken = typeof corpo.inviteToken === "string" ? corpo.inviteToken : null;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limite = await checkRateLimit("register", ip, 10, 60 * 60);
  if (!limite.allowed) return rateLimitResponse(limite);

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Preencha nome, e-mail e senha" }, { status: 400 });
  }

  if (password.length < SENHA_MINIMA) {
    return NextResponse.json({ error: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres` }, { status: 400 });
  }

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: inviteToken ? "Você já tem conta. Entre com ela para aceitar o convite." : "Já existe uma conta com este e-mail" },
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
      normalizarEmail(invitation.email) !== email
    ) {
      return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 400 });
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
    select: { id: true, email: true, name: true },
  });

  if (invitation) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  }

  return NextResponse.json({ message: "Usuário registrado com sucesso", user });
}
