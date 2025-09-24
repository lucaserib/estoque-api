import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";

/**
 * API de SINCRONIZAÇÃO RÁPIDA
 * Usa as APIs otimizadas para atualizar preços e vendas sem demorar
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const {
      accountId,
      updatePrices = true,
      updateSales = true,
      period = 30,
    } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "accountId é obrigatório" },
        { status: 400 }
      );
    }

    console.log(`[QUICK_SYNC] Iniciando sincronização rápida...`);

    const account = await prisma.mercadoLivreAccount.findFirst({
      where: { id: accountId, userId: user.id, isActive: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    // ✅ CORREÇÃO: Tipos específicos em vez de any
    interface ResultadoPrecos {
      success?: boolean;
      updated?: number;
      withPromotion?: number;
      error?: string;
    }

    interface ResultadoVendas {
      success?: boolean;
      summary?: {
        totalQuantity?: number;
        totalRevenue?: number;
      };
      error?: string;
    }

    const resultados = {
      precos: null as ResultadoPrecos | null,
      vendas: null as ResultadoVendas | null,
      inicio: new Date().toISOString(),
      fim: null as string | null,
      duracao: null as number | null,
    };

    try {
      const startTime = Date.now();

      // ✅ ETAPA 1: Atualizar preços (se solicitado)
      if (updatePrices) {
        console.log(`[QUICK_SYNC] Atualizando preços promocionais...`);

        const precosResponse = await fetch(
          `${request.nextUrl.origin}/api/mercadolivre/precos-batch`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: request.headers.get("authorization") || "",
              Cookie: request.headers.get("cookie") || "",
            },
            body: JSON.stringify({
              accountId,
              forceUpdate: false, // Update inteligente
            }),
          }
        );

        if (precosResponse.ok) {
          resultados.precos = await precosResponse.json();
          console.log(
            `[QUICK_SYNC] ✅ Preços: ${resultados.precos.updated} atualizados`
          );
        } else {
          console.warn(
            `[QUICK_SYNC] ⚠️ Erro ao atualizar preços: ${precosResponse.status}`
          );
          resultados.precos = { error: `HTTP ${precosResponse.status}` };
        }
      }

      // ✅ ETAPA 2: Atualizar vendas (se solicitado)
      if (updateSales) {
        console.log(`[QUICK_SYNC] Atualizando vendas (${period} dias)...`);

        const vendasResponse = await fetch(
          `${request.nextUrl.origin}/api/mercadolivre/analytics/sales-optimized?accountId=${accountId}&period=${period}`,
          {
            method: "GET",
            headers: {
              Authorization: request.headers.get("authorization") || "",
              Cookie: request.headers.get("cookie") || "",
            },
          }
        );

        if (vendasResponse.ok) {
          resultados.vendas = await vendasResponse.json();
          console.log(
            `[QUICK_SYNC] ✅ Vendas: ${
              resultados.vendas.summary?.totalQuantity || 0
            } itens vendidos`
          );
        } else {
          console.warn(
            `[QUICK_SYNC] ⚠️ Erro ao atualizar vendas: ${vendasResponse.status}`
          );
          resultados.vendas = { error: `HTTP ${vendasResponse.status}` };
        }
      }

      // ✅ FINALIZAÇÃO: Calcular métricas
      const endTime = Date.now();
      resultados.fim = new Date().toISOString();
      resultados.duracao = endTime - startTime;

      console.log(
        `[QUICK_SYNC] ✅ Sincronização concluída em ${resultados.duracao}ms`
      );

      // ✅ TESTE: Verificar algumas métricas pós-sincronização
      const metricas = await prisma.produtoMercadoLivre.aggregate({
        where: {
          mercadoLivreAccountId: accountId,
          mlStatus: "active",
        },
        _count: {
          mlItemId: true,
        },
        _sum: {
          mlSoldQuantity: true,
        },
        _avg: {
          mlPrice: true,
        },
      });

      const promocoes = await prisma.produtoMercadoLivre.count({
        where: {
          mercadoLivreAccountId: accountId,
          mlStatus: "active",
          mlHasPromotion: true,
        },
      });

      return NextResponse.json({
        success: true,
        duracao: `${resultados.duracao}ms`,
        timestamp: resultados.fim,
        account: account.nickname,

        // ✅ RESULTADOS: Por etapa
        etapas: {
          precos: updatePrices ? resultados.precos : "não solicitado",
          vendas: updateSales ? resultados.vendas : "não solicitado",
        },

        // ✅ MÉTRICAS: Pós-sincronização
        metricas: {
          produtosAtivos: metricas._count.mlItemId || 0,
          produtosComPromocao: promocoes,
          totalVendas: metricas._sum.mlSoldQuantity || 0,
          precoMedio: metricas._avg.mlPrice
            ? Math.round(metricas._avg.mlPrice)
            : 0,
          vendaMediaPorProduto:
            metricas._count.mlItemId > 0
              ? Math.round(
                  ((metricas._sum.mlSoldQuantity || 0) /
                    metricas._count.mlItemId) *
                    100
                ) / 100
              : 0,
        },

        // ✅ RESUMO: Para o usuário
        resumo: {
          message:
            updatePrices && updateSales
              ? "Preços e vendas atualizados com sucesso"
              : updatePrices
              ? "Preços atualizados com sucesso"
              : "Vendas atualizadas com sucesso",

          detalhes: [
            updatePrices && resultados.precos?.updated > 0
              ? `${resultados.precos.updated} preços atualizados, ${resultados.precos.withPromotion} com promoção`
              : null,
            updateSales && resultados.vendas?.summary?.totalQuantity > 0
              ? `${resultados.vendas.summary.totalQuantity} vendas processadas em ${period} dias`
              : null,
          ].filter(Boolean),

          alertas: [
            metricas._sum.mlSoldQuantity === 0
              ? "⚠️ Nenhuma venda encontrada no período"
              : null,
            promocoes === 0 ? "ℹ️ Nenhuma promoção ativa encontrada" : null,
            resultados.duracao && resultados.duracao > 10000
              ? "⚠️ Sincronização demorou mais que 10s"
              : null,
          ].filter(Boolean),
        },

        // ✅ PRÓXIMOS PASSOS: Sugestões automáticas
        proximosPassos: [
          metricas._sum.mlSoldQuantity === 0
            ? "Verifique configuração de webhooks ou período de análise"
            : null,
          promocoes > 0 ? "Considere analisar performance das promoções" : null,
          "Use /api/mercadolivre/test-prices para validar consistência dos dados",
        ].filter(Boolean),
      });
    } catch (syncError) {
      console.error("[QUICK_SYNC] Erro durante sincronização:", syncError);
      return NextResponse.json(
        {
          error: "Erro durante sincronização",
          details:
            syncError instanceof Error
              ? syncError.message
              : "Erro desconhecido",
          etapas: resultados,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[QUICK_SYNC] Erro:", error);
    return NextResponse.json(
      {
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}
