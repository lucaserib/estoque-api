import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { withCache, createCacheKey } from "@/lib/cache";
import { podeVer } from "@/lib/permissoes";
import { calcularTodasPendencias } from "@/services/pendenciasService";
import { calcularReposicaoConta } from "@/services/reposicaoService";
import { MercadoLivreService } from "@/services/mercadoLivreService";
import { fetchOrdersWithFallback } from "@/lib/mlOrders";

const STATUS_VENDA_VALIDOS = [
  "paid",
  "delivered",
  "ready_to_ship",
  "shipped",
  "handling",
];

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

  const mlAccount = await prisma.mercadoLivreAccount.findFirst({
    where: { userId, isActive: true },
  });

  const vendasBloco = await comFallback(
    async () => {
      if (!mlAccount) {
        return {
          totalRevenue: 0,
          totalItems: 0,
          totalSaleFees: 0,
          custoVendido: 0,
          produtosSemCustoNaVenda: 0,
          serieDiaria: [] as Array<{
            data: string;
            receita: number;
            unidades: number;
            pedidos: number;
          }>,
          topPorMargem: [] as Array<{ produtoId: string | null; nome: string; margem: number }>,
          revenueAnterior: 0,
          parcialPedidos: false,
        };
      }

      const accessToken = await MercadoLivreService.getValidToken(mlAccount.id);
      const { orders, parcial } = await fetchOrdersWithFallback({
        accessToken,
        sellerId: mlAccount.mlUserId,
        dateFrom: inicioPeriodoAnterior,
        dateTo: agora,
      });

      const custoPorMlItem = new Map<string, { custoMedio: number | null; nome: string; produtoId: string | null }>();
      const produtosMl = await prisma.produtoMercadoLivre.findMany({
        where: { mercadoLivreAccountId: mlAccount.id },
        select: {
          mlItemId: true,
          mlTitle: true,
          produtoId: true,
          produto: { select: { custoMedio: true } },
        },
      });
      for (const p of produtosMl) {
        custoPorMlItem.set(p.mlItemId, {
          custoMedio: p.produto?.custoMedio ?? null,
          nome: p.mlTitle,
          produtoId: p.produtoId,
        });
      }

      let totalRevenue = 0;
      let totalItems = 0;
      let totalSaleFees = 0;
      let custoVendido = 0;
      let produtosSemCustoNaVenda = 0;
      let revenueAnterior = 0;
      const diaMap = new Map<
        string,
        { receita: number; unidades: number; pedidos: number }
      >();
      const margemPorProduto = new Map<string, { nome: string; margem: number }>();

      for (const order of orders) {
        if (!STATUS_VENDA_VALIDOS.includes(order.status)) continue;
        const dataPedido = new Date(order.date_created);
        const noPeriodoAtual = dataPedido >= inicioPeriodo;
        const noPeriodoAnterior = !noPeriodoAtual && dataPedido >= inicioPeriodoAnterior;

        if (!noPeriodoAtual && !noPeriodoAnterior) continue;

        if (noPeriodoAnterior) {
          revenueAnterior += order.total_amount || 0;
          continue;
        }

        totalRevenue += order.total_amount || 0;
        const diaKey = dataPedido.toISOString().split("T")[0];
        const diaAtual =
          diaMap.get(diaKey) ?? { receita: 0, unidades: 0, pedidos: 0 };
        diaAtual.receita += order.total_amount || 0;
        diaAtual.pedidos += 1;

        for (const item of order.order_items) {
          totalItems += item.quantity;
          diaAtual.unidades += item.quantity;
          totalSaleFees += (item.sale_fee || 0) * item.quantity;

          const info = custoPorMlItem.get(item.item.id);
          if (info?.custoMedio != null) {
            const custoItem = info.custoMedio * item.quantity;
            custoVendido += custoItem;
            const margemItem =
              item.unit_price * item.quantity -
              (item.sale_fee || 0) * item.quantity -
              custoItem;
            const chave = info.produtoId ?? item.item.id;
            const atual = margemPorProduto.get(chave) ?? {
              nome: info.nome,
              margem: 0,
            };
            atual.margem += margemItem;
            margemPorProduto.set(chave, atual);
          } else {
            produtosSemCustoNaVenda += 1;
          }
        }
        diaMap.set(diaKey, diaAtual);
      }

      const serieDiaria = Array.from(diaMap.entries())
        .map(([data, v]) => ({
          data,
          receita: v.receita,
          unidades: v.unidades,
          pedidos: v.pedidos,
        }))
        .sort((a, b) => a.data.localeCompare(b.data));

      const topPorMargem = Array.from(margemPorProduto.entries())
        .map(([produtoId, v]) => ({ produtoId, nome: v.nome, margem: v.margem }))
        .sort((a, b) => b.margem - a.margem)
        .slice(0, 10);

      return {
        totalRevenue,
        totalItems,
        totalSaleFees,
        custoVendido,
        produtosSemCustoNaVenda,
        serieDiaria,
        topPorMargem,
        revenueAnterior,
        parcialPedidos: parcial,
      };
    },
    {
      totalRevenue: 0,
      totalItems: 0,
      totalSaleFees: 0,
      custoVendido: 0,
      produtosSemCustoNaVenda: 0,
      serieDiaria: [],
      topPorMargem: [],
      revenueAnterior: 0,
      parcialPedidos: false,
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

  const margemContribuicao = verCusto
    ? vendasBloco.dados.totalRevenue -
      vendasBloco.dados.totalSaleFees -
      vendasBloco.dados.custoVendido
    : null;

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
        valor:
          vendasBloco.dados.totalRevenue -
          vendasBloco.dados.totalSaleFees,
        parcial: vendasBloco.parcial || vendasBloco.dados.parcialPedidos,
        deltaPercentual:
          vendasBloco.dados.revenueAnterior > 0
            ? ((vendasBloco.dados.totalRevenue - vendasBloco.dados.revenueAnterior) /
                vendasBloco.dados.revenueAnterior) *
              100
            : null,
      },
      margemContribuicao: verCusto
        ? {
            valor: margemContribuicao,
            percentual:
              vendasBloco.dados.totalRevenue > 0
                ? ((margemContribuicao as number) / vendasBloco.dados.totalRevenue) * 100
                : 0,
            produtosSemCustoNaVenda: vendasBloco.dados.produtosSemCustoNaVenda,
          }
        : null,
      unidadesVendidas: vendasBloco.dados.totalItems,
      ticketMedio:
        vendasBloco.dados.totalItems > 0
          ? vendasBloco.dados.totalRevenue / vendasBloco.dados.totalItems
          : 0,
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
      parcial: vendasBloco.parcial || vendasBloco.dados.parcialPedidos,
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
