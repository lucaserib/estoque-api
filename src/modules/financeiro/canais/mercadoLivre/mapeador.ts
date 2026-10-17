import { StatusVendaCanal, Confianca } from "@prisma/client";
import type { MLOrder } from "@/types/mercadolivre";
import type {
  CustoEnvioNormalizado,
  ItemVendaCanalNormalizado,
  VendaCanalNormalizada,
} from "../tipos";

interface DescontoBruto {
  full?: number;
  seller?: number;
}

interface PagamentoBruto {
  status?: string;
  money_release_date?: string | null;
}

interface CustoEnvioBruto {
  senders?: Array<{
    cost?: number;
    compensation?: number;
    compensations?: Array<{ amount?: number }>;
  }>;
}

/**
 * Nem todo status do ML já é financeiramente relevante (regime de
 * competência: só entra quando foi pago). `cancelled` sem nenhum pagamento
 * aprovado nunca chegou a existir financeiramente — não ingere.
 *
 * Distinção CANCELADA × DEVOLVIDA via `order_request.return`: baseada no tipo
 * já existente neste repositório (não confirmada contra um pedido real —
 * ver docs/financeiro/fontes-mercado-livre.md, pergunta em aberto).
 */
export function mapearStatus(pedido: MLOrder): StatusVendaCanal | null {
  if (pedido.status === "paid") return StatusVendaCanal.PAGA;

  if (pedido.status === "cancelled") {
    const houvePagamento =
      typeof pedido.paid_amount === "number" && pedido.paid_amount > 0;
    if (!houvePagamento) return null;

    return pedido.order_request?.return
      ? StatusVendaCanal.DEVOLVIDA
      : StatusVendaCanal.CANCELADA;
  }

  return null;
}

/** sale_fee é tratado como por unidade, mesma convenção já usada em sales-complete e dashboard/resumo. */
export function mapearItem(
  item: MLOrder["order_items"][number]
): ItemVendaCanalNormalizado {
  const precoUnitario = Math.round(item.unit_price * 100);
  const precoCheio =
    typeof item.full_unit_price === "number"
      ? Math.round(item.full_unit_price * 100)
      : null;
  const tarifaTotal =
    typeof item.sale_fee === "number"
      ? Math.round(item.sale_fee * item.quantity * 100)
      : null;

  return {
    anuncioExternoId: item.item.id,
    variacaoExternaId:
      item.item.variation_id != null ? String(item.item.variation_id) : null,
    sku: item.item.seller_sku ?? item.item.seller_custom_field ?? null,
    titulo: item.item.title,
    quantidade: item.quantity,
    precoUnitario,
    precoCheio,
    tarifaTotal,
  };
}

/** GET /orders/{id}/discounts pode devolver um objeto único ou uma lista (campanha + cupom). Soma só a parte do vendedor. */
export function somarDescontoVendedor(bruto: unknown): number {
  const itens: DescontoBruto[] = Array.isArray(bruto)
    ? bruto
    : bruto && typeof bruto === "object"
      ? [bruto as DescontoBruto]
      : [];

  const totalReais = itens.reduce(
    (soma, item) => soma + (typeof item.seller === "number" ? item.seller : 0),
    0
  );
  return Math.round(totalReais * 100);
}

function extrairDataLiberacao(payments: unknown): Date | null {
  if (!Array.isArray(payments) || payments.length === 0) return null;
  const lista = payments as PagamentoBruto[];
  const aprovado = lista.find((p) => p.status === "approved") ?? lista[0];
  return aprovado?.money_release_date ? new Date(aprovado.money_release_date) : null;
}

function extrairFreteComprador(shipping: Record<string, unknown>): number {
  const custo = shipping.cost ?? shipping.list_cost;
  return typeof custo === "number" ? Math.round(custo * 100) : 0;
}

export function mapearPedido(
  pedido: MLOrder,
  descontosBrutos: unknown
): VendaCanalNormalizada | null {
  const status = mapearStatus(pedido);
  if (!status) return null;

  const dataVenda = new Date(pedido.date_closed ?? pedido.date_created);
  const shipping = (pedido.shipping ?? {}) as Record<string, unknown>;
  const envioExternoId =
    typeof shipping.id === "number" || typeof shipping.id === "string"
      ? String(shipping.id)
      : null;
  const logistica =
    typeof shipping.logistic_type === "string" ? shipping.logistic_type : null;

  return {
    pedidoExternoId: String(pedido.id),
    pacoteExternoId: pedido.pack_id != null ? String(pedido.pack_id) : null,
    dataVenda,
    dataCancelamento:
      status !== StatusVendaCanal.PAGA && pedido.last_updated
        ? new Date(pedido.last_updated)
        : null,
    dataLiberacao: extrairDataLiberacao(pedido.payments),
    status,
    logistica,
    envioExternoId,
    freteComprador: extrairFreteComprador(shipping),
    descontoVendedorTotal: somarDescontoVendedor(descontosBrutos),
    atualizadoNoCanalEm: pedido.last_updated
      ? new Date(pedido.last_updated)
      : dataVenda,
    itens: pedido.order_items.map(mapearItem),
  };
}

/**
 * `compensation` (número único) × `compensations` (lista com `amount`): os
 * dois formatos aparecem em exemplos diferentes da documentação do ML — ver
 * docs/financeiro/fontes-mercado-livre.md. Trata os dois.
 */
export function mapearCustoEnvio(bruto: CustoEnvioBruto): CustoEnvioNormalizado {
  const sender = bruto.senders?.[0];
  if (!sender || typeof sender.cost !== "number") {
    return { valor: null, confianca: Confianca.ESTIMADO };
  }

  const compensacao = Array.isArray(sender.compensations)
    ? sender.compensations.reduce(
        (soma, c) => soma + (typeof c.amount === "number" ? c.amount : 0),
        0
      )
    : typeof sender.compensation === "number"
      ? sender.compensation
      : 0;

  return {
    valor: Math.round((sender.cost - compensacao) * 100),
    confianca: Confianca.CONFIRMADO,
  };
}
