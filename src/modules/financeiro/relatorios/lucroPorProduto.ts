import { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ratearCustoFixoPorProduto } from "../dominio/formulas";
import { ratear } from "../dominio/dinheiro";
import { comCacheFinanceiro } from "./cache";
import { buscarVendasParaCalculo, calcularIndicadores, calcularVenda, obterConfigRelatorio } from "./motor";

export type CurvaAbc = "A" | "B" | "C";

export interface LinhaLucroPorProduto {
  produtoId: string;
  sku: string;
  nome: string;
  unidades: number;
  faturamentoBruto: number;
  descontos: number;
  tarifa: number;
  frete: number;
  ads: number;
  imposto: number;
  cmv: number;
  margemContribuicao: number;
  margemContribuicaoPercentual: number | null;
  custoFixoRateado: number;
  lucroLiquido: number;
  roiSobreCmv: number | null;
  curvaAbc: CurvaAbc;
  vendasSemCusto: number;
}

export interface FiltrosLucroPorProduto {
  desde: Date;
  ate: Date;
  canal?: CanalVenda;
}

type OrdenacaoLucroPorProduto = keyof Pick<
  LinhaLucroPorProduto,
  "margemContribuicao" | "faturamentoBruto" | "lucroLiquido" | "unidades"
>;

function calcularCurvaAbc(
  produtos: Array<{ produtoId: string; margemContribuicao: number }>
): Map<string, CurvaAbc> {
  const positivos = [...produtos]
    .filter((p) => p.margemContribuicao > 0)
    .sort((a, b) => b.margemContribuicao - a.margemContribuicao);
  const totalPositivo = positivos.reduce((soma, p) => soma + p.margemContribuicao, 0);

  const classificacao = new Map<string, CurvaAbc>();
  let acumulado = 0;
  for (const produto of positivos) {
    const percentualAntes = totalPositivo === 0 ? 0 : acumulado / totalPositivo;
    classificacao.set(produto.produtoId, percentualAntes < 0.8 ? "A" : percentualAntes < 0.95 ? "B" : "C");
    acumulado += produto.margemContribuicao;
  }
  for (const produto of produtos) {
    if (!classificacao.has(produto.produtoId)) classificacao.set(produto.produtoId, "C");
  }
  return classificacao;
}

interface AcumuladoProduto {
  produtoId: string;
  unidades: number;
  faturamentoBruto: number;
  descontos: number;
  tarifa: number;
  frete: number;
  ads: number;
  imposto: number;
  cmv: number;
  margemContribuicao: number;
  vendasSemCusto: number;
}

export async function gerarLucroPorProduto(
  userId: string,
  filtros: FiltrosLucroPorProduto,
  ordenarPor: OrdenacaoLucroPorProduto = "margemContribuicao",
  ordem: "asc" | "desc" = "desc"
): Promise<LinhaLucroPorProduto[]> {
  const config = await obterConfigRelatorio(userId);
  const chave = `lucro-produto:${filtros.desde.toISOString()}:${filtros.ate.toISOString()}:${filtros.canal ?? "todos"}:${config.modoFaturamento}:${config.aliquotaImposto}`;

  const linhas = await comCacheFinanceiro(userId, chave, async () => {
    const [vendas, configRateio, indicadores] = await Promise.all([
      buscarVendasParaCalculo(userId, filtros.desde, filtros.ate, { canal: filtros.canal }),
      prisma.configuracaoGeral.findUnique({ where: { userId }, select: { rateioCustoFixo: true } }),
      calcularIndicadores(userId, filtros.desde, filtros.ate, { filtros: { canal: filtros.canal }, config }),
    ]);

    const porProduto = new Map<string, AcumuladoProduto>();
    for (const venda of vendas) {
      const resultado = calcularVenda(venda, config);
      if (venda.itens.length === 0) continue;
      if (!resultado.valida && resultado.margemContribuicao === 0) continue;
      const pesos = venda.itens.map((item) => item.precoUnitario * item.quantidade);
      const parte = (valor: number) => ratear(valor, pesos);
      const receitas = parte(resultado.receitaTotal);
      const impostos = parte(resultado.imposto);
      const tarifas = parte(resultado.tarifa);
      const fretes = parte(resultado.frete);
      const ads = parte(resultado.ads + resultado.outrosCustos);
      const descontos = parte(resultado.descontoCampanha);

      venda.itens.forEach((item, i) => {
        if (!item.produtoId) return;
        const atual = porProduto.get(item.produtoId) ?? {
          produtoId: item.produtoId,
          unidades: 0,
          faturamentoBruto: 0,
          descontos: 0,
          tarifa: 0,
          frete: 0,
          ads: 0,
          imposto: 0,
          cmv: 0,
          margemContribuicao: 0,
          vendasSemCusto: 0,
        };
        const cmvItem = resultado.valida ? (item.custoUnitario ?? 0) * item.quantidade : 0;
        if (resultado.valida && item.custoUnitario == null) atual.vendasSemCusto++;
        atual.unidades += resultado.valida ? item.quantidade : 0;
        atual.faturamentoBruto += receitas[i];
        atual.descontos += descontos[i];
        atual.tarifa += tarifas[i];
        atual.frete += fretes[i];
        atual.ads += ads[i];
        atual.imposto += impostos[i];
        atual.cmv += cmvItem;
        atual.margemContribuicao += receitas[i] - impostos[i] - tarifas[i] - fretes[i] - ads[i] - cmvItem;
        porProduto.set(item.produtoId, atual);
      });
    }

    if (porProduto.size === 0) return [];

    const produtos = await prisma.produto.findMany({
      where: { id: { in: [...porProduto.keys()] } },
      select: { id: true, nome: true, sku: true },
    });
    const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

    const linhasBase = [...porProduto.values()];
    const rateio = ratearCustoFixoPorProduto(
      Math.max(0, indicadores.totalDespesasOperacionais),
      linhasBase.map((l) => ({ produtoId: l.produtoId, faturamento: l.faturamentoBruto, unidadesVendidas: l.unidades })),
      configRateio?.rateioCustoFixo ?? "FATURAMENTO"
    );
    const curvaAbc = calcularCurvaAbc(linhasBase);

    return linhasBase.map((l): LinhaLucroPorProduto => {
      const custoFixoRateado = rateio[l.produtoId] ?? 0;
      const lucroLiquido = l.margemContribuicao - custoFixoRateado;
      const produto = produtoPorId.get(l.produtoId);
      return {
        produtoId: l.produtoId,
        sku: produto?.sku ?? "—",
        nome: produto?.nome ?? "Produto removido",
        unidades: l.unidades,
        faturamentoBruto: l.faturamentoBruto,
        descontos: l.descontos,
        tarifa: l.tarifa,
        frete: l.frete,
        ads: l.ads,
        imposto: l.imposto,
        cmv: l.cmv,
        margemContribuicao: l.margemContribuicao,
        margemContribuicaoPercentual: l.faturamentoBruto === 0 ? null : l.margemContribuicao / l.faturamentoBruto,
        custoFixoRateado,
        lucroLiquido,
        roiSobreCmv: l.cmv === 0 ? null : lucroLiquido / l.cmv,
        curvaAbc: curvaAbc.get(l.produtoId) ?? "C",
        vendasSemCusto: l.vendasSemCusto,
      };
    });
  });

  return [...linhas].sort((a, b) => (ordem === "asc" ? 1 : -1) * (a[ordenarPor] - b[ordenarPor]));
}
