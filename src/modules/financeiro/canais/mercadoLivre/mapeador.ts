import { StatusVendaCanal, Confianca } from "@prisma/client";
import type { MLOrder } from "@/types/mercadolivre";
import type {
  CustoEnvioNormalizado,
  EnvioNormalizado,
  ItemVendaCanalNormalizado,
  VendaCanalNormalizada,
} from "../tipos";

interface DetalheDescontoBruto {
  items?: Array<{
    id?: string | number;
    variation_id?: string | number | null;
    amounts?: { total?: number; seller?: number };
  }>;
  supplier?: { funding_mode?: string; offer_id?: string };
}

interface DescontosBruto {
  details?: DetalheDescontoBruto[];
}

interface PagamentoBruto {
  status?: string;
  transaction_amount?: number;
  transaction_amount_refunded?: number;
  money_release_date?: string | null;
}

interface CustoEnvioBruto {
  senders?: Array<{
    cost?: number;
    compensation?: number;
    compensations?: Array<{ amount?: number }>;
  }>;
}

interface EnvioBruto {
  logistic_type?: string;
}

const STATUS_PAGAMENTO_RELEVANTE = new Set([
  "approved",
  "refunded",
  "partially_refunded",
  "charged_back",
  "in_mediation",
]);

function listaPagamentos(payments: unknown): PagamentoBruto[] {
  return Array.isArray(payments) ? (payments as PagamentoBruto[]) : [];
}

function houvePagamentoRelevante(payments: unknown): boolean {
  return listaPagamentos(payments).some(
    (p) =>
      p.status != null &&
      STATUS_PAGAMENTO_RELEVANTE.has(p.status) &&
      typeof p.transaction_amount === "number" &&
      p.transaction_amount > 0
  );
}

function houvePagamentoParcialmenteEstornado(payments: unknown): boolean {
  return listaPagamentos(payments).some((p) => p.status === "partially_refunded");
}

export function mapearStatus(pedido: MLOrder): StatusVendaCanal | null {
  if (pedido.status === "paid") return StatusVendaCanal.PAGA;

  if (pedido.status === "cancelled") {
    if (!houvePagamentoRelevante(pedido.payments)) return null;
    if (houvePagamentoParcialmenteEstornado(pedido.payments)) {
      return StatusVendaCanal.DEVOLVIDA_PARCIAL;
    }

    return pedido.order_request?.return
      ? StatusVendaCanal.DEVOLVIDA
      : StatusVendaCanal.CANCELADA;
  }

  return null;
}

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

export interface DescontoItemNormalizado {
  anuncioExternoId: string | null;
  variacaoExternaId: string | null;
  descontoTotal: number;
  descontoVendedor: number;
  descontoCusteadoPeloMl: number;
  fundingMode: string | null;
  offerId: string | null;
}

export function mapearDescontos(bruto: unknown): DescontoItemNormalizado[] {
  const details =
    bruto && typeof bruto === "object" && Array.isArray((bruto as DescontosBruto).details)
      ? ((bruto as DescontosBruto).details as DetalheDescontoBruto[])
      : [];

  const resultado: DescontoItemNormalizado[] = [];
  for (const detalhe of details) {
    for (const item of detalhe.items ?? []) {
      const total =
        typeof item.amounts?.total === "number" ? Math.round(item.amounts.total * 100) : 0;
      const seller =
        typeof item.amounts?.seller === "number" ? Math.round(item.amounts.seller * 100) : 0;

      resultado.push({
        anuncioExternoId: item.id != null ? String(item.id) : null,
        variacaoExternaId: item.variation_id != null ? String(item.variation_id) : null,
        descontoTotal: total,
        descontoVendedor: seller,
        descontoCusteadoPeloMl: Math.max(0, total - seller),
        fundingMode: detalhe.supplier?.funding_mode ?? null,
        offerId: detalhe.supplier?.offer_id ?? null,
      });
    }
  }
  return resultado;
}

export function somarDescontoVendedor(bruto: unknown): number {
  return mapearDescontos(bruto).reduce((soma, d) => soma + d.descontoVendedor, 0);
}

export function somarDescontoCusteadoPeloMl(bruto: unknown): number {
  return mapearDescontos(bruto).reduce((soma, d) => soma + d.descontoCusteadoPeloMl, 0);
}

function extrairDataLiberacao(payments: unknown): Date | null {
  const lista = listaPagamentos(payments);
  if (lista.length === 0) return null;
  const aprovado = lista.find((p) => p.status === "approved") ?? lista[0];
  return aprovado?.money_release_date ? new Date(aprovado.money_release_date) : null;
}

function extrairFreteComprador(shipping: Record<string, unknown>): number {
  const custo = shipping.cost ?? shipping.list_cost;
  return typeof custo === "number" ? Math.round(custo * 100) : 0;
}

function extrairDataCancelamento(pedido: MLOrder): Date | null {
  if (pedido.cancel_detail?.date) return new Date(pedido.cancel_detail.date);
  return pedido.last_updated ? new Date(pedido.last_updated) : null;
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
    dataCancelamento: status !== StatusVendaCanal.PAGA ? extrairDataCancelamento(pedido) : null,
    dataLiberacao: extrairDataLiberacao(pedido.payments),
    status,
    logistica,
    envioExternoId,
    freteComprador: extrairFreteComprador(shipping),
    descontoVendedorTotal: somarDescontoVendedor(descontosBrutos),
    descontoCusteadoPeloMlTotal: somarDescontoCusteadoPeloMl(descontosBrutos),
    atualizadoNoCanalEm: pedido.last_updated
      ? new Date(pedido.last_updated)
      : dataVenda,
    itens: pedido.order_items.map(mapearItem),
  };
}

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

export function mapearEnvio(bruto: EnvioBruto): EnvioNormalizado {
  return {
    logistica: typeof bruto.logistic_type === "string" ? bruto.logistic_type : null,
    confianca: typeof bruto.logistic_type === "string" ? Confianca.CONFIRMADO : Confianca.ESTIMADO,
  };
}
