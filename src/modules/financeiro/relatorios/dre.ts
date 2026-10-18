import { CanalVenda } from "@prisma/client";
import { inicioDoMes, fimDoMes, type Competencia } from "../dominio/periodo";
import { comCacheFinanceiro } from "./cache";
import { calcularIndicadores, obterConfigRelatorio, type Indicadores, type LinhaCategoria } from "./motor";

function instanteDoMes(competencia: Competencia): Date {
  return new Date(Date.UTC(competencia.ano, competencia.mes - 1, 15, 12, 0, 0));
}

function mesAnterior(competencia: Competencia): Competencia {
  return competencia.mes === 1
    ? { ano: competencia.ano - 1, mes: 12 }
    : { ano: competencia.ano, mes: competencia.mes - 1 };
}

export type ItemDespesaOperacional = LinhaCategoria;

export interface DreMensal {
  competencia: Competencia;
  pedidos: number;
  pedidosCancelados: number;
  unidades: number;
  vendasBrutas: number;
  cancelamentosEDevolucoes: number;
  faturamento: number;
  receitaFrete: number;
  outrasReceitas: number;
  receitaTotal: number;
  impostosSobreVendas: number;
  receitaLiquida: number;
  custosVariaveis: Indicadores["custosVariaveis"];
  origemAds: Indicadores["origemAds"];
  cobrancasPorTipo: Indicadores["cobrancas"]["porTipo"];
  cmv: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  despesasOperacionais: ItemDespesaOperacional[];
  totalDespesasOperacionais: number;
  resultadoOperacional: number;
  resultadoFinanceiro: number;
  resultadoNaoOperacional: number;
  impostoLucro: number;
  lucroLiquido: number;
  lucroLiquidoPercentual: number | null;
  ticketMedio: number | null;
  descontoCampanha: number;
  descontoCusteadoPeloMl: number;
  qualidade: Indicadores["qualidade"];
}

export interface RelatorioDre {
  modoFaturamento: Indicadores["config"]["modoFaturamento"];
  meses: DreMensal[];
}

export interface FiltrosDre {
  canal?: CanalVenda;
  contaCanalId?: string;
}

function paraDreMensal(competencia: Competencia, ind: Indicadores): DreMensal {
  return {
    competencia,
    pedidos: ind.pedidos,
    pedidosCancelados: ind.vendas.pedidosCancelados,
    unidades: ind.unidades,
    vendasBrutas: ind.vendasBrutas,
    cancelamentosEDevolucoes: ind.cancelamentos,
    faturamento: ind.faturamento,
    receitaFrete: ind.receitaFrete,
    outrasReceitas: ind.outrasReceitas,
    receitaTotal: ind.receitaTotal,
    impostosSobreVendas: ind.impostos,
    receitaLiquida: ind.receitaLiquida,
    custosVariaveis: ind.custosVariaveis,
    origemAds: ind.origemAds,
    cobrancasPorTipo: ind.cobrancas.porTipo,
    cmv: ind.cmv,
    margemContribuicao: ind.margemContribuicao,
    margemContribuicaoPercentual: ind.margemContribuicaoPercentual,
    despesasOperacionais: ind.despesasOperacionais,
    totalDespesasOperacionais: ind.totalDespesasOperacionais,
    resultadoOperacional: ind.resultadoOperacional,
    resultadoFinanceiro: ind.resultadoFinanceiro,
    resultadoNaoOperacional: ind.resultadoNaoOperacional,
    impostoLucro: ind.impostoLucro,
    lucroLiquido: ind.lucroLiquido,
    lucroLiquidoPercentual: ind.lucroLiquidoPercentual,
    ticketMedio: ind.ticketMedio,
    descontoCampanha: ind.descontoCampanha,
    descontoCusteadoPeloMl: ind.descontoCusteadoMl,
    qualidade: ind.qualidade,
  };
}

/** DRE mês a mês — cada mês é exatamente o `calcularIndicadores` do mês de calendário (SP). */
export async function gerarDre(
  userId: string,
  ate: Competencia,
  quantidadeDeMeses: number,
  filtros: FiltrosDre = {}
): Promise<RelatorioDre> {
  const config = await obterConfigRelatorio(userId);
  const quantidade = Math.max(1, Math.min(quantidadeDeMeses, 12));
  const chave = `dre:${ate.ano}-${ate.mes}:${quantidade}:${filtros.canal ?? "todos"}:${filtros.contaCanalId ?? "todas"}:${config.modoFaturamento}:${config.aliquotaImposto}:${config.regimeTributario}:${config.usarImpostoEstimado}`;

  return comCacheFinanceiro(userId, chave, async () => {
    const competencias: Competencia[] = [];
    let competencia = ate;
    for (let i = 0; i < quantidade; i++) {
      competencias.unshift(competencia);
      competencia = mesAnterior(competencia);
    }

    const meses = await Promise.all(
      competencias.map(async (c) => {
        const instante = instanteDoMes(c);
        const ind = await calcularIndicadores(userId, inicioDoMes(instante), fimDoMes(instante), {
          filtros,
          config,
        });
        return paraDreMensal(c, ind);
      })
    );

    return { modoFaturamento: config.modoFaturamento, meses };
  });
}
