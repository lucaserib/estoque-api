import { CanalVenda } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ratearCustoFixoPorProduto } from "../dominio/formulas";
import { comCacheFinanceiro } from "./cache";

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

/** 80/95 sobre a soma só dos positivos — margem negativa nunca é A/B, cai sempre em C. */
function calcularCurvaAbc(
  produtos: Array<{ produtoId: string; margemContribuicao: number }>
): Map<string, CurvaAbc> {
  const positivos = [...produtos]
    .filter((p) => p.margemContribuicao > 0)
    .sort((a, b) => b.margemContribuicao - a.margemContribuicao);
  const totalPositivo = positivos.reduce((soma, p) => soma + p.margemContribuicao, 0);

  // O corte usa o acumulado ANTES de somar o item atual: o maior produto
  // sempre abre a curva em A, mesmo que ele só, isoladamente, já passe de
  // 80% do total — o que o limite decide é onde PARAR de incluir mais
  // itens em A, não se o primeiro (maior) item qualifica.
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

export async function gerarLucroPorProduto(
  userId: string,
  filtros: FiltrosLucroPorProduto,
  ordenarPor: OrdenacaoLucroPorProduto = "margemContribuicao",
  ordem: "asc" | "desc" = "desc"
): Promise<LinhaLucroPorProduto[]> {
  const chave = `lucro-produto:${filtros.desde.toISOString()}:${filtros.ate.toISOString()}:${filtros.canal ?? "todos"}`;

  return comCacheFinanceiro(userId, chave, async () => {
    // CMV real é quantidade × custoUnitário (por item, não por unidade) e o
    // faturamento é quantidade × precoUnitário — os dois precisam de
    // multiplicação por item, então busca os itens em detalhe em vez de um
    // _sum agregado (que somaria custoUnitário "cru", sem multiplicar pela quantidade).
    const [itensDetalhados, config] = await Promise.all([
      prisma.vendaCanalItem.findMany({
        where: {
          produtoId: { not: null },
          venda: {
            userId,
            dataVenda: { gte: filtros.desde, lte: filtros.ate },
            ...(filtros.canal && { canal: filtros.canal }),
          },
        },
        select: {
          produtoId: true, quantidade: true, precoUnitario: true, descontoRateado: true,
          tarifaVenda: true, freteRateado: true, adsRateado: true, impostoRateado: true,
          custoUnitario: true, margemContribuicao: true,
        },
      }),
      prisma.configuracaoGeral.findUnique({ where: { userId }, select: { rateioCustoFixo: true } }),
    ]);

    if (itensDetalhados.length === 0) return [];

    const produtoIds = [
      ...new Set(itensDetalhados.map((i) => i.produtoId).filter((id): id is string => id !== null)),
    ];
    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtoIds } },
      select: { id: true, nome: true, sku: true },
    });
    const produtoPorId = new Map(produtos.map((p) => [p.id, p]));

    const porProduto = new Map<string, Omit<LinhaLucroPorProduto, "sku" | "nome" | "margemContribuicaoPercentual" | "custoFixoRateado" | "lucroLiquido" | "roiSobreCmv" | "curvaAbc">>();
    for (const item of itensDetalhados) {
      if (!item.produtoId) continue;
      const atual = porProduto.get(item.produtoId) ?? {
        produtoId: item.produtoId, unidades: 0, faturamentoBruto: 0, descontos: 0,
        tarifa: 0, frete: 0, ads: 0, imposto: 0, cmv: 0, margemContribuicao: 0,
      };
      atual.unidades += item.quantidade;
      atual.faturamentoBruto += item.precoUnitario * item.quantidade;
      atual.descontos += item.descontoRateado;
      atual.tarifa += item.tarifaVenda;
      atual.frete += item.freteRateado ?? 0;
      atual.ads += item.adsRateado;
      atual.imposto += item.impostoRateado;
      atual.cmv += (item.custoUnitario ?? 0) * item.quantidade;
      atual.margemContribuicao += item.margemContribuicao ?? 0;
      porProduto.set(item.produtoId, atual);
    }

    const linhasBase = [...porProduto.values()];
    const despesasFixasDoPeriodo = await somarDespesasOperacionaisDoPeriodo(userId, filtros.desde, filtros.ate);
    const rateioCustoFixo = config?.rateioCustoFixo ?? "FATURAMENTO";
    const rateio = ratearCustoFixoPorProduto(
      despesasFixasDoPeriodo,
      linhasBase.map((l) => ({ produtoId: l.produtoId, faturamento: l.faturamentoBruto, unidadesVendidas: l.unidades })),
      rateioCustoFixo
    );
    const curvaAbc = calcularCurvaAbc(linhasBase);

    const linhas: LinhaLucroPorProduto[] = linhasBase.map((l) => {
      const custoFixoRateado = rateio[l.produtoId] ?? 0;
      const lucroLiquido = l.margemContribuicao - custoFixoRateado;
      const produto = produtoPorId.get(l.produtoId);
      return {
        ...l,
        sku: produto?.sku ?? "—",
        nome: produto?.nome ?? "Produto removido",
        margemContribuicaoPercentual: l.faturamentoBruto === 0 ? null : l.margemContribuicao / l.faturamentoBruto,
        custoFixoRateado,
        lucroLiquido,
        roiSobreCmv: l.cmv === 0 ? null : lucroLiquido / l.cmv,
        curvaAbc: curvaAbc.get(l.produtoId) ?? "C",
      };
    });

    linhas.sort((a, b) => (ordem === "asc" ? 1 : -1) * (a[ordenarPor] - b[ordenarPor]));
    return linhas;
  });
}

async function somarDespesasOperacionaisDoPeriodo(userId: string, desde: Date, ate: Date): Promise<number> {
  const lancamentos = await prisma.lancamentoFinanceiro.findMany({
    where: { userId, competencia: { gte: desde, lte: ate }, categoria: { grupoDre: "DESPESA_OPERACIONAL" } },
    select: { tipo: true, valor: true },
  });
  return lancamentos.reduce((soma, l) => soma + (l.tipo === "DESPESA" ? l.valor : -l.valor), 0);
}
