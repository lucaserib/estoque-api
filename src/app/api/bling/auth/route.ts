import { NextRequest, NextResponse } from "next/server";
import { verifyUserAtivo } from "@/helpers/verifyUserAtivo";
import { prisma } from "@/lib/prisma";
import { BlingReconnectError, BlingService } from "@/services/blingService";
import { criarStateBling } from "@/lib/blingOAuthState";
import { exigirPermissao, permissaoErrorResponse } from "@/lib/permissoes";
import { diagnosticarConfiguracaoBling, origemDaRequisicao } from "@/lib/blingConfig";

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
  ultimoWebhookRecebidoEm: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "accounts") {
      const user = await verifyUserAtivo(request);
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
          const [webhooks, ultimoWebhook] = blingCompanyId
            ? await Promise.all([
                prisma.blingWebhookEvent.findMany({
                  where: { companyId: blingCompanyId, recebidoEm: { gte: desde24h } },
                  select: { erro: true },
                }),
                prisma.blingWebhookEvent.findFirst({
                  where: { companyId: blingCompanyId },
                  orderBy: { recebidoEm: "desc" },
                  select: { recebidoEm: true },
                }),
              ])
            : [[], null];

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
            ultimoWebhookRecebidoEm: ultimoWebhook?.recebidoEm.toISOString() ?? null,
          };
        })
      );

      return NextResponse.json(summaries);
    }

    if (action === "diagnostico") {
      const user = await verifyUserAtivo(request);
      exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

      return NextResponse.json(
        diagnosticarConfiguracaoBling(origemDaRequisicao(request.url, request.headers))
      );
    }

    if (action === "connect") {
      const user = await verifyUserAtivo(request);
      exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

      const origem = origemDaRequisicao(request.url, request.headers);
      const diagnostico = diagnosticarConfiguracaoBling(origem);
      if (!diagnostico.ok) {
        return NextResponse.json(
          {
            error: "A configuração do servidor impede a conexão com o Bling.",
            code: "BLING_CONFIG",
            diagnostico,
          },
          { status: 503 }
        );
      }

      const authUrl = BlingService.getAuthorizationUrl(criarStateBling(user.id));
      return NextResponse.json({ authUrl });
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

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("action") !== "verificar") {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const user = await verifyUserAtivo(request);
    exigirPermissao(user.role, "INTEGRACOES_USUARIOS_ASSINATURA");

    const conta = await prisma.blingAccount.findFirst({
      where: { userId: user.contaId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, blingCompanyId: true },
    });
    if (!conta) {
      return NextResponse.json(
        { error: "Nenhuma conta do Bling ativa. Conecte ou reconecte o Bling.", code: "BLING_DESCONECTADO" },
        { status: 404 }
      );
    }

    const escoposFaltando = await BlingService.verificarEscopos(conta.id);
    let empresaIdentificada = Boolean(conta.blingCompanyId);
    if (!empresaIdentificada && !escoposFaltando.includes("Dados básicos da empresa")) {
      const companyId = await BlingService.getCompanyId(conta.id);
      if (companyId) {
        await prisma.blingAccount.update({ where: { id: conta.id }, data: { blingCompanyId: companyId } });
        empresaIdentificada = true;
      }
    }

    return NextResponse.json({ escoposFaltando, empresaIdentificada });
  } catch (error) {
    const permissaoResponse = permissaoErrorResponse(error);
    if (permissaoResponse) return permissaoResponse;
    if (error instanceof BlingReconnectError) {
      return NextResponse.json(
        { error: "O acesso ao Bling expirou. Clique em Reconectar.", code: "BLING_RECONECTAR" },
        { status: 409 }
      );
    }
    console.error("[BLING_VERIFICAR] Erro ao verificar permissões:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Não foi possível falar com o Bling agora." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyUserAtivo(request);
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
