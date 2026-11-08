import { z } from "zod";
import { formatarDataHoraBrasilia } from "@/modules/financeiro/dominio/periodo";
import { calcularFaturamentoComFrete } from "@/modules/financeiro/relatorios/faturamentoComFrete";
import { gerarLucroPorProduto, type LinhaLucroPorProduto } from "@/modules/financeiro/relatorios/lucroPorProduto";
import {
  agruparVendas,
  buscarVendasParaCalculo,
  calcularIndicadores,
  obterConfigRelatorio,
  type Indicadores,
} from "@/modules/financeiro/relatorios/motor";
import { descreverPeriodo, periodoSchema, resolverPeriodo, type PeriodoResolvido } from "./periodo";
import { dataSp, definirFerramenta, percentual, reais, reaisOuZero } from "./tipos";

export function resumirIndicadores(ind: Indicadores) {
  const cv = ind.custosVariaveis;
  return {
    pedidos: ind.pedidos,
    unidades: ind.unidades,
    faturamento: reaisOuZero(ind.faturamento),
    receitaFrete: reaisOuZero(ind.receitaFrete),
    receitaTotal: reaisOuZero(ind.receitaTotal),
    ticketMedio: reais(ind.ticketMedio),
    cancelamentos: reaisOuZero(ind.cancelamentos),
    impostos: reaisOuZero(ind.impostos),
    tarifas: reaisOuZero(cv.tarifas),
    frete: reaisOuZero(cv.frete),
    ads: reaisOuZero(cv.ads),
    armazenagemFull: reaisOuZero(cv.armazenagemFull),
    outrosCustosVariaveis: reaisOuZero(cv.outrasCobrancas + cv.outrosCustos + cv.lancamentos),
    cmv: reaisOuZero(ind.cmv),
    margemContribuicao: reaisOuZero(ind.margemContribuicao),
    margemContribuicaoPercentual: percentual(ind.margemContribuicaoPercentual),
    despesasOperacionais: reaisOuZero(ind.totalDespesasOperacionais),
    lucroLiquido: reaisOuZero(ind.lucroLiquido),
    lucroLiquidoPercentual: percentual(ind.lucroLiquidoPercentual),
    liquidoAReceber: reaisOuZero(ind.liquidoAReceber),
    qualidade: {
      vendasSemCusto: ind.qualidade.vendasSemCusto,
      vendasAguardandoDetalhes: ind.qualidade.vendasAguardandoDetalhes,
      vendasSemVinculo: ind.qualidade.vendasSemVinculo,
      lucroConfiavel: ind.qualidade.lucroConfiavel,
    },
  };
}

function variacao(atual: number | null, base: number | null) {
  if (atual === null || base === null) return { atual, base, diferenca: null, percentual: null };
  return {
    atual,
    base,
    diferenca: Math.round((atual - base) * 100) / 100,
    percentual: base === 0 ? null : percentual((atual - base) / Math.abs(base)),
  };
}

async function produtosQueMaisMudaram(contaId: string, atual: PeriodoResolvido, base: PeriodoResolvido) {
  const [linhasAtual, linhasBase] = await Promise.all([
    gerarLucroPorProduto(contaId, { desde: atual.desde, ate: atual.ate }, "faturamentoBruto"),
    gerarLucroPorProduto(contaId, { desde: base.desde, ate: base.ate }, "faturamentoBruto"),
  ]);
  const porId = new Map<string, { atual?: LinhaLucroPorProduto; base?: LinhaLucroPorProduto }>();
  for (const l of linhasAtual) porId.set(l.produtoId, { ...porId.get(l.produtoId), atual: l });
  for (const l of linhasBase) porId.set(l.produtoId, { ...porId.get(l.produtoId), base: l });

  return [...porId.values()]
    .map(({ atual: a, base: b }) => {
      const ref = (a ?? b)!;
      return {
        nome: ref.nome,
        sku: ref.sku,
        faturamentoAtual: reaisOuZero(a?.faturamentoBruto),
        faturamentoBase: reaisOuZero(b?.faturamentoBruto),
        unidadesAtual: a?.unidades ?? 0,
        unidadesBase: b?.unidades ?? 0,
        margemContribuicaoAtual: reaisOuZero(a?.margemContribuicao),
        margemContribuicaoBase: reaisOuZero(b?.margemContribuicao),
        diferencaFaturamento: reaisOuZero((a?.faturamentoBruto ?? 0) - (b?.faturamentoBruto ?? 0)),
      };
    })
    .sort((x, y) => Math.abs(y.diferencaFaturamento) - Math.abs(x.diferencaFaturamento))
    .slice(0, 6);
}

export const resumoFinanceiro = definirFerramenta({
  nome: "resumo_financeiro",
  rotulo: "Lendo o Financeiro",
  descricao:
    "Faturamento, pedidos, ticket médio, tarifas, frete, ads, CMV, margem de contribuição e lucro líquido de um período, com os mesmos números do Financeiro e do DRE. Use para perguntas sobre quanto vendeu, quanto lucrou ou como está a margem.",
  esquema: periodoSchema,
  permissao: "FINANCEIRO_VER",
  async executar(contexto, entrada) {
    const p = resolverPeriodo(entrada, contexto.agora);
    const indicadores = await calcularIndicadores(contexto.contaId, p.desde, p.ate);
    return { fonte: "Financeiro", periodo: descreverPeriodo(p), ...resumirIndicadores(indicadores) };
  },
});

export const compararPeriodos = definirFerramenta({
  nome: "comparar_periodos",
  rotulo: "Comparando períodos",
  descricao:
    "Compara dois períodos (por padrão, o período pedido contra o mesmo trecho do período anterior) e mostra a variação de faturamento, pedidos, ticket, tarifas, frete, ads, CMV, margem e lucro, além dos produtos que mais mudaram. Use para entender por que um número subiu ou caiu.",
  esquema: z.object({
    atual: periodoSchema.optional().describe("Período principal. Padrão: mês atual."),
    base: periodoSchema.optional().describe("Período de comparação. Padrão: o mesmo trecho do período anterior."),
  }),
  permissao: "FINANCEIRO_VER",
  async executar(contexto, entrada) {
    const atual = resolverPeriodo(entrada.atual, contexto.agora);
    const base: PeriodoResolvido = entrada.base
      ? resolverPeriodo(entrada.base, contexto.agora)
      : { desde: atual.anteriorDesde, ate: atual.anteriorAte, anteriorDesde: atual.anteriorDesde, anteriorAte: atual.anteriorAte, rotulo: "Período anterior" };

    const [indAtual, indBase, produtos] = await Promise.all([
      calcularIndicadores(contexto.contaId, atual.desde, atual.ate),
      calcularIndicadores(contexto.contaId, base.desde, base.ate),
      produtosQueMaisMudaram(contexto.contaId, atual, base),
    ]);
    const a = resumirIndicadores(indAtual);
    const b = resumirIndicadores(indBase);

    return {
      fonte: "Financeiro",
      atual: { periodo: descreverPeriodo(atual), ...a },
      base: { periodo: descreverPeriodo(base), ...b },
      variacoes: {
        faturamento: variacao(a.faturamento, b.faturamento),
        pedidos: variacao(a.pedidos, b.pedidos),
        ticketMedio: variacao(a.ticketMedio, b.ticketMedio),
        tarifas: variacao(a.tarifas, b.tarifas),
        frete: variacao(a.frete, b.frete),
        ads: variacao(a.ads, b.ads),
        cmv: variacao(a.cmv, b.cmv),
        margemContribuicao: variacao(a.margemContribuicao, b.margemContribuicao),
        margemContribuicaoPercentualPontos:
          a.margemContribuicaoPercentual !== null && b.margemContribuicaoPercentual !== null
            ? Math.round((a.margemContribuicaoPercentual - b.margemContribuicaoPercentual) * 10) / 10
            : null,
        lucroLiquido: variacao(a.lucroLiquido, b.lucroLiquido),
      },
      produtosQueMaisMudaram: produtos,
    };
  },
});

const ORDEM_PRODUTO = { faturamento: "faturamentoBruto", unidades: "unidades", margem: "margemContribuicao" } as const;

export const vendasPorProduto = definirFerramenta({
  nome: "vendas_por_produto",
  rotulo: "Lendo vendas por produto",
  descricao:
    "Ranking de produtos vendidos no período (Financeiro → Produtos): unidades, faturamento, margem de contribuição, lucro e curva ABC. Venda de kit conta nos produtos do kit. Use para 'o que mais vendeu', 'o que dá mais lucro' ou 'o que dá prejuízo' (ordem margem, crescente não existe: peça margem e leia o fim da lista).",
  esquema: periodoSchema.extend({
    ordem: z.enum(["faturamento", "unidades", "margem"]).default("faturamento").describe("Critério do ranking."),
    limite: z.number().int().min(1).max(20).default(10).describe("Quantos produtos devolver (máx. 20)."),
  }),
  permissao: "FINANCEIRO_VER",
  async executar(contexto, entrada) {
    const p = resolverPeriodo(entrada, contexto.agora);
    const ordem = entrada.ordem === "margem" && !contexto.podeVerCusto ? "faturamento" : entrada.ordem;
    const linhas = await gerarLucroPorProduto(contexto.contaId, { desde: p.desde, ate: p.ate }, ORDEM_PRODUTO[ordem]);
    return {
      fonte: "Financeiro → Produtos",
      periodo: descreverPeriodo(p),
      ordem,
      totalProdutos: linhas.length,
      itens: linhas.slice(0, entrada.limite).map((l) => ({
        produtoId: l.produtoId,
        nome: l.nome,
        sku: l.sku,
        unidades: l.unidades,
        faturamento: reaisOuZero(l.faturamentoBruto),
        tarifa: reaisOuZero(l.tarifa),
        frete: reaisOuZero(l.frete),
        ads: reaisOuZero(l.ads),
        cmv: reaisOuZero(l.cmv),
        margemContribuicao: reaisOuZero(l.margemContribuicao),
        margemContribuicaoPercentual: percentual(l.margemContribuicaoPercentual),
        lucroLiquido: reaisOuZero(l.lucroLiquido),
        curvaAbc: l.curvaAbc,
        vendasSemCusto: l.vendasSemCusto,
      })),
    };
  },
});

export const vendasPorDia = definirFerramenta({
  nome: "vendas_por_dia",
  rotulo: "Lendo vendas por dia",
  descricao:
    "Pedidos, unidades, faturamento e margem de contribuição dia a dia no período (data da criação do pedido, fuso de São Paulo). Use para achar dias fora do normal ou tendência.",
  esquema: periodoSchema,
  permissao: "FINANCEIRO_VER",
  async executar(contexto, entrada) {
    const p = resolverPeriodo(entrada, contexto.agora);
    const [config, vendas] = await Promise.all([
      obterConfigRelatorio(contexto.contaId),
      buscarVendasParaCalculo(contexto.contaId, p.desde, p.ate),
    ]);
    const baldes = agruparVendas(vendas, config, (v) => formatarDataHoraBrasilia(v.dataVenda).slice(0, 10));
    return {
      fonte: "Financeiro → Vendas",
      periodo: descreverPeriodo(p),
      dias: [...baldes.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dia, t]) => ({
          dia,
          pedidos: t.pedidos,
          unidades: t.unidades,
          faturamento: reaisOuZero(t.receitaTotal),
          margemContribuicao: reaisOuZero(t.margemContribuicaoVendas),
        })),
    };
  },
});

export const faturamentoComFrete = definirFerramenta({
  nome: "faturamento_com_frete",
  rotulo: "Lendo o faturamento com frete",
  descricao:
    "Faturamento só de produtos, com frete (produtos + frete do comprador + frete do vendedor) e em nota fiscal (notas do Bling por data de emissão), total e por dia. Use quando o usuário comparar com o Bling, com o Mercado Turbo ou perguntar pelo valor em nota.",
  esquema: periodoSchema,
  permissao: "FINANCEIRO_VER",
  async executar(contexto, entrada) {
    const p = resolverPeriodo(entrada, contexto.agora);
    const r = await calcularFaturamentoComFrete(contexto.contaId, p.desde, p.ate);
    const valores = (v: typeof r.totais) => ({
      pedidos: v.pedidos,
      produtos: reaisOuZero(v.produtos),
      freteComprador: reaisOuZero(v.freteComprador),
      freteVendedor: reaisOuZero(v.freteVendedor),
      comFrete: reaisOuZero(v.comFrete),
      notasQuantidade: v.notasQuantidade,
      emNotaFiscal: reaisOuZero(v.notasValor),
      pedidosComNota: v.pedidosComNota,
    });
    return {
      fonte: "Financeiro (Quanto foi faturado de verdade)",
      periodo: descreverPeriodo(p),
      totais: valores(r.totais),
      coberturaNotasPercentual: percentual(r.coberturaNotas),
      temNotas: r.temNotas,
      dias: r.dias.map((d) => ({ dia: dataSp(d.dia), ...valores(d) })),
    };
  },
});
