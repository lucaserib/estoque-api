import { formatBRL, formatPercent } from "@/lib/format";

export type ModoFaturamento =
  | "PRODUTOS"
  | "PRODUTOS_E_FRETE_COMPRADOR"
  | "PRODUTOS_MENOS_FRETE"
  | "PRODUTOS_E_FRETE_TOTAL";

export const DESCRICAO_MODO_FATURAMENTO: Record<ModoFaturamento, { titulo: string; resumo: string }> = {
  PRODUTOS: {
    titulo: "Só produtos (igual ao Mercado Livre)",
    resumo: "Faturamento = preço × quantidade. O frete aparece só como custo.",
  },
  PRODUTOS_E_FRETE_COMPRADOR: {
    titulo: "Produtos + frete pago pelo comprador",
    resumo: "Soma ao faturamento o frete que o comprador pagou (o mesmo valor entra como custo de frete).",
  },
  PRODUTOS_MENOS_FRETE: {
    titulo: "Faturamento líquido de frete",
    resumo:
      "Desconta do faturamento o frete que o ML cobrou de você em cada venda (o frete deixa de aparecer como custo separado). A margem não muda.",
  },
  PRODUTOS_E_FRETE_TOTAL: {
    titulo: "Produtos + frete total (igual ao Bling/Mercado Turbo)",
    resumo:
      "Soma ao faturamento o frete inteiro gerado no envio — o que o comprador pagou e o que você absorveu. O frete que você absorveu passa a contar como faturamento gerado, não só como custo, então a margem fica maior nesse valor (mais faturamento e mais margem, não só mais faturamento).",
  },
};

export interface TotaisVendasApi {
  pedidos: number;
  pedidosCancelados: number;
  unidades: number;
  vendasBrutas: number;
  cancelamentos: number;
  faturamento: number;
  receitaFrete: number;
  receitaTotal: number;
  impostos: number;
  tarifas: number;
  frete: number;
  adsAtribuido: number;
  cmv: number;
  margemContribuicaoVendas: number;
  descontoCampanha: number;
  liquidoAReceber: number;
  retencoes: number;
  vendasSemCusto: number;
  faturamentoSemCusto: number;
  vendasSemFrete: number;
  vendasAguardandoDetalhes: number;
  vendasSemVinculo: number;
}

export interface LinhaCategoriaApi {
  categoriaId: string;
  nome: string;
  valor: number;
}

export interface IndicadoresApi {
  desde: string;
  ate: string;
  config: { aliquotaImposto: number; modoFaturamento: ModoFaturamento; regimeTributario: string; usarImpostoEstimado: boolean };
  vendas: TotaisVendasApi;
  pedidos: number;
  unidades: number;
  vendasBrutas: number;
  cancelamentos: number;
  faturamento: number;
  receitaFrete: number;
  outrasReceitas: number;
  receitaTotal: number;
  impostos: number;
  receitaLiquida: number;
  custosVariaveis: {
    tarifas: number;
    frete: number;
    ads: number;
    armazenagemFull: number;
    outrasCobrancas: number;
    outrosCustos: number;
    lancamentos: number;
    total: number;
  };
  origemAds: "ADS_DIARIO" | "FATURA" | "NENHUM";
  cobrancas: { total: number; porTipo: Array<{ tipo: string; rotulo: string; valor: number }> };
  cmv: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  despesasOperacionais: LinhaCategoriaApi[];
  totalDespesasOperacionais: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  resultadoNaoOperacional: number;
  impostoLucro: number;
  lucroLiquido: number;
  lucroLiquidoPercentual: number | null;
  ticketMedio: number | null;
  descontoCampanha: number;
  descontoCusteadoMl: number;
  liquidoAReceber: number;
  retencoes: number;
  qualidade: {
    vendasSemCusto: number;
    faturamentoSemCusto: number;
    vendasSemFrete: number;
    vendasAguardandoDetalhes: number;
    vendasSemVinculo: number;
    lucroConfiavel: boolean;
  };
}

export interface DiferencaApi {
  valorAtual: number;
  valorComparado: number;
  percentual: number | null;
}

export interface ComparacaoApi {
  faturamento: DiferencaApi;
  margemContribuicao: DiferencaApi;
  pedidos: DiferencaApi;
}

export function moeda(centavos: number | null | undefined): string {
  return centavos == null ? "—" : formatBRL(centavos);
}

export function percentual(fracao: number | null | undefined, casas = 1): string {
  return fracao == null || !Number.isFinite(fracao) ? "—" : formatPercent(fracao * 100, casas);
}

export function variacao(diferenca: DiferencaApi | null | undefined): number | null {
  return diferenca?.percentual == null ? null : Math.round(diferenca.percentual * 1000) / 10;
}

export function sobreFaturamento(valor: number, faturamento: number): string {
  return faturamento === 0 ? "—" : percentual(valor / faturamento);
}

export async function buscarJson<T>(url: string): Promise<T | null> {
  try {
    const resposta = await fetch(url, { cache: "no-store" });
    if (!resposta.ok) return null;
    return (await resposta.json()) as T;
  } catch {
    return null;
  }
}
