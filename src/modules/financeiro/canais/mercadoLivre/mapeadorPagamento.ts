import {
  CobrancaPagamentoNormalizada,
  PagamentoNormalizado,
} from "../tipos";

export interface ChargeDetailBruto {
  name?: string;
  type?: string;
  accounts?: { from?: string; to?: string };
  amounts?: { original?: number; refunded?: number };
  metadata?: Record<string, unknown>;
  reserve_id?: number | string;
}

export interface PagamentoBruto {
  id?: number | string;
  status?: string;
  money_release_date?: string | null;
  money_release_status?: string | null;
  transaction_details?: { net_received_amount?: number; total_paid_amount?: number };
  charges_details?: ChargeDetailBruto[];
}

const NOMES_TARIFA = new Set(["ml_sale_fee", "mp_processing_fee"]);

function ehTarifa(nome: string): boolean {
  return NOMES_TARIFA.has(nome) || nome.startsWith("mp_financing");
}

function ehFrete(nome: string, tipo: string): boolean {
  return tipo === "shipping" || nome.startsWith("shp_");
}

function ehRetencaoDeDivida(detalhe: ChargeDetailBruto): boolean {
  return (
    detalhe.name === "fee_spl" ||
    detalhe.reserve_id != null ||
    detalhe.metadata?.source === "direct-charges"
  );
}

export function mapearPagamento(bruto: PagamentoBruto): PagamentoNormalizado {
  let tarifaVenda = 0;
  let freteVendedor = 0;
  let retencaoDividas = 0;
  const cobrancas: CobrancaPagamentoNormalizada[] = [];
  const desconhecidos: string[] = [];

  for (const detalhe of bruto.charges_details ?? []) {
    const nome = detalhe.name ?? "";
    const tipo = detalhe.type ?? "";
    const original = typeof detalhe.amounts?.original === "number" ? detalhe.amounts.original : 0;
    const refunded = typeof detalhe.amounts?.refunded === "number" ? detalhe.amounts.refunded : 0;
    const valorOriginal = Math.round(original * 100);
    const valorEstornado = Math.round(refunded * 100);
    const valorLiquido = valorOriginal - valorEstornado;

    if (ehTarifa(nome)) {
      tarifaVenda += valorLiquido;
    } else if (ehRetencaoDeDivida(detalhe)) {
      retencaoDividas += valorLiquido;
    } else if (ehFrete(nome, tipo)) {
      freteVendedor += valorLiquido;
    } else {
      desconhecidos.push(nome);
    }

    cobrancas.push({
      nome,
      tipo,
      valor: valorOriginal,
      estornado: valorEstornado,
      destino: detalhe.accounts?.to ?? null,
      metadata: detalhe.metadata ?? null,
    });
  }

  const netReceivedAmount = bruto.transaction_details?.net_received_amount;

  return {
    pagamentoExternoId: String(bruto.id ?? ""),
    tarifaVenda,
    freteVendedor,
    retencaoDividas,
    valorLiquidoReceber: typeof netReceivedAmount === "number" ? Math.round(netReceivedAmount * 100) : null,
    dataLiberacao: bruto.money_release_date ? new Date(bruto.money_release_date) : null,
    statusLiberacao: bruto.money_release_status ?? null,
    cobrancas,
    desconhecidos,
  };
}
