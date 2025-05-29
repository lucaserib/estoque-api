import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "connect") {
      // Gerar URL de autorização
      const state = user.id; // Usar ID do usuário como state para verificação
      const authUrl = MercadoLivreService.getAuthURL(state);

      return NextResponse.json({ authUrl });
    }

    if (action === "accounts") {
      // Listar contas conectadas
      const accounts = await MercadoLivreService.getUserAccounts(user.id);
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

    if (!code || !state) {
      return NextResponse.json(
        { error: "Código ou state não fornecido" },
        { status: 400 }
      );
    }

    // Verificar se o state corresponde ao usuário atual
    if (state !== user.id) {
      return NextResponse.json({ error: "State inválido" }, { status: 400 });
    }

    // Trocar código por tokens
    const authResponse = await MercadoLivreService.exchangeCodeForToken(code);

    // Obter informações do usuário ML
    const userInfo = await MercadoLivreService.getUserInfo(
      authResponse.access_token
    );

    // Salvar conta no banco
    const account = await MercadoLivreService.saveAccount(
      user.id,
      authResponse,
      userInfo
    );

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        nickname: account.nickname,
        siteId: account.siteId,
      },
    });
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
