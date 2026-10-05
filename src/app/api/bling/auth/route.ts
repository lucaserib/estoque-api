import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";
import { buildBlingOAuthStateCookie } from "@/lib/blingOAuthState";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";

export interface BlingAccountSummary {
  id: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  lastSyncAt: string | null;
  tokenFormato: "jwt" | "opaco";
  ultimaSincronizacaoProdutos: string | null;
  ultimaSincronizacaoEstoque: string | null;
  webhooksRecebidos24h: number;
  webhooksComErro24h: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "accounts") {
      const user = await verifyUser(request);
      exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

      const accounts = await prisma.blingAccount.findMany({
        where: { userId: user.contaId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          isActive: true,
          expiresAt: true,
          createdAt: true,
          accessToken: true,
          blingCompanyId: true,
          ultimaSincronizacaoProdutos: true,
          ultimaSincronizacaoEstoque: true,
          syncHistories: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { completedAt: true, startedAt: true },
          },
        },
      });

      const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const summaries: BlingAccountSummary[] = await Promise.all(
        accounts.map(async ({ syncHistories, accessToken, blingCompanyId, ...account }) => {
          const webhooks = blingCompanyId
            ? await prisma.blingWebhookEvent.findMany({
                where: { companyId: blingCompanyId, recebidoEm: { gte: desde24h } },
                select: { erro: true },
              })
            : [];

          return {
            ...account,
            expiresAt: account.expiresAt.toISOString(),
            createdAt: account.createdAt.toISOString(),
            ultimaSincronizacaoProdutos:
              account.ultimaSincronizacaoProdutos?.toISOString() ?? null,
            ultimaSincronizacaoEstoque:
              account.ultimaSincronizacaoEstoque?.toISOString() ?? null,
            lastSyncAt:
              (
                syncHistories[0]?.completedAt ?? syncHistories[0]?.startedAt ?? null
              )?.toString() ?? null,
            tokenFormato: BlingService.detectTokenFormat(accessToken),
            webhooksRecebidos24h: webhooks.length,
            webhooksComErro24h: webhooks.filter((w) => w.erro).length,
          };
        })
      );

      return NextResponse.json(summaries);
    }

    if (action === "connect") {
      const user = await verifyUser(request);
      exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

      const state = crypto.randomBytes(24).toString("hex");
      const authUrl = BlingService.getAuthorizationUrl(state);
      const cookie = buildBlingOAuthStateCookie(state, user.id);

      const response = NextResponse.json({ authUrl });
      response.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: cookie.maxAge,
        path: "/",
      });

      return response;
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

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
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");
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
        userId: user.contaId,
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
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;

    console.error("Erro ao desconectar conta Bling:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
