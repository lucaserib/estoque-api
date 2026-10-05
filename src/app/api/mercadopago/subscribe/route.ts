import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { getOrCreateSubscription } from "@/lib/subscription";
import {
  MercadoPagoService,
  MercadoPagoNotConfiguredError,
  isMercadoPagoConfigured,
  planToRecurringConfig,
} from "@/services/mercadoPagoService";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";

const subscribeSchema = z.object({
  plan: z.enum(["MONTHLY", "ANNUAL"]),
});

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

    if (!isMercadoPagoConfigured()) {
      return NextResponse.json(
        { error: "Pagamentos ainda não estão configurados" },
        { status: 503 }
      );
    }

    const parsed = subscribeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { plan } = parsed.data;
    const subscription = await getOrCreateSubscription(user.contaId);

    if (subscription.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Você já tem uma assinatura ativa" },
        { status: 400 }
      );
    }

    const recurring = planToRecurringConfig(plan);
    const origin = request.nextUrl.origin;

    const preapproval = await MercadoPagoService.createPreapproval({
      reason: `Leap Stock — Plano ${plan === "ANNUAL" ? "Anual" : "Mensal"}`,
      payerEmail: user.email,
      transactionAmount: recurring.transactionAmount,
      frequency: recurring.frequency,
      frequencyType: recurring.frequencyType,
      backUrl: `${origin}/assinatura`,
      externalReference: user.contaId,
    });

    await prisma.subscription.update({
      where: { userId: user.contaId },
      data: {
        plan,
        mpPreapprovalId: preapproval.id,
        mpPayerEmail: user.email,
      },
    });

    return NextResponse.json({ checkoutUrl: preapproval.init_point });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    if (error instanceof MercadoPagoNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Erro ao criar assinatura Mercado Pago:", error);
    return NextResponse.json(
      { error: "Erro ao criar assinatura" },
      { status: 500 }
    );
  }
}
