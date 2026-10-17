import type { CobrancaNormalizada } from "../tipos";

export interface CobrancaBruta {
  id?: string | number;
  date?: string;
  amount?: number;
  order_id?: string | number | null;
  item_id?: string | null;
  charge_type?: string;
  details_type?: string;
  concept?: string;
}

/**
 * Nomes de tipo (`charge_type`/`details_type`/`concept`) são a parte menos
 * confirmada deste mapeador — vieram de exemplos de documentação, não de
 * uma fatura real. Qualquer tipo fora do mapa cai em "NAO_MAPEADO" e ainda
 * assim entra no valor total (nada é descartado em silêncio); a tela de
 * configurações (Fase 7) lista os não mapeados pra revisão manual.
 */
const TIPOS_CONHECIDOS: Record<string, string> = {
  marketplace_fee: "TARIFA_VENDA",
  sale_fee: "TARIFA_VENDA",
  shipping_fee: "FRETE",
  shipping: "FRETE",
  fulfillment_fee: "ARMAZENAGEM_FULL",
  storage_fee: "ARMAZENAGEM_FULL",
  advertising_fee: "PUBLICIDADE",
  ads: "PUBLICIDADE",
  PADS: "PUBLICIDADE",
};

/** Essas duas já aparecem no pedido (tarifaVenda/freteVendedor) — a cobrança correspondente serve só para conciliação, não soma de novo na DRE. */
const TIPOS_COBERTOS_PELO_PEDIDO = new Set(["TARIFA_VENDA", "FRETE"]);

export function mapearCobranca(bruto: CobrancaBruta): CobrancaNormalizada {
  const tipoExterno = bruto.charge_type ?? bruto.details_type ?? bruto.concept ?? "DESCONHECIDO";
  const tipoNormalizado = TIPOS_CONHECIDOS[tipoExterno] ?? "NAO_MAPEADO";

  return {
    detalheExternoId: String(bruto.id ?? ""),
    tipoExterno,
    tipoNormalizado,
    valor: typeof bruto.amount === "number" ? Math.round(bruto.amount * 100) : 0,
    pedidoExternoId: bruto.order_id != null ? String(bruto.order_id) : null,
    anuncioExternoId: bruto.item_id ?? null,
    data: bruto.date ? new Date(bruto.date) : new Date(),
    coberturaPedido: TIPOS_COBERTOS_PELO_PEDIDO.has(tipoNormalizado),
  };
}
