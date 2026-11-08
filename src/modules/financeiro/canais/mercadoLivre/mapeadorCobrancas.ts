import type { CobrancaNormalizada } from "../tipos";

export interface CobrancaBruta {
  charge_info?: {
    detail_id?: number | string;
    detail_amount?: number;
    detail_type?: string;
    detail_sub_type?: string;
    concept_type?: string;
    transaction_detail?: string;
    creation_date_time?: string;
    debited_from_operation?: string;
    legal_document_number?: string | number;
    payment_id?: number | string;
  };
  sales_info?: Array<{ order_id?: number | string | null; transaction_amount?: number }> | null;
  items_info?: Array<{ item_id?: string | null; order_id?: number | string | null }> | null;
  shipping_info?: { shipping_id?: number | string | null; pack_id?: number | string | null } | null;
  discount_info?: { discount_amount?: number } | null;
  fulfillment_info?: { type?: string; item_id?: string | null } | null;
  document_info?: { document_id?: number | string } | null;
}

const POR_SUB_TIPO: Record<string, string> = {
  CV: "TARIFA_VENDA",
  BV: "BONIFICACAO",
  BXD: "BONIFICACAO",
  CXD: "FRETE",
  PADS: "PUBLICIDADE",
  CCMP: "TARIFA_MERCADO_PAGO",
  CFLX: "FRETE",
  CFCB: "ARMAZENAGEM_FULL",
  CEW: "ASSINATURA",
};

const POR_PREFIXO: Array<[RegExp, string]> = [
  [/^CVVPRC/, "TARIFA_MERCADO_PAGO"],
  [/^CVVFN/, "TARIFA_MERCADO_PAGO"],
  [/^CFON/, "TARIFA_MERCADO_PAGO"],
  [/^CVV/, "TARIFA_VENDA"],
  [/^CFF/, "FRETE"],
];

const SEMPRE_DA_VENDA = /^(CVV|CFON|CFF)/;

const POR_CONCEITO: Record<string, string> = {
  SHIPPING: "FRETE",
  FLEX: "FRETE",
  FULFILLMENT: "ARMAZENAGEM_FULL",
  ADVERTISING: "PUBLICIDADE",
  ADS: "PUBLICIDADE",
  WARRANTY: "ASSINATURA",
  SUBSCRIPTION: "ASSINATURA",
};

const TIPOS_COBERTOS_PELO_PEDIDO = new Set(["TARIFA_VENDA", "FRETE", "BONIFICACAO", "TARIFA_MERCADO_PAGO"]);

export function classificarCobranca(subTipo: string | null, conceito: string | null): string {
  if (subTipo && POR_SUB_TIPO[subTipo]) return POR_SUB_TIPO[subTipo];
  const porPrefixo = subTipo ? POR_PREFIXO.find(([padrao]) => padrao.test(subTipo)) : undefined;
  if (porPrefixo) return porPrefixo[1];
  if (conceito && POR_CONCEITO[conceito.toUpperCase()]) return POR_CONCEITO[conceito.toUpperCase()];
  return "NAO_MAPEADO";
}

function idOuNulo(valor: unknown): string | null {
  return valor == null || valor === "" ? null : String(valor);
}

export function mapearCobranca(
  bruto: CobrancaBruta,
  tipoDocumento: "BILL" | "CREDIT_NOTE" = "BILL"
): CobrancaNormalizada | null {
  const info = bruto.charge_info ?? {};
  const detalheId = idOuNulo(info.detail_id);
  if (!detalheId) return null;

  const subTipo = info.detail_sub_type ?? null;
  const conceito = info.concept_type ?? null;
  let tipoNormalizado = classificarCobranca(subTipo, conceito);
  const ehBonus = (info.detail_type ?? "").toUpperCase() === "BONUS" || tipoDocumento === "CREDIT_NOTE";
  if (ehBonus && tipoNormalizado === "NAO_MAPEADO") tipoNormalizado = "BONIFICACAO";

  const valorAbsoluto = typeof info.detail_amount === "number" ? Math.round(Math.abs(info.detail_amount) * 100) : 0;
  const valor = ehBonus ? -valorAbsoluto : valorAbsoluto;

  const pedidoExternoId =
    idOuNulo(bruto.sales_info?.find((s) => s.order_id != null)?.order_id) ??
    idOuNulo(bruto.items_info?.find((i) => i.order_id != null)?.order_id);
  const anuncioExternoId =
    idOuNulo(bruto.items_info?.find((i) => i.item_id)?.item_id) ?? idOuNulo(bruto.fulfillment_info?.item_id);

  const rotulo = [subTipo, info.transaction_detail].filter(Boolean).join(" — ");

  return {
    detalheExternoId: `${tipoDocumento}:${detalheId}`,
    tipoExterno: rotulo || conceito || "DESCONHECIDO",
    tipoNormalizado,
    valor,
    pedidoExternoId,
    anuncioExternoId,
    data: info.creation_date_time ? new Date(info.creation_date_time) : new Date(),
    coberturaPedido:
      TIPOS_COBERTOS_PELO_PEDIDO.has(tipoNormalizado) &&
      (pedidoExternoId != null || (subTipo != null && SEMPRE_DA_VENDA.test(subTipo))),
  };
}
