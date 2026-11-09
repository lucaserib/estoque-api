import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function usuarioSemDadosProprios(userId: string): Promise<boolean> {
  const [membros, produtos, contasMl, contasBling, vendas] = await Promise.all([
    prisma.user.count({ where: { contaId: userId } }),
    prisma.produto.count({ where: { userId } }),
    prisma.mercadoLivreAccount.count({ where: { userId } }),
    prisma.blingAccount.count({ where: { userId } }),
    prisma.vendaCanal.count({ where: { userId } }),
  ]);
  return membros + produtos + contasMl + contasBling + vendas === 0;
}

export async function buscarConviteValido(email: string) {
  return prisma.invitation.findFirst({
    where: {
      email: { equals: normalizarEmail(email), mode: "insensitive" },
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: { invitedBy: { select: { id: true, contaId: true } } },
  });
}

export interface ConviteAplicado {
  conviteId: string;
  contaId: string;
  role: UserRole;
}

export async function aplicarConvitePendente(userId: string, email: string | null | undefined): Promise<ConviteAplicado | null> {
  if (!email) return null;
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { contaId: true } });
  if (!usuario || usuario.contaId) return null;

  const convite = await buscarConviteValido(email);
  if (!convite) return null;

  const contaId = convite.invitedBy.contaId ?? convite.invitedBy.id;
  if (contaId === userId) return null;
  if (!(await usuarioSemDadosProprios(userId))) return null;

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { contaId, role: convite.role } }),
    prisma.invitation.update({ where: { id: convite.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } }),
  ]);

  return { conviteId: convite.id, contaId, role: convite.role };
}
