import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { MercadoPagoService } from "@/services/mercadoPagoService";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { cancelarIaJuntoComPrincipal } from "@/modules/ia/cobranca";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.contaId },
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
    const iaCancelada = await cancelarIaJuntoComPrincipal(user.contaId);

    return NextResponse.json({ success: true, iaCancelada });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao cancelar assinatura:", error);
    return NextResponse.json(
      { error: "Erro ao cancelar assinatura" },
      { status: 500 }
    );
  }
}
