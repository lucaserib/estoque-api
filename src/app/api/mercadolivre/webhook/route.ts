// src/app/api/mercadolivre/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar estrutura do webhook do ML
    if (
      !body.resource ||
      !body.user_id ||
      !body.topic ||
      !body.application_id
    ) {
      return NextResponse.json({ error: "Webhook inválido" }, { status: 400 });
    }

    const { resource, user_id, topic, application_id } = body;

    // Encontrar conta ML correspondente
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        mlUserId: user_id.toString(),
        isActive: true,
      },
    });

    if (!account) {
      console.log(`Conta ML não encontrada para user_id: ${user_id}`);
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    // Processar webhook
    try {
      await MercadoLivreService.processWebhook(account.id, {
        resource,
        user_id: user_id.toString(),
        topic,
        application_id: application_id.toString(),
      });

      return NextResponse.json({
        success: true,
        message: "Webhook processado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao processar webhook:", error);

      // Retornar 200 para evitar reenvios desnecessários do ML
      return NextResponse.json(
        { success: false, error: "Erro interno" },
        { status: 200 }
      );
    }
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
    // Endpoint para validação do webhook pelo ML
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
