import { RateioCustoFixo } from "@prisma/client";
import { ratear } from "./dinheiro";

/**
 * Entrada por item: quantidade já é a quantidade economicamente válida (ou
 * seja, líquida de qualquer devolução/cancelamento parcial já identificado
 * pela camada de ingestão). `tarifaTotal` e `descontoVendedorTotal` já são o
 * total da linha (não por unidade) — a ambiguidade "por unidade ou por linha"
 * do Mercado Livre é resolvida pelo adaptador de canal, não aqui.
 */
export interface ItemVendaEntrada {
  produtoId: string | null;
  quantidade: number;
  precoUnitario: number;
  tarifaTotal: number | null;
  descontoVendedorTotal: number;
  custoUnitario: number | null;
}

export interface VendaEntrada {
  /** Custo do frete pago pelo vendedor para o pedido inteiro. null = desconhecido; 0 = retirada/sem custo. */
  freteTotal: number | null;
  /** Custo de ads já rateado para esta venda. 0 quando não houve ads (valor conhecido, não faltante). */
  adsAtribuido: number;
}

export interface ContextoCalculoVenda {
  aliquotaImposto: number;
}

export interface ItemVendaResultado {
  produtoId: string | null;
  quantidade: number;
  faturamentoBruto: number;
  descontoVendedor: number;
  imposto: number;
  tarifa: number | null;
  freteRateado: number | null;
  adsRateado: number;
  cmv: number | null;
  margemContribuicao: number | null;
  completo: boolean;
  faltando: string[];
}

export interface ResultadoVenda {
  faturamentoBruto: number;
  descontoVendedor: number;
  imposto: number;
  tarifa: number | null;
  freteVendedor: number | null;
  adsAtribuido: number;
  cmv: number | null;
  margemContribuicao: number | null;
  completo: boolean;
  faltando: string[];
  itens: ItemVendaResultado[];
}

/** Divide um custo único do pedido (frete, ads) entre os itens, proporcional ao faturamento de cada um. */
export function ratearCustoVendaPorItem(
  totalCentavos: number,
  itens: Array<{ precoUnitario: number; quantidade: number }>
): number[] {
  const pesos = itens.map((item) => item.precoUnitario * item.quantidade);
  return ratear(totalCentavos, pesos);
}

export interface ComponentesMargem {
  faturamentoBruto: number;
  descontoVendedor: number;
  imposto: number;
  tarifa: number;
  frete: number;
  ads: number;
  cmv: number;
}

export function calcularMargemContribuicao(componentes: ComponentesMargem): number {
  return (
    componentes.faturamentoBruto -
    componentes.imposto -
    componentes.tarifa -
    componentes.frete -
    componentes.ads -
    componentes.cmv
  );
}

/** Receita líquida ÷ margem de contribuição % = ponto de equilíbrio. null quando a margem atual não cobre custo nenhum. */
export function calcularPontoEquilibrio(
  despesasFixas: number,
  margemContribuicaoPercentual: number
): number | null {
  if (margemContribuicaoPercentual <= 0) return null;
  return Math.round(despesasFixas / margemContribuicaoPercentual);
}

export interface ProdutoParaRateioCustoFixo {
  produtoId: string;
  faturamento: number;
  unidadesVendidas: number;
}

export function ratearCustoFixoPorProduto(
  despesasFixasTotais: number,
  produtos: ProdutoParaRateioCustoFixo[],
  metodo: RateioCustoFixo
): Record<string, number> {
  if (produtos.length === 0) return {};

  if (metodo === "NENHUM") {
    return Object.fromEntries(produtos.map((p) => [p.produtoId, 0]));
  }

  const pesos =
    metodo === "UNIDADE"
      ? produtos.map((p) => p.unidadesVendidas)
      : produtos.map((p) => p.faturamento);

  const partes = ratear(despesasFixasTotais, pesos);
  return Object.fromEntries(produtos.map((p, i) => [p.produtoId, partes[i]]));
}

function calcularItem(
  item: ItemVendaEntrada,
  contexto: ContextoCalculoVenda,
  freteRateado: number | null,
  adsRateado: number
): ItemVendaResultado {
  const faturamentoBruto = item.precoUnitario * item.quantidade;
  const descontoVendedor = item.descontoVendedorTotal;
  const imposto = Math.round(faturamentoBruto * contexto.aliquotaImposto);
  const cmv = item.custoUnitario == null ? null : item.custoUnitario * item.quantidade;

  const faltando: string[] = [];
  if (item.tarifaTotal == null) faltando.push("SEM_TARIFA");
  if (freteRateado == null) faltando.push("SEM_FRETE");
  if (cmv == null) faltando.push("SEM_CUSTO");

  const completo = faltando.length === 0;
  const margemContribuicao = completo
    ? calcularMargemContribuicao({
        faturamentoBruto,
        descontoVendedor,
        imposto,
        tarifa: item.tarifaTotal as number,
        frete: freteRateado as number,
        ads: adsRateado,
        cmv: cmv as number,
      })
    : null;

  return {
    produtoId: item.produtoId,
    quantidade: item.quantidade,
    faturamentoBruto,
    descontoVendedor,
    imposto,
    tarifa: item.tarifaTotal,
    freteRateado,
    adsRateado,
    cmv,
    margemContribuicao,
    completo,
    faltando,
  };
}

export function calcularResultadoVenda(
  venda: VendaEntrada,
  itens: ItemVendaEntrada[],
  contexto: ContextoCalculoVenda
): ResultadoVenda {
  const freteRateadoPorItem =
    venda.freteTotal == null
      ? itens.map(() => null)
      : ratearCustoVendaPorItem(venda.freteTotal, itens);
  const adsRateadoPorItem = ratearCustoVendaPorItem(venda.adsAtribuido, itens);

  const itensResultado = itens.map((item, i) =>
    calcularItem(item, contexto, freteRateadoPorItem[i], adsRateadoPorItem[i])
  );

  const completo = itensResultado.every((i) => i.completo);
  const faltando = [...new Set(itensResultado.flatMap((i) => i.faltando))];

  const algumTarifaFaltando = itensResultado.some((i) => i.tarifa == null);
  const algumCustoFaltando = itensResultado.some((i) => i.cmv == null);

  return {
    faturamentoBruto: itensResultado.reduce((s, i) => s + i.faturamentoBruto, 0),
    descontoVendedor: itensResultado.reduce((s, i) => s + i.descontoVendedor, 0),
    imposto: itensResultado.reduce((s, i) => s + i.imposto, 0),
    tarifa: algumTarifaFaltando
      ? null
      : itensResultado.reduce((s, i) => s + (i.tarifa as number), 0),
    freteVendedor: venda.freteTotal,
    adsAtribuido: venda.adsAtribuido,
    cmv: algumCustoFaltando
      ? null
      : itensResultado.reduce((s, i) => s + (i.cmv as number), 0),
    margemContribuicao: completo
      ? itensResultado.reduce((s, i) => s + (i.margemContribuicao as number), 0)
      : null,
    completo,
    faltando,
    itens: itensResultado,
  };
}
