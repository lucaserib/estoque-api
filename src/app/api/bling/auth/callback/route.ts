import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlingOAuthError, BlingService } from "@/services/blingService";
import { verifyUser } from "@/helpers/verifyUser";
import { verificarStateBling } from "@/lib/blingOAuthState";
import { origemDaRequisicao } from "@/lib/blingConfig";

function redirecionarParaIntegracoes(request: NextRequest, params: Record<string, string>): NextResponse {
  const destino = new URL("/integracoes", origemDaRequisicao(request.url, request.headers));
  for (const [chave, valor] of Object.entries(params)) destino.searchParams.set(chave, valor);
  return NextResponse.redirect(destino);
}

interface TokensBling {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function salvarConta(contaId: string, tokens: TokensBling): Promise<string> {
  const dados = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    isActive: true,
  };

  const existente = await prisma.blingAccount.findFirst({
    where: { userId: contaId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const conta = existente
    ? await prisma.blingAccount.update({ where: { id: existente.id }, data: dados })
    : await prisma.blingAccount.create({ data: { userId: contaId, ...dados } });

  return conta.id;
}

async function idDaSessao(request: NextRequest): Promise<string | null> {
  try {
    const user = await verifyUser(request);
    return user.id;
  } catch {
    return null;
  }
}

async function resolverConta(userId: string): Promise<string | null> {
  const usuario = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, contaId: true } });
  if (!usuario) return null;
  return usuario.contaId ?? usuario.id;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const erroBling = searchParams.get("error");

  if (erroBling) {
    return redirecionarParaIntegracoes(request, {
      bling_erro: erroBling === "access_denied" ? "acesso_negado" : "bling_recusou",
    });
  }

  if (!code || !state) {
    return redirecionarParaIntegracoes(request, { bling_erro: "parametros_ausentes" });
  }

  const verificacao = verificarStateBling(state, await idDaSessao(request));
  if (!verificacao.ok) {
    console.error("[BLING_CALLBACK] State recusado", { motivo: verificacao.motivo });
    return redirecionarParaIntegracoes(request, {
      bling_erro: verificacao.motivo === "expirado" ? "state_expirado" : "state_invalido",
    });
  }

  const contaId = await resolverConta(verificacao.userId);
  if (!contaId) {
    return redirecionarParaIntegracoes(request, { bling_erro: "sessao_invalida" });
  }

  let tokens: TokensBling;
  try {
    tokens = await BlingService.exchangeCodeForTokens(code);
  } catch (error) {
    if (error instanceof BlingOAuthError) {
      console.error("[BLING_CALLBACK] Troca do código recusada", {
        status: error.status,
        motivo: error.motivo,
        detalhe: error.detalhe,
      });
      return redirecionarParaIntegracoes(request, { bling_erro: error.motivo });
    }
    console.error("[BLING_CALLBACK] Falha de rede ao trocar o código:", error);
    return redirecionarParaIntegracoes(request, { bling_erro: "bling_indisponivel" });
  }

  let accountId: string;
  try {
    accountId = await salvarConta(contaId, tokens);
  } catch (error) {
    console.error("[BLING_CALLBACK] Falha ao gravar a conta Bling:", error);
    return redirecionarParaIntegracoes(request, { bling_erro: "erro_salvar_conta" });
  }

  const [blingCompanyId, escoposFaltando] = await Promise.all([
    BlingService.getCompanyId(accountId),
    BlingService.verificarEscopos(accountId).catch((error: unknown) => {
      console.error("[BLING_CALLBACK] Falha ao testar escopos:", error);
      return [] as string[];
    }),
  ]);

  if (blingCompanyId) {
    await prisma.blingAccount
      .update({ where: { id: accountId }, data: { blingCompanyId } })
      .catch((error: unknown) => console.error("[BLING_CALLBACK] Falha ao gravar o companyId:", error));
  }

  const params: Record<string, string> = { bling: "conectado" };
  if (!blingCompanyId) params.bling_aviso = "empresa_nao_identificada";
  if (escoposFaltando.length > 0) params.bling_escopos = escoposFaltando.join("|");
  return redirecionarParaIntegracoes(request, params);
}
