import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlingOAuthError, BlingService } from "@/services/blingService";
import { verifyUser } from "@/helpers/verifyUser";
import {
  BLING_OAUTH_STATE_COOKIE_NAME,
  verifyBlingOAuthStateCookie,
} from "@/lib/blingOAuthState";
import { origemDaRequisicao } from "@/lib/blingConfig";

function redirectToIntegracoes(
  request: NextRequest,
  params: Record<string, string>
): NextResponse {
  const redirectUrl = new URL(
    "/integracoes",
    origemDaRequisicao(request.url, request.headers)
  );
  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set(BLING_OAUTH_STATE_COOKIE_NAME, "", {
    maxAge: 0,
    path: "/",
  });
  return response;
}

interface TokensBling {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

async function salvarConta(contaId: string, tokens: TokensBling): Promise<string> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const dados = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    isActive: true,
  };

  const existente = await prisma.blingAccount.findFirst({
    where: { userId: contaId },
    select: { id: true },
  });

  const conta = existente
    ? await prisma.blingAccount.update({ where: { id: existente.id }, data: dados })
    : await prisma.blingAccount.create({ data: { userId: contaId, ...dados } });

  return conta.id;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorBling = searchParams.get("error");

  if (errorBling) {
    return redirectToIntegracoes(request, {
      bling_erro: errorBling === "access_denied" ? "acesso_negado" : "bling_recusou",
    });
  }

  if (!code || !state) {
    return redirectToIntegracoes(request, { bling_erro: "parametros_ausentes" });
  }

  let userId: string;
  let contaId: string;
  try {
    const user = await verifyUser(request);
    userId = user.id;
    contaId = user.contaId;
  } catch (sessionError) {
    console.error("[BLING_CALLBACK] Sessão ausente no retorno do Bling:", sessionError);
    return redirectToIntegracoes(request, { bling_erro: "sessao_invalida" });
  }

  const cookieValue = request.cookies.get(BLING_OAUTH_STATE_COOKIE_NAME)?.value;
  if (!verifyBlingOAuthStateCookie(cookieValue, state, userId)) {
    console.error("[BLING_CALLBACK] State inválido", {
      cookiePresente: Boolean(cookieValue),
    });
    return redirectToIntegracoes(request, {
      bling_erro: cookieValue ? "state_invalido" : "state_expirado",
    });
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
      return redirectToIntegracoes(request, { bling_erro: error.motivo });
    }
    console.error("[BLING_CALLBACK] Falha de rede ao trocar o código:", error);
    return redirectToIntegracoes(request, { bling_erro: "bling_indisponivel" });
  }

  let accountId: string;
  try {
    accountId = await salvarConta(contaId, tokens);
  } catch (error) {
    console.error("[BLING_CALLBACK] Falha ao gravar a conta Bling:", error);
    return redirectToIntegracoes(request, { bling_erro: "erro_salvar_conta" });
  }

  const blingCompanyId = await BlingService.getCompanyId(accountId);
  const companyIdGravado = blingCompanyId
    ? await prisma.blingAccount
        .update({ where: { id: accountId }, data: { blingCompanyId } })
        .then(() => true)
        .catch((error: unknown) => {
          console.error("[BLING_CALLBACK] Falha ao gravar o companyId:", error);
          return false;
        })
    : false;

  return redirectToIntegracoes(
    request,
    companyIdGravado
      ? { bling: "conectado" }
      : { bling: "conectado", bling_aviso: "empresa_nao_identificada" }
  );
}
