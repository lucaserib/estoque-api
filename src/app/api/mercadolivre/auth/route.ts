import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "connect") {
      try {
        // Gerar URL de autorização
        const state = user.id; // Usar ID do usuário como state para verificação
        const authUrl = MercadoLivreService.getAuthURL(state);

        console.log(
          `[ML_AUTH] URL de autorização gerada para usuário ${user.id}`
        );
        return NextResponse.json({ authUrl });
      } catch (configError) {
        console.error("[ML_AUTH] Erro de configuração:", configError);

        // Verificar se é um erro de configuração específico
        if (configError instanceof Error) {
          if (configError.message.includes("ML_CLIENT_ID")) {
            return NextResponse.json(
              {
                error: "ML_CLIENT_ID não configurado",
                details:
                  "Configure a variável de ambiente ML_CLIENT_ID com o APP ID da sua aplicação no Mercado Livre.",
                configError: true,
              },
              { status: 500 }
            );
          }

          if (configError.message.includes("ML_CLIENT_SECRET")) {
            return NextResponse.json(
              {
                error: "ML_CLIENT_SECRET não configurado",
                details:
                  "Configure a variável de ambiente ML_CLIENT_SECRET com a Secret Key da sua aplicação no Mercado Livre.",
                configError: true,
              },
              { status: 500 }
            );
          }

          if (configError.message.includes("ML_REDIRECT_URI")) {
            return NextResponse.json(
              {
                error: "ML_REDIRECT_URI não configurado",
                details:
                  "Configure a variável de ambiente ML_REDIRECT_URI com a URL de callback da sua aplicação.",
                configError: true,
              },
              { status: 500 }
            );
          }
        }

        return NextResponse.json(
          {
            error: "Configuração do Mercado Livre incompleta",
            details:
              "Verifique se todas as variáveis de ambiente estão configuradas: ML_CLIENT_ID, ML_CLIENT_SECRET e ML_REDIRECT_URI.",
            configError: true,
          },
          { status: 500 }
        );
      }
    }

    if (action === "accounts") {
      // Listar contas conectadas
      const accounts = await MercadoLivreService.getUserAccounts(user.id);
      console.log(
        `[ML_AUTH] ${accounts.length} contas encontradas para usuário ${user.id}`
      );
      return NextResponse.json(accounts);
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
    const user = await verifyUser(request);
    const body = await request.json();
    const { code, state } = body;

    console.log(
      `[ML_AUTH] Processando callback para usuário ${user.id}, code: ${
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

    // Verificar se o state corresponde ao usuário atual
    if (state !== user.id) {
      console.error(
        `[ML_AUTH] State inválido. Esperado: ${user.id}, Recebido: ${state}`
      );
      return NextResponse.json({ error: "State inválido" }, { status: 400 });
    }

    try {
      // Trocar código por tokens
      console.log("[ML_AUTH] Trocando código por tokens...");
      const authResponse = await MercadoLivreService.exchangeCodeForToken(code);

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
        user.id,
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
