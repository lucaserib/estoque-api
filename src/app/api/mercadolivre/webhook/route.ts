import { NextRequest, NextResponse, after } from "next/server";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (
      !body.resource ||
      !body.user_id ||
      !body.topic ||
      !body.application_id
    ) {
      return NextResponse.json({ error: "Webhook inválido" }, { status: 400 });
    }

    const { resource, user_id, topic, application_id } = body;

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        mlUserId: user_id.toString(),
        isActive: true,
      },
      select: { id: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    after(async () => {
      try {
        await MercadoLivreService.processWebhook(account.id, {
          resource,
          user_id: user_id.toString(),
          topic,
          application_id: application_id.toString(),
        });
      } catch (error) {
        console.error("[WEBHOOK] Erro ao processar em background:", error);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro na rota de webhook ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
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
