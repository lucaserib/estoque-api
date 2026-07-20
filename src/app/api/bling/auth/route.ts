import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";

export interface BlingAccountSummary {
  id: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  lastSyncAt: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "accounts") {
      const user = await verifyUser(request);

      const accounts = await prisma.blingAccount.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
          syncHistories: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { completedAt: true, startedAt: true },
          },
        },
      });

      const summaries = accounts.map(({ syncHistories, ...account }) => ({
        ...account,
        lastSyncAt:
          syncHistories[0]?.completedAt ?? syncHistories[0]?.startedAt ?? null,
      }));

      return NextResponse.json(summaries);
    }

    if (action === "connect") {
      const user = await verifyUser(request);

      const state = `${user.id}_${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}`;

      const authUrl = BlingService.getAuthorizationUrl(state);

      return NextResponse.json({ authUrl, state });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    console.error("Erro na autenticação Bling:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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

    const account = await prisma.blingAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    await prisma.blingAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({
      success: true,
      message: "Conta Bling desconectada com sucesso",
    });
  } catch (error) {
    console.error("Erro ao desconectar conta Bling:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
