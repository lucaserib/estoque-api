import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { getOrCreateSubscription, isSubscriptionActive } from "@/lib/subscription";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const subscription = await getOrCreateSubscription(user.contaId);

    return NextResponse.json({
      status: subscription.status,
      plan: subscription.plan,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      active: isSubscriptionActive(subscription),
      paymentsConfigured: isMercadoPagoConfigured(),
    });
  } catch (error) {
    console.error("Erro ao buscar status da assinatura:", error);
    return NextResponse.json(
      { error: "Erro ao buscar status da assinatura" },
      { status: 500 }
    );
  }
}
