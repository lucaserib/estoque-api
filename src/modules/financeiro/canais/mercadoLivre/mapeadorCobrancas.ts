import type { CobrancaNormalizada } from "../tipos";

/**
 * Formato de cada linha de GET /billing/integration/periods/key/{AAAA-MM-01}/group/ML/details
 * (documentação "Billing reports" do Mercado Livre). Campos opcionais porque a
 * API omite blocos inteiros conforme o tipo da cobrança.
 */
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

/** Sub-tipos documentados (detail_sub_type) → categoria do app. */
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

/**
 * Famílias de sub-tipo vistas na fatura real da LEAPSTORE (out/2026) e que
 * não estão na documentação: todas são cobranças POR VENDA que o pagamento
 * de cada pedido já desconta (sale_fee e frete do vendedor). Antes caíam em
 * NAO_MAPEADO e entravam de novo na DRE como "Outras cobranças do ML" — em
 * outubro, R$ 1.942,36 contados duas vezes (margem 1,5% em vez de ~29%).
 */
const POR_PREFIXO: Array<[RegExp, string]> = [
  [/^CVVPRC/, "TARIFA_MERCADO_PAGO"], // custo por cobrar no Mercado Pago
  [/^CVVFN/, "TARIFA_MERCADO_PAGO"], // taxa de parcelamento / de recebimento (CVVFN, CVVFNU)
  [/^CFON/, "TARIFA_MERCADO_PAGO"], // taxa de parcelamento equivalente ao acréscimo do comprador
  [/^CVV/, "TARIFA_VENDA"], // custo por vender no Mercado Livre (CVVML e variações)
  [/^CFF/, "FRETE"], // tarifa de envio (CFFE intermunicipal, CFFI interno ao município)
];

/** Sub-tipos que são sempre de uma venda específica, mesmo quando a linha vem sem order_id. */
const SEMPRE_DA_VENDA = /^(CVV|CFON|CFF)/;

/** Quando o sub-tipo não é conhecido, o concept_type ainda diz a natureza da cobrança. */
const POR_CONCEITO: Record<string, string> = {
  SHIPPING: "FRETE",
  FLEX: "FRETE",
  FULFILLMENT: "ARMAZENAGEM_FULL",
  ADVERTISING: "PUBLICIDADE",
  ADS: "PUBLICIDADE",
  WARRANTY: "ASSINATURA",
  SUBSCRIPTION: "ASSINATURA",
};

/** Já descontadas no pagamento de cada venda (tarifa e frete do pedido) — na fatura servem só para conferência. */
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
