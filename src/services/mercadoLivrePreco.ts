import { fetchMlWithBackoff } from "@/lib/mlFetch";

export interface PrecoAtualAnuncio {
  precoAtual: number;
  precoOriginal: number | null;
  temPromocao: boolean;
  fonte: "SALE_PRICE" | "PRICES_FALLBACK";
}

interface SalePriceBruto {
  amount?: number;
  regular_amount?: number | null;
}

interface PrecoBruto {
  type?: string;
  amount?: number;
  regular_amount?: number;
  conditions?: { context_restrictions?: string[] };
}

/**
 * Endpoint correto do preço atual do anúncio (ainda não confirmado contra
 * uma resposta real — ambiente de dev não alcança api.mercadolibre.com).
 * `amount` é o preço que o comprador paga agora; `regular_amount` é o preço
 * "de" quando há promoção ativa. Sem resposta válida, cai para a lógica
 * antiga (`/items/{id}/prices`, primeira promoção com
 * `channel_marketplace`), que já era usada pelas três sincronizações hoje.
 */
export async function obterPrecoAtualAnuncio(
  itemId: string,
  accessToken: string
): Promise<PrecoAtualAnuncio | null> {
  try {
    const resposta = await fetchMlWithBackoff(
      `https://api.mercadolibre.com/items/${itemId}/sale_price?context=channel_marketplace`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (resposta.ok) {
      const dados = (await resposta.json()) as SalePriceBruto;
      if (typeof dados.amount === "number") {
        const precoOriginal = typeof dados.regular_amount === "number" ? dados.regular_amount : null;
        return {
          precoAtual: Math.round(dados.amount * 100),
          precoOriginal: precoOriginal != null ? Math.round(precoOriginal * 100) : null,
          temPromocao: precoOriginal != null && precoOriginal > dados.amount,
          fonte: "SALE_PRICE",
        };
      }
    }
  } catch (erro) {
    console.error(`[PRECO_ML] Erro ao buscar sale_price do anúncio ${itemId}:`, erro);
  }

  return obterPrecoViaPricesFallback(itemId, accessToken);
}

async function obterPrecoViaPricesFallback(
  itemId: string,
  accessToken: string
): Promise<PrecoAtualAnuncio | null> {
  try {
    const resposta = await fetchMlWithBackoff(
      `https://api.mercadolibre.com/items/${itemId}/prices`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!resposta.ok) return null;

    const dados = (await resposta.json()) as { prices?: PrecoBruto[] };
    const precos = dados.prices ?? [];

    const promocao = precos.find(
      (p) => p.type === "promotion" && p.conditions?.context_restrictions?.includes("channel_marketplace")
    );
    if (promocao && typeof promocao.amount === "number" && typeof promocao.regular_amount === "number") {
      return {
        precoAtual: Math.round(promocao.amount * 100),
        precoOriginal: Math.round(promocao.regular_amount * 100),
        temPromocao: true,
        fonte: "PRICES_FALLBACK",
      };
    }

    const padrao = precos.find(
      (p) => p.type === "standard" && p.conditions?.context_restrictions?.includes("channel_marketplace")
    );
    if (padrao && typeof padrao.amount === "number") {
      return {
        precoAtual: Math.round(padrao.amount * 100),
        precoOriginal: null,
        temPromocao: false,
        fonte: "PRICES_FALLBACK",
      };
    }

    return null;
  } catch (erro) {
    console.error(`[PRECO_ML] Erro no fallback de preços do anúncio ${itemId}:`, erro);
    return null;
  }
}
