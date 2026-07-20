import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "connect") {
      try {
        console.log(
          `[ML_AUTH] Gerando URL de autorização para usuário ${user.id}`
        );

        const state = user.id; // Usar ID do usuário como state
        const { authUrl, codeVerifier } =
          await MercadoLivreService.getAuthURLWithVerifier(state);

        const response = NextResponse.json({
          authUrl,
          redirectUri: process.env.ML_REDIRECT_URI,
          state,
          success: true,
        });

        response.cookies.set("ml_pkce_verifier", codeVerifier, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 10 * 60, // 10 minutos
          path: "/",
        });

        return response;
      } catch (error) {
        console.error("[ML_AUTH] Erro ao gerar URL:", error);
        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : "Erro interno",
            success: false,
          },
          { status: 500 }
        );
      }
    }

    if (action === "accounts") {
      const accounts = await MercadoLivreService.getUserAccounts(user.id);
      console.log(
        `[ML_AUTH] ${accounts.length} contas encontradas para usuário ${user.id}`
      );

      const accountsWithDetails = await Promise.all(
        accounts.map(async (account) => {
          try {
            const userInfo = await MercadoLivreService.getUserInfo(
              account.accessToken
            );

            return {
              ...account,
              userInfo: {
                id: userInfo.id,
                nickname: userInfo.nickname,
                firstName: userInfo.first_name,
                lastName: userInfo.last_name,
                email: userInfo.email,
                countryId: userInfo.country_id,
                siteId: userInfo.site_id,
                userType: userInfo.user_type,
                points: userInfo.points,
                permalink: userInfo.permalink,
                logo: userInfo.logo,
                registrationDate: userInfo.registration_date,
                sellerReputation: {
                  levelId: userInfo.seller_reputation?.level_id,
                  powerSellerStatus:
                    userInfo.seller_reputation?.power_seller_status,
                  transactions: userInfo.seller_reputation?.transactions,
                },
                status: userInfo.status,
              },
            };
          } catch (error) {
            console.error(
              `[ML_AUTH] Erro ao buscar detalhes da conta ${account.id}:`,
              error
            );
            return account;
          }
        })
      );

      return NextResponse.json(accountsWithDetails);
    }

    return NextResponse.json(
      { error: "Ação não especificada" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Erro na autenticação ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, state } = body;

    console.log(
      `[ML_AUTH] Processando callback, code: ${
        code ? "presente" : "ausente"
      }, state: ${state}`
    );

    if (!code || !state) {
      console.error("[ML_AUTH] Código ou state não fornecido");
      return NextResponse.json(
        { error: "Código ou state não fornecido" },
        { status: 400 }
      );
    }

    const host = request.headers.get("host") || "";
    const isFromNgrok = host.includes(".ngrok") || host.includes("ngrok");

    console.log(`[ML_AUTH] Host: ${host}, isFromNgrok: ${isFromNgrok}`);

    let userId: string;

    if (isFromNgrok) {
      userId = state;
      console.log(
        `[ML_AUTH] Callback do ngrok, usando state como userId: ${userId}`
      );

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        console.error(`[ML_AUTH] Usuário não encontrado: ${userId}`);
        return NextResponse.json(
          { error: "Usuário não encontrado" },
          { status: 400 }
        );
      }
    } else {
      const user = await verifyUser(request);
      userId = user.id;

      if (state !== userId) {
        console.error(
          `[ML_AUTH] State inválido. Esperado: ${userId}, Recebido: ${state}`
        );
        return NextResponse.json({ error: "State inválido" }, { status: 400 });
      }
    }

    console.log(`[ML_AUTH] Processando callback para usuário ${userId}`);

    try {
      const cookieVerifier = request.cookies.get("ml_pkce_verifier")?.value;
      console.log(
        `[ML_AUTH] Trocando código por tokens... (verifier via cookie: ${
          cookieVerifier ? "sim" : "não"
        })`
      );
      const authResponse = await MercadoLivreService.exchangeCodeForToken(
        code,
        state,
        cookieVerifier
      );

      console.log("[ML_AUTH] Obtendo informações do usuário ML...");
      const userInfo = await MercadoLivreService.getUserInfo(
        authResponse.access_token
      );

      console.log(
        `[ML_AUTH] Salvando conta ML no banco. Nickname: ${userInfo.nickname}, Site: ${userInfo.site_id}`
      );
      const account = await MercadoLivreService.saveAccount(
        userId,
        authResponse,
        userInfo
      );

      console.log(`[ML_AUTH] Conta conectada com sucesso. ID: ${account.id}`);
      const successResponse = NextResponse.json({
        success: true,
        account: {
          id: account.id,
          nickname: account.nickname,
          siteId: account.siteId,
        },
      });
      successResponse.cookies.delete("ml_pkce_verifier");
      return successResponse;
    } catch (mlError) {
      console.error("[ML_AUTH] Erro específico do ML:", mlError);

      if (mlError instanceof Error) {
        if (mlError.message.includes("invalid_grant")) {
          return NextResponse.json(
            {
              error:
                "Código de autorização inválido ou expirado. Tente conectar novamente.",
              success: false,
            },
            { status: 400 }
          );
        }

        if (mlError.message.includes("invalid_client")) {
          return NextResponse.json(
            {
              error:
                "Credenciais da aplicação inválidas. Verifique ML_CLIENT_ID e ML_CLIENT_SECRET.",
              success: false,
            },
            { status: 500 }
          );
        }
      }

      throw mlError; // Re-throw para ser capturado pelo catch geral
    }
  } catch (error) {
    console.error("Erro ao processar callback ML:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao conectar conta",
        success: false,
      },
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

    await MercadoLivreService.disconnectAccount(accountId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao desconectar conta ML:", error);
    return NextResponse.json(
      {
        error: "Erro ao desconectar conta",
        success: false,
      },
      { status: 500 }
    );
  }
}
