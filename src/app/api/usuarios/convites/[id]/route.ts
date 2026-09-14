import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUser } from "@/helpers/verifyUser";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await verifyUser(req);
    if (currentUser.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
    }

    const { id } = await params;

    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) {
      return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json({ error: "Este convite já foi utilizado ou revogado" }, { status: 400 });
    }

    await prisma.invitation.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({ message: "Convite revogado com sucesso" });
  } catch (error) {
    console.error("Erro ao revogar convite:", error);
    return NextResponse.json({ error: "Erro ao revogar convite" }, { status: 500 });
  }
}
