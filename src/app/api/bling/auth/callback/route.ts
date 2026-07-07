import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";

/**
 * GET /api/bling/auth/callback
 * Callback OAuth do Bling
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Se usuário negou autorização
    if (error) {
      const redirectUrl = new URL("/produtos", request.url);
      redirectUrl.searchParams.set("bling_error", error);
      return NextResponse.redirect(redirectUrl);
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: "Código de autorização ou state não fornecido" },
        { status: 400 }
      );
    }

    // Extrair userId do state (separador "_" pois o UUID contém "-")
    const userId = state.split("_")[0];

    // Validar que o userId é um UUID íntegro antes de gravar no banco
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!userId || !uuidRegex.test(userId)) {
      console.error(
        `[BLING] State inválido no callback — userId corrompido: "${userId}"`
      );
      return NextResponse.json(
        { error: "State inválido" },
        { status: 400 }
      );
    }

    console.log(`[BLING] Callback recebido para usuário ${userId}`);

    // Trocar código por tokens
    const tokens = await BlingService.exchangeCodeForTokens(code);

    console.log("[BLING] Tokens obtidos com sucesso");

    // Calcular data de expiração
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Verificar se já existe conta para este usuário
    const existingAccount = await prisma.blingAccount.findFirst({
      where: { userId },
    });

    if (existingAccount) {
      // Atualizar conta existente
      await prisma.blingAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          isActive: true,
        },
      });

      console.log("[BLING] Conta atualizada com sucesso");
    } else {
      // Criar nova conta
      await prisma.blingAccount.create({
        data: {
          userId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          isActive: true,
        },
      });

      console.log("[BLING] Nova conta criada com sucesso");
    }

    // Redirecionar para página de produtos com sucesso
    const redirectUrl = new URL("/produtos", request.url);
    redirectUrl.searchParams.set("bling_connected", "true");

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Erro no callback do Bling:", error);

    // Redirecionar para página de produtos com erro
    const redirectUrl = new URL("/produtos", request.url);
    redirectUrl.searchParams.set("bling_error", "connection_failed");

    return NextResponse.redirect(redirectUrl);
  }
}
