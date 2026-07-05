import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se a conta pertence ao usuário
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta do Mercado Livre não encontrada ou inativa" },
        { status: 404 }
      );
    }

    // Retornar status do auto-sync (por enquanto, configuração simulada)
    const autoSyncStats = {
      enabled: false, // Por enquanto desabilitado
      lastSync: null,
      totalSyncs: 0,
      successRate: 0,
      configuration: {
        interval: 300000, // 5 minutos
        maxRetries: 3,
        enabledEvents: ["stock_update", "price_update", "new_orders"]
      }
    };

    return NextResponse.json(autoSyncStats);
  } catch (error) {
    console.error("Erro ao buscar status do auto-sync:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const body = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se a conta pertence ao usuário
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta do Mercado Livre não encontrada ou inativa" },
        { status: 404 }
      );
    }

    const { enabled } = body;

    // Por enquanto, apenas simular a ativação/desativação
    console.log(`[AUTO_SYNC] ${enabled ? 'Ativando' : 'Desativando'} auto-sync para conta ${accountId}`);

    return NextResponse.json({
      success: true,
      enabled,
      message: `Auto-sync ${enabled ? 'ativado' : 'desativado'} com sucesso`
    });

  } catch (error) {
    console.error("Erro ao configurar auto-sync:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}