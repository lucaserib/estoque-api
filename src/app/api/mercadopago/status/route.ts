import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { podeEditar } from "@/lib/permissoes";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";
import { obterSituacaoConta } from "@/modules/conta/situacao";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const [situacao, assinatura, configuracao] = await Promise.all([
      obterSituacaoConta(user.contaId),
      prisma.subscription.findUnique({ where: { userId: user.contaId } }),
      prisma.configuracaoGeral.findUnique({ where: { userId: user.contaId }, select: { nomeLoja: true } }),
    ]);

    return NextResponse.json({
      status: assinatura?.status ?? "TRIALING",
      plan: assinatura?.plan ?? null,
      trialEndsAt: assinatura?.trialEndsAt ?? null,
      currentPeriodEnd: assinatura?.currentPeriodEnd ?? null,
      active: situacao.podeUsar,
      paymentsConfigured: isMercadoPagoConfigured(),
      situacao,
      podeGerenciar: podeEditar(user.role, "INTEGRACOES_USUARIOS_ASSINATURA"),
      nomeLoja: configuracao?.nomeLoja ?? null,
    });
  } catch (error) {
    console.error("Erro ao buscar status da assinatura:", error);
    return NextResponse.json(
      { error: "Erro ao buscar status da assinatura" },
      { status: 500 }
    );
  }
}
