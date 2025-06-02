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
        const authUrl = await MercadoLivreService.getAuthURL(state);

        return NextResponse.json({
          authUrl,
          redirectUri: process.env.ML_REDIRECT_URI,
          state,
          success: true,
        });
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
      // Listar contas conectadas com informações detalhadas
      const accounts = await MercadoLivreService.getUserAccounts(user.id);
      console.log(
        `[ML_AUTH] ${accounts.length} contas encontradas para usuário ${user.id}`
      );

      // Para cada conta, buscar informações atualizadas do usuário
      const accountsWithDetails = await Promise.all(
        accounts.map(async (account) => {
          try {
            // Buscar informações atualizadas do usuário ML
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
            // Retornar conta sem detalhes em caso de erro
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

    // Verificar se é um callback do ngrok (sem sessão) ou do localhost (com sessão)
    const host = request.headers.get("host") || "";
    const isFromNgrok = host.includes(".ngrok") || host.includes("ngrok");

    console.log(`[ML_AUTH] Host: ${host}, isFromNgrok: ${isFromNgrok}`);

    let userId: string;

    if (isFromNgrok) {
      // Para callbacks do ngrok, usar o state como userId diretamente
      userId = state;
      console.log(
        `[ML_AUTH] Callback do ngrok, usando state como userId: ${userId}`
      );

      // Verificar se o usuário existe no banco
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
      // Para callbacks do localhost, usar verificação normal
      const user = await verifyUser(request);
      userId = user.id;

      // Verificar se o state corresponde ao usuário atual
      if (state !== userId) {
        console.error(
          `[ML_AUTH] State inválido. Esperado: ${userId}, Recebido: ${state}`
        );
        return NextResponse.json({ error: "State inválido" }, { status: 400 });
      }
    }

    console.log(`[ML_AUTH] Processando callback para usuário ${userId}`);

    try {
      // Trocar código por tokens
      console.log("[ML_AUTH] Trocando código por tokens...");
      const authResponse = await MercadoLivreService.exchangeCodeForToken(
        code,
        state
      );

      // Obter informações do usuário ML
      console.log("[ML_AUTH] Obtendo informações do usuário ML...");
      const userInfo = await MercadoLivreService.getUserInfo(
        authResponse.access_token
      );

      // Salvar conta no banco
      console.log(
        `[ML_AUTH] Salvando conta ML no banco. Nickname: ${userInfo.nickname}, Site: ${userInfo.site_id}`
      );
      const account = await MercadoLivreService.saveAccount(
        userId,
        authResponse,
        userInfo
      );

      console.log(`[ML_AUTH] Conta conectada com sucesso. ID: ${account.id}`);
      return NextResponse.json({
        success: true,
        account: {
          id: account.id,
          nickname: account.nickname,
          siteId: account.siteId,
        },
      });
    } catch (mlError) {
      console.error("[ML_AUTH] Erro específico do ML:", mlError);

      // Tratar erros específicos da API do ML
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

    // Desconectar conta
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
