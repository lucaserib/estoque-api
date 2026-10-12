import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { withCache, createCacheKey } from "@/lib/cache";
import { podeVer } from "@/lib/permissoes";
import { calcularTodasPendencias } from "@/services/pendenciasService";
import { calcularReposicaoConta } from "@/services/reposicaoService";
import { gerarResumoPeriodo, gerarSerieDiaria } from "@/modules/financeiro/relatorios/resumoDia";
import { gerarLucroPorProduto } from "@/modules/financeiro/relatorios/lucroPorProduto";
import { listarVendasComLucro } from "@/modules/financeiro/relatorios/lucroPorVenda";

type BlocoResultado<T> = { dados: T; parcial: boolean; erro?: string };

async function comFallback<T>(
  fn: () => Promise<T>,
  valorPadrao: T
): Promise<BlocoResultado<T>> {
  try {
    return { dados: await fn(), parcial: false };
  } catch (error) {
    console.error("[DASHBOARD_RESUMO] Bloco falhou:", error);
    return {
      dados: valorPadrao,
      parcial: true,
      erro: error instanceof Error ? error.message : "Erro desconhecido",
    };
  }
}

async function montarResumo(userId: string, periodoDias: number, verCusto: boolean) {
  const agora = new Date();
  const inicioPeriodo = new Date(agora.getTime() - periodoDias * 24 * 60 * 60 * 1000);
  const inicioPeriodoAnterior = new Date(
    inicioPeriodo.getTime() - periodoDias * 24 * 60 * 60 * 1000
  );

  // Lê do módulo financeiro (Ciclo 7) em vez de buscar pedidos do ML em
  // tempo real e estimar margem aqui — o financeiro já tem tudo isso
  // pré-agregado em ResumoFinanceiroDiario (cancelamento, desconto, imposto,
  // ads, CMV incluídos de verdade, não só tarifa como a estimativa antiga).
  const vendasBloco = await comFallback(
    async () => {
      const [periodoAtual, periodoAnterior, serieDiariaFinanceiro, lucroPorProduto, vendasIncompletas] =
        await Promise.all([
          gerarResumoPeriodo(userId, inicioPeriodo, agora),
          gerarResumoPeriodo(userId, inicioPeriodoAnterior, inicioPeriodo),
          gerarSerieDiaria(userId, inicioPeriodo, agora),
          gerarLucroPorProduto(userId, { desde: inicioPeriodo, ate: agora }),
          listarVendasComLucro(userId, { desde: inicioPeriodo, ate: agora, soIncompletas: true, porPagina: 1 }),
        ]);

      const receitaLiquida = (periodo: typeof periodoAtual) =>
        periodo.faturamentoBruto - periodo.cancelamentos - periodo.descontos - periodo.impostos;

      const receitaLiquidaAtual = receitaLiquida(periodoAtual);
      const receitaLiquidaAnterior = receitaLiquida(periodoAnterior);

      return {
        receitaLiquida: receitaLiquidaAtual,
        margemContribuicao: periodoAtual.margemContribuicao,
        margemContribuicaoPercentual: periodoAtual.margemContribuicaoPercentual,
        unidades: periodoAtual.unidades,
        ticketMedio: periodoAtual.ticketMedio,
        vendasIncompletas: vendasIncompletas.total,
        serieDiaria: serieDiariaFinanceiro.map((p) => ({
          data: p.dia.toISOString().split("T")[0],
          receita: p.faturamentoBruto,
          unidades: p.unidades,
          pedidos: p.pedidos,
        })),
        topPorMargem: lucroPorProduto.slice(0, 10).map((l) => ({
          produtoId: l.produtoId as string | null,
          nome: l.nome,
          margem: l.margemContribuicao,
        })),
        deltaPercentual:
          receitaLiquidaAnterior > 0
            ? ((receitaLiquidaAtual - receitaLiquidaAnterior) / receitaLiquidaAnterior) * 100
            : null,
      };
    },
    {
      receitaLiquida: 0,
      margemContribuicao: 0,
      margemContribuicaoPercentual: null as number | null,
      unidades: 0,
      ticketMedio: null as number | null,
      vendasIncompletas: 0,
      serieDiaria: [] as Array<{ data: string; receita: number; unidades: number; pedidos: number }>,
      topPorMargem: [] as Array<{ produtoId: string | null; nome: string; margem: number }>,
      deltaPercentual: null as number | null,
    }
  );

  const pendenciasBloco = await comFallback(
    () => calcularTodasPendencias(userId),
    []
  );

  const reposicaoBloco = await comFallback(
    () => calcularReposicaoConta(userId),
    { sugestoes: [], parcial: false }
  );

  const estoqueLocalBloco = await comFallback(async () => {
    const produtos = await prisma.produto.findMany({
      where: { userId, ativo: true },
      select: {
        id: true,
        nome: true,
        custoMedio: true,
        estoques: {
          where: { armazem: { tipo: "LOCAL" } },
          select: { quantidade: true },
        },
      },
    });

    let valorTotal = 0;
    let quantidadeTotal = 0;
    let produtosSemCusto = 0;

    for (const produto of produtos) {
      const qtd = produto.estoques.reduce((s, e) => s + e.quantidade, 0);
      quantidadeTotal += qtd;
      if (produto.custoMedio != null) {
        valorTotal += qtd * produto.custoMedio;
      } else if (qtd > 0) {
        produtosSemCusto += 1;
      }
    }

    return { valorTotal, quantidadeTotal, produtosSemCusto };
  }, { valorTotal: 0, quantidadeTotal: 0, produtosSemCusto: 0 });

  const comprasBloco = await comFallback(async () => {
    const pedidosAbertos = await prisma.pedidoCompra.findMany({
      where: { userId, status: "pendente" },
      select: {
        id: true,
        dataPrevista: true,
        fornecedor: { select: { nome: true } },
        produtos: { select: { quantidade: true, custo: true, multiplicador: true } },
      },
    });

    let valorAReceber = 0;
    let atrasados = 0;
    for (const pedido of pedidosAbertos) {
      const valorPedido = pedido.produtos.reduce(
        (sum, p) => sum + p.quantidade * p.custo * p.multiplicador,
        0
      );
      valorAReceber += valorPedido;
      if (pedido.dataPrevista && pedido.dataPrevista < agora) {
        atrasados += 1;
      }
    }

    return { totalAbertos: pedidosAbertos.length, atrasados, valorAReceber };
  }, { totalAbertos: 0, atrasados: 0, valorAReceber: 0 });

  const integracoesBloco = await comFallback(async () => {
    const [blingAccount, mlAccountFull] = await Promise.all([
      prisma.blingAccount.findFirst({ where: { userId } }),
      prisma.mercadoLivreAccount.findFirst({ where: { userId } }),
    ]);

    let blingWebhooks24h = { total: 0, comErro: 0 };
    if (blingAccount?.blingCompanyId) {
      const desde = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
      const eventos = await prisma.blingWebhookEvent.findMany({
        where: { companyId: blingAccount.blingCompanyId, recebidoEm: { gte: desde } },
        select: { erro: true },
      });
      blingWebhooks24h = {
        total: eventos.length,
        comErro: eventos.filter((e) => e.erro).length,
      };
    }

    const anunciosComErro = mlAccountFull
      ? await prisma.produtoMercadoLivre.count({
          where: { mercadoLivreAccountId: mlAccountFull.id, syncStatus: "error" },
        })
      : 0;

    return {
      bling: blingAccount
        ? {
            isActive: blingAccount.isActive,
            ultimaSincronizacaoProdutos: blingAccount.ultimaSincronizacaoProdutos,
            ultimaSincronizacaoEstoque: blingAccount.ultimaSincronizacaoEstoque,
            webhooks24h: blingWebhooks24h,
          }
        : null,
      mercadoLivre: mlAccountFull
        ? {
            isActive: mlAccountFull.isActive,
            anunciosComErro,
          }
        : null,
    };
  }, { bling: null, mercadoLivre: null });

  const custoIndefinidoCount = pendenciasBloco.dados.filter((p) =>
    p.pendencias.some((pd) => pd.codigo === "SEM_CUSTO")
  ).length;

  const margemContribuicao = verCusto ? vendasBloco.dados.margemContribuicao : null;

  const sugestoes = reposicaoBloco.dados.sugestoes;
  const topEstoque = [...sugestoes]
    .sort((a, b) => (b.estoqueLocal + b.estoqueFullDisponivel) - (a.estoqueLocal + a.estoqueFullDisponivel))
    .slice(0, 10)
    .map((s) => ({
      produtoId: s.produtoId,
      nome: s.nome,
      estoqueLocal: s.estoqueLocal,
      fullDisponivel: s.estoqueFullDisponivel,
      fullEmTransito: s.estoqueFullEmTransito,
      aCaminho: s.pedidosEmAbertoUnidades,
      valor: verCusto && s.custoMedio != null ? s.estoqueLocal * s.custoMedio : null,
    }));

  const riscoRuptura = sugestoes
    .filter((s) => s.status === "critico" || s.status === "atencao")
    .sort((a, b) => (a.coberturaDias ?? 9999) - (b.coberturaDias ?? 9999))
    .slice(0, 10);

  const semEstoque = sugestoes.filter((s) => s.estoqueDisponivel <= 0).length;
  const rompeAntesDoProximoPedido = sugestoes.filter(
    (s) => s.coberturaDias != null && s.coberturaDias < s.leadTimeDias
  ).length;

  const SESSENTA_DIAS_MS = 60 * 24 * 60 * 60 * 1000;
  const capitalParado = sugestoes
    .filter(
      (s) =>
        s.demandaDiaria === 0 &&
        (s.coberturaDias == null || s.coberturaDias > 120) &&
        s.estoqueLocal > 0
    )
    .map((s) => ({
      produtoId: s.produtoId,
      nome: s.nome,
      estoqueLocal: s.estoqueLocal,
      valor: verCusto && s.custoMedio != null ? s.estoqueLocal * s.custoMedio : null,
    }));

  return {
    geradoEm: agora.toISOString(),
    periodo: { dias: periodoDias },
    metricas: {
      faturamentoLiquido: {
        valor: vendasBloco.dados.receitaLiquida,
        parcial: vendasBloco.parcial,
        deltaPercentual: vendasBloco.dados.deltaPercentual,
      },
      margemContribuicao: verCusto
        ? {
            valor: margemContribuicao,
            percentual: (vendasBloco.dados.margemContribuicaoPercentual ?? 0) * 100,
            produtosSemCustoNaVenda: vendasBloco.dados.vendasIncompletas,
          }
        : null,
      unidadesVendidas: vendasBloco.dados.unidades,
      ticketMedio: vendasBloco.dados.ticketMedio ?? 0,
      valorEstoqueCusto: verCusto
        ? {
            valor: estoqueLocalBloco.dados.valorTotal,
            produtosSemCusto: estoqueLocalBloco.dados.produtosSemCusto,
          }
        : null,
    },
    pendencias: {
      parcial: pendenciasBloco.parcial,
      porCodigo: pendenciasBloco.dados.reduce((acc, item) => {
        for (const p of item.pendencias) {
          acc[p.codigo] = (acc[p.codigo] ?? 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      custoIndefinidoCount,
    },
    estoque: {
      parcial: reposicaoBloco.parcial,
      topProdutos: topEstoque,
    },
    riscoRuptura: {
      parcial: reposicaoBloco.parcial,
      itens: riscoRuptura,
      semEstoque,
      rompeAntesDoProximoPedido,
    },
    capitalParado: {
      parcial: reposicaoBloco.parcial,
      itens: capitalParado,
      valorTotal: capitalParado.reduce((s, i) => s + (i.valor ?? 0), 0),
    },
    vendas: {
      parcial: vendasBloco.parcial,
      serieDiaria: vendasBloco.dados.serieDiaria,
      topPorMargem: verCusto ? vendasBloco.dados.topPorMargem : [],
    },
    compras: {
      parcial: comprasBloco.parcial,
      ...comprasBloco.dados,
    },
    integracoes: {
      parcial: integracoesBloco.parcial,
      ...integracoesBloco.dados,
    },
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const periodoDias = Math.min(
      90,
      Math.max(7, Number(searchParams.get("periodo")) || 30)
    );
    const verCusto = podeVer(user.role, "VER_CUSTO");

    const resumo = await withCache(
      createCacheKey("dashboard-resumo", user.contaId, periodoDias, String(verCusto)),
      () => montarResumo(user.contaId, periodoDias, verCusto),
      "analytics"
    );

    return NextResponse.json(resumo);
  } catch (error) {
    console.error("[DASHBOARD_RESUMO] Erro:", error);
    return NextResponse.json(
      { error: "Erro ao montar resumo do dashboard" },
      { status: 500 }
    );
  }
}
