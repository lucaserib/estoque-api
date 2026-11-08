import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { emailsAdminPlataforma } from "@/lib/adminPlataforma";
import { trialEndsAt } from "@/lib/billing";
import { isMercadoPagoConfigured } from "@/services/mercadoPagoService";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Só o administrador da conta pode pedir a ativação" }, { status: 403 });
    }
    if (isMercadoPagoConfigured()) {
      return NextResponse.json(
        { error: "A IA é contratada direto pelo checkout. Use o botão Assinar.", codigo: "USE_CHECKOUT" },
        { status: 409 }
      );
    }

    const assinatura = await prisma.subscription.upsert({
      where: { userId: user.contaId },
      create: { userId: user.contaId, trialEndsAt: trialEndsAt(), iaSolicitadaEm: new Date() },
      update: { iaSolicitadaEm: new Date() },
      select: { iaLiberadaManual: true },
    });

    if (!assinatura.iaLiberadaManual) {
      const admins = await prisma.user.findMany({
        where: { email: { in: emailsAdminPlataforma(), mode: "insensitive" } },
        select: { id: true },
      });
      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: "SOLICITACAO_PLATAFORMA" as const,
            title: "Pedido de ativação da IA",
            body: `${user.email ?? "Uma conta"} pediu o Skubo IA.`,
            link: "/admin/contas?filtro=ia",
          })),
        });
      }
    }

    return NextResponse.json({ solicitado: true, ativa: assinatura.iaLiberadaManual });
  } catch (error) {
    console.error("[ASSINATURA_IA] Erro ao solicitar ativação:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível registrar o pedido" }, { status: 500 });
  }
}
