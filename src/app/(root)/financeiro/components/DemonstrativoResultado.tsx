"use client";

import { cn } from "@/lib/utils";
import { moeda, sobreFaturamento, type IndicadoresApi } from "./tipos";

interface Linha {
  rotulo: string;
  valor: number;
  tipo: "receita" | "deducao" | "subtotal" | "total" | "info";
  dica?: string;
  oculta?: boolean;
}

export function linhasDemonstrativo(ind: IndicadoresApi): Linha[] {
  const cv = ind.custosVariaveis;
  const cobrancas = cv.armazenagemFull + cv.outrasCobrancas + cv.outrosCustos + cv.lancamentos;
  return [
    { rotulo: "Faturamento (produtos)", valor: ind.faturamento, tipo: "receita", dica: "Preço × quantidade dos pedidos não cancelados — o mesmo número do painel do Mercado Livre." },
    {
      rotulo: ind.receitaFrete < 0 ? "(−) Frete descontado do faturamento" : "(+) Frete pago pelo comprador",
      valor: ind.receitaFrete,
      tipo: ind.receitaFrete < 0 ? "deducao" : "receita",
      oculta: ind.receitaFrete === 0,
    },
    { rotulo: "(+) Outras receitas", valor: ind.outrasReceitas, tipo: "receita", oculta: ind.outrasReceitas === 0 },
    { rotulo: "(−) Impostos sobre vendas", valor: -ind.impostos, tipo: "deducao", dica: `Alíquota de ${(ind.config.aliquotaImposto * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% sobre o faturamento (Configurações).` },
    { rotulo: "(−) Tarifas do Mercado Livre", valor: -cv.tarifas, tipo: "deducao", dica: "Tarifa de venda + taxa de processamento do Mercado Pago, do pagamento de cada venda." },
    {
      rotulo: "(−) Frete",
      valor: -cv.frete,
      tipo: "deducao",
      oculta: ind.config.modoFaturamento === "PRODUTOS_MENOS_FRETE" && cv.frete === 0,
      dica: "Frete cobrado de você em cada venda (o que o Mercado Livre desconta do pagamento).",
    },
    { rotulo: "(−) Publicidade", valor: -cv.ads, tipo: "deducao", oculta: cv.ads === 0 },
    { rotulo: "(−) Fatura do ML (Full e outras cobranças)", valor: -cobrancas, tipo: "deducao", oculta: cobrancas === 0, dica: "Armazenagem e serviços do Full e cobranças da fatura que não pertencem a uma venda." },
    { rotulo: "(−) Custo das mercadorias (CMV)", valor: -ind.cmv, tipo: "deducao" },
    { rotulo: "= Margem de contribuição", valor: ind.margemContribuicao, tipo: "subtotal" },
    { rotulo: "(−) Despesas operacionais", valor: -ind.totalDespesasOperacionais, tipo: "deducao", dica: "Lançamentos de despesa com competência no período (aluguel, pessoal, software…)." },
    { rotulo: "(±) Resultado financeiro", valor: ind.resultadoFinanceiro, tipo: "deducao", oculta: ind.resultadoFinanceiro === 0 },
    { rotulo: "(±) Não operacional", valor: ind.resultadoNaoOperacional, tipo: "deducao", oculta: ind.resultadoNaoOperacional === 0 },
    { rotulo: "(−) IR/CSLL", valor: -ind.impostoLucro, tipo: "deducao", oculta: ind.impostoLucro === 0 },
    { rotulo: "= Lucro líquido", valor: ind.lucroLiquido, tipo: "total" },
  ];
}

export function DemonstrativoResultado({ indicadores }: { indicadores: IndicadoresApi }) {
  const linhas = linhasDemonstrativo(indicadores).filter((l) => !l.oculta);
  const base = indicadores.receitaTotal;

  return (
    <div className="space-y-3">
      <table className="w-full text-sm">
        <tbody>
          {linhas.map((linha) => (
            <tr
              key={linha.rotulo}
              className={cn(
                "border-b border-divider last:border-0",
                (linha.tipo === "subtotal" || linha.tipo === "total") && "font-semibold"
              )}
              title={linha.dica}
            >
              <td className={cn("py-2 pr-3", linha.tipo === "deducao" && "text-muted-foreground")}>{linha.rotulo}</td>
              <td
                className={cn(
                  "py-2 text-right tabular-nums",
                  linha.tipo === "total" && (linha.valor >= 0 ? "text-success-text" : "text-destructive-text")
                )}
              >
                {moeda(linha.valor)}
              </td>
              <td className="w-16 py-2 pl-3 text-right text-xs tabular-nums text-faint">
                {sobreFaturamento(linha.valor, base)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-faint">
        {indicadores.cancelamentos > 0 && (
          <span>
            Cancelados/devolvidos: {moeda(indicadores.cancelamentos)} ({indicadores.vendas.pedidosCancelados} pedido(s)) —
            fora do faturamento
          </span>
        )}
        {indicadores.descontoCampanha > 0 && (
          <span>Desconto de campanha já embutido nos preços: {moeda(indicadores.descontoCampanha)}</span>
        )}
        {indicadores.retencoes > 0 && (
          <span>Retido pelo ML para quitar a fatura: {moeda(indicadores.retencoes)} (afeta o caixa, não o lucro)</span>
        )}
      </div>
    </div>
  );
}
