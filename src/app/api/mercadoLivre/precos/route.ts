import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { MercadoLivreService } from "@/services/mercadoLivreService";

/**
 * API para buscar preços promocionais usando a API oficial do ML
 * Baseado em: https://developers.mercadolivre.com.br/pt_br/api-de-precos
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { itemIds, accountId } = await request.json();

    if (!itemIds || !Array.isArray(itemIds) || !accountId) {
      return NextResponse.json(
        { error: "itemIds (array) e accountId são obrigatórios" },
        { status: 400 }
      );
    }

    console.log(`[PRECOS_API] Buscando preços para ${itemIds.length} produtos`);

    const accessToken = await MercadoLivreService.getValidToken(accountId);
    const precos = [];

    // Buscar preços individualmente usando a API oficial
    for (const itemId of itemIds) {
      try {
        const response = await fetch(
          `https://api.mercadolibre.com/items/${itemId}/prices`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          console.error(
            `[PRECOS_API] Erro ao buscar preços do item ${itemId}:`,
            response.status
          );
          continue;
        }

        const precosData = await response.json();

        // Processar preços conforme documentação oficial
        const precoStandard = precosData.prices?.find(
          (p: {
            type: string;
            conditions?: { context_restrictions?: string[] };
          }) =>
            p.type === "standard" &&
            p.conditions?.context_restrictions?.includes("channel_marketplace")
        );

        const precoPromocional = precosData.prices?.find(
          (p: {
            type: string;
            conditions?: { context_restrictions?: string[] };
          }) =>
            p.type === "promotion" &&
            p.conditions?.context_restrictions?.includes("channel_marketplace")
        );

        // ✅ CORREÇÃO: Padronizar valores para centavos (como outras APIs)
        const precoAtualCentavos = Math.round((precoPromocional?.amount || precoStandard?.amount || 0) * 100);
        const precoOriginalCentavos = precoPromocional?.regular_amount 
          ? Math.round(precoPromocional.regular_amount * 100) 
          : null;

        const preco = {
          mlItemId: itemId,
          precoAtual: precoAtualCentavos, // ✅ AGORA EM CENTAVOS
          precoOriginal: precoOriginalCentavos, // ✅ AGORA EM CENTAVOS
          temPromocao: !!precoPromocional,
          tipoPreco: precoPromocional ? "promotion" : "standard",
          desconto:
            precoPromocional && precoPromocional.regular_amount
              ? Math.round(
                  ((precoPromocional.regular_amount - precoPromocional.amount) /
                    precoPromocional.regular_amount) *
                    100
                )
              : 0,
          inicioPromocao: precoPromocional?.conditions?.start_time || null,
          fimPromocao: precoPromocional?.conditions?.end_time || null,
          ultimaAtualizacao:
            precoPromocional?.last_updated || precoStandard?.last_updated,
        };

        precos.push(preco);

        if (preco.temPromocao) {
          console.log(
            `[PRECOS_API] ✅ ${itemId}: R$ ${(preco.precoAtual / 100).toFixed(
              2
            )} (${preco.desconto}% OFF) - Original: R$ ${(preco.precoOriginal! / 100).toFixed(2)}`
          );
        }

        // Delay para não sobrecarregar a API
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (itemError) {
        console.error(
          `[PRECOS_API] Erro ao processar item ${itemId}:`,
          itemError
        );
      }
    }

    console.log(
      `[PRECOS_API] ✅ ${precos.length} preços processados, ${
        precos.filter((p) => p.temPromocao).length
      } com promoção`
    );

    return NextResponse.json({
      success: true,
      total: precos.length,
      promocoes: precos.filter((p) => p.temPromocao).length,
      precos,
    });
  } catch (error) {
    console.error("[PRECOS_API] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
