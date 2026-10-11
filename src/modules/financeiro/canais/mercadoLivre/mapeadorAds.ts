import type { GastoAdsNormalizado } from "../tipos";

export interface GastoAdsBruto {
  id?: string | number;
  campaign_id?: string | number;
  item_id?: string;
  metrics?: {
    clicks?: number;
    prints?: number;
    cost?: number;
    direct_amount?: number;
    direct_items_quantity?: number;
  };
}

/**
 * Mapeamento de melhor esforço contra a documentação pública de Product Ads
 * — ao contrário de pedidos/descontos/frete (APIs centrais, estáveis), esta
 * é a parte do Ciclo 7 com menor confiança: nem o endpoint em si foi
 * confirmado contra uma conta real (ver docs/financeiro/fontes-mercado-livre.md).
 * Falha graciosamente: `cliente.ts` devolve lista vazia em qualquer erro, em
 * vez de quebrar a ingestão do dia.
 */
export function mapearGastoAds(bruto: GastoAdsBruto): GastoAdsNormalizado {
  const metrics = bruto.metrics ?? {};
  const anuncioExternoId =
    bruto.item_id ?? (bruto.id != null ? String(bruto.id) : null);

  return {
    campanhaExternaId: bruto.campaign_id != null ? String(bruto.campaign_id) : null,
    anuncioExternoId,
    custo: typeof metrics.cost === "number" ? Math.round(metrics.cost * 100) : 0,
    cliques: typeof metrics.clicks === "number" ? metrics.clicks : null,
    impressoes: typeof metrics.prints === "number" ? metrics.prints : null,
    vendasAtribuidas:
      typeof metrics.direct_items_quantity === "number"
        ? metrics.direct_items_quantity
        : null,
    receitaAtribuida:
      typeof metrics.direct_amount === "number"
        ? Math.round(metrics.direct_amount * 100)
        : null,
  };
}
