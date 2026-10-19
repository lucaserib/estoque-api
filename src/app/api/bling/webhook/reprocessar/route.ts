import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { prisma } from "@/lib/prisma";
import { processarEventoWebhookBling } from "@/services/blingWebhookProcessor";

export const maxDuration = 45;

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

    const contas = await prisma.blingAccount.findMany({
      where: { userId: user.contaId, isActive: true },
      select: { blingCompanyId: true },
    });
    const companyIds = contas.map((c) => c.blingCompanyId).filter((id): id is string => id != null);
    if (companyIds.length === 0) {
      return NextResponse.json({ reprocessados: 0 });
    }

    const pendentes = await prisma.blingWebhookEvent.findMany({
      where: { companyId: { in: companyIds }, processado: false },
      select: { id: true },
      take: 50,
    });

    for (const evento of pendentes) {
      await processarEventoWebhookBling(evento.id);
    }

    return NextResponse.json({ reprocessados: pendentes.length });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao reprocessar webhooks do Bling:", error);
    return NextResponse.json({ error: "Erro ao reprocessar webhooks" }, { status: 500 });
  }
}
