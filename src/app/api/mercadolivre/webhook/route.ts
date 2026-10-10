import { NextRequest, NextResponse, after } from "next/server";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (
      !body._id ||
      !body.resource ||
      !body.user_id ||
      !body.topic ||
      !body.application_id
    ) {
      return NextResponse.json({ error: "Webhook inválido" }, { status: 400 });
    }

    const notificationId = body._id.toString();
    const { resource, user_id, topic, application_id } = body;

    if (application_id.toString() !== process.env.ML_CLIENT_ID) {
      console.warn(
        `[WEBHOOK] application_id inesperado recebido: ${application_id}`
      );
      return NextResponse.json({ success: true });
    }

    const existente = await prisma.mercadoLivreWebhook.findUnique({
      where: { mlNotificationId: notificationId },
      select: { id: true },
    });

    if (existente) {
      return NextResponse.json({ success: true, duplicado: true });
    }

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        mlUserId: user_id.toString(),
        isActive: true,
      },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json({ success: true });
    }

    const registro = await prisma.mercadoLivreWebhook.create({
      data: {
        mercadoLivreAccountId: account.id,
        mlNotificationId: notificationId,
        topic,
        resource,
        userId: user_id.toString(),
        applicationId: application_id.toString(),
        processed: false,
        attempts: 1,
      },
    });

    after(async () => {
      try {
        await MercadoLivreService.processWebhookEvent(registro.id);
      } catch (error) {
        console.error("[WEBHOOK] Erro ao processar em background:", error);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro na rota de webhook ML:", error);
    return NextResponse.json({ success: true });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const challenge = searchParams.get("challenge");

    if (challenge) {
      return NextResponse.json({ challenge });
    }

    return NextResponse.json({
      message: "Endpoint de webhook ML ativo",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Erro na validação de webhook ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
