import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { MercadoLivreService } from "@/services/mercadoLivreService";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const action = searchParams.get("action");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const categoryId = searchParams.get("categoryId");

    if (!accountId) {
      return NextResponse.json(
        { error: "ID da conta é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se a conta pertence ao usuário
    const accounts = await MercadoLivreService.getUserAccounts(user.id);
    const account = accounts.find((acc) => acc.id === accountId);

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    // Obter token válido
    const accessToken = await MercadoLivreService.getValidToken(accountId);

    switch (action) {
      case "sales":
        try {
          const salesStats = await MercadoLivreService.getSalesStats(
            accessToken,
            {
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
            }
          );
          return NextResponse.json(salesStats);
        } catch (error) {
          console.error("Erro ao buscar estatísticas de vendas:", error);
          return NextResponse.json(
            { error: "Erro ao buscar estatísticas de vendas" },
            { status: 500 }
          );
        }

      case "fees":
        try {
          const marketplaceFees = await MercadoLivreService.getMarketplaceFees(
            accessToken,
            categoryId || undefined
          );
          return NextResponse.json(marketplaceFees);
        } catch (error) {
          console.error("Erro ao buscar taxas do marketplace:", error);
          return NextResponse.json(
            { error: "Erro ao buscar taxas do marketplace" },
            { status: 500 }
          );
        }

      case "financial":
        try {
          const financialInfo =
            await MercadoLivreService.getSellerFinancialInfo(accessToken);
          return NextResponse.json(financialInfo);
        } catch (error) {
          console.error("Erro ao buscar informações financeiras:", error);
          return NextResponse.json(
            { error: "Erro ao buscar informações financeiras" },
            { status: 500 }
          );
        }

      case "sync-sku":
        try {
          const syncResult = await MercadoLivreService.syncProductsBySKU(
            accessToken,
            accountId
          );
          return NextResponse.json(syncResult);
        } catch (error) {
          console.error("Erro ao sincronizar produtos por SKU:", error);
          return NextResponse.json(
            { error: "Erro ao sincronizar produtos por SKU" },
            { status: 500 }
          );
        }

      case "dashboard":
        try {
          // Buscar múltiplos dados para o dashboard
          const [salesStats, marketplaceFees, financialInfo] =
            await Promise.allSettled([
              MercadoLivreService.getSalesStats(accessToken, {
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
              }),
              MercadoLivreService.getMarketplaceFees(accessToken),
              MercadoLivreService.getSellerFinancialInfo(accessToken),
            ]);

          return NextResponse.json({
            sales: salesStats.status === "fulfilled" ? salesStats.value : null,
            fees:
              marketplaceFees.status === "fulfilled"
                ? marketplaceFees.value
                : null,
            financial:
              financialInfo.status === "fulfilled" ? financialInfo.value : null,
          });
        } catch (error) {
          console.error("Erro ao buscar dados do dashboard:", error);
          return NextResponse.json(
            { error: "Erro ao buscar dados do dashboard" },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          { error: "Ação não especificada ou inválida" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Erro na API de analytics do ML:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
