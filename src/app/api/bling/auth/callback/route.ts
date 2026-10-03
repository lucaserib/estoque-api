import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";
import { verifyUser } from "@/helpers/verifyUser";
import {
  BLING_OAUTH_STATE_COOKIE_NAME,
  verifyBlingOAuthStateCookie,
} from "@/lib/blingOAuthState";

function redirectToIntegracoes(
  request: NextRequest,
  params: Record<string, string>
): NextResponse {
  const redirectUrl = new URL("/integracoes", request.url);
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return redirectToIntegracoes(request, { bling_erro: error });
    }

    if (!code || !state) {
      return redirectToIntegracoes(request, {
        bling_erro: "parametros_ausentes",
      });
    }

    let userId: string;
    try {
      const user = await verifyUser(request);
      userId = user.id;
    } catch (sessionError) {
      console.error("[BLING] Sessão inválida no callback:", sessionError);
      return redirectToIntegracoes(request, { bling_erro: "sessao_invalida" });
    }

    const cookieValue = request.cookies.get(BLING_OAUTH_STATE_COOKIE_NAME)?.value;
    if (!verifyBlingOAuthStateCookie(cookieValue, state, userId)) {
      console.error("[BLING] State inválido no callback");
      return redirectToIntegracoes(request, { bling_erro: "state_invalido" });
    }

    const tokens = await BlingService.exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existingAccount = await prisma.blingAccount.findFirst({
      where: { userId },
    });

    const account = existingAccount
      ? await prisma.blingAccount.update({
          where: { id: existingAccount.id },
          data: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt,
            isActive: true,
          },
        })
      : await prisma.blingAccount.create({
          data: {
            userId,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt,
            isActive: true,
          },
        });

    const blingCompanyId = await BlingService.getCompanyId(account.id);
    if (blingCompanyId) {
      await prisma.blingAccount.update({
        where: { id: account.id },
        data: { blingCompanyId },
      });
    }

    return redirectToIntegracoes(request, { bling: "conectado" });
  } catch (error) {
    console.error("Erro no callback do Bling:", error);
    return redirectToIntegracoes(request, { bling_erro: "falha_conexao" });
  }
}
