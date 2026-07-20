import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BlingService } from "@/services/blingService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

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

    const userId = state.split("_")[0];

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

    const tokens = await BlingService.exchangeCodeForTokens(code);

    console.log("[BLING] Tokens obtidos com sucesso");

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const existingAccount = await prisma.blingAccount.findFirst({
      where: { userId },
    });

    if (existingAccount) {
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

    const redirectUrl = new URL("/produtos", request.url);
    redirectUrl.searchParams.set("bling_connected", "true");

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("Erro no callback do Bling:", error);

    const redirectUrl = new URL("/produtos", request.url);
    redirectUrl.searchParams.set("bling_error", "connection_failed");

    return NextResponse.redirect(redirectUrl);
  }
}
