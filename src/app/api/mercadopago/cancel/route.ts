import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoPagoService } from "@/services/mercadoPagoService";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (!subscription?.mpPreapprovalId) {
      return NextResponse.json(
        { error: "Nenhuma assinatura ativa encontrada" },
        { status: 404 }
      );
    }

    await MercadoPagoService.cancelPreapproval(subscription.mpPreapprovalId);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "CANCELED" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao cancelar assinatura:", error);
    return NextResponse.json(
      { error: "Erro ao cancelar assinatura" },
      { status: 500 }
    );
  }
}
