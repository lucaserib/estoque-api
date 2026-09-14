import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      select: { email: true, role: true, status: true, expiresAt: true },
    });

    if (
      !invitation ||
      invitation.status !== "PENDING" ||
      invitation.expiresAt < new Date()
    ) {
      return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 404 });
    }

    return NextResponse.json({ email: invitation.email, role: invitation.role });
  } catch (error) {
    console.error("Erro ao buscar convite:", error);
    return NextResponse.json({ error: "Erro ao buscar convite" }, { status: 500 });
  }
}
