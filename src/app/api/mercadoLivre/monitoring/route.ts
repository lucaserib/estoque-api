import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { withCache, createCacheKey, getUserCacheStats } from "@/lib/cache";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const period = searchParams.get("period") || "24h"; // 1h, 24h, 7d, 30d
    const includeDetails = searchParams.get("details") === "true";

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID é obrigatório" },
        { status: 400 }
      );
    }

    // Verificar se a conta pertence ao usuário
    const account = await prisma.mercadoLivreAccount.findFirst({
      where: {
        id: accountId,
        userId: user.id,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: "Conta não encontrada" },
        { status: 404 }
      );
    }

    console.log(`[MONITORING] Coletando métricas de performance para ${accountId} (${period})`);

    const cacheKey = createCacheKey("monitoring", accountId, period);

    const monitoringData = await withCache(
      cacheKey,
      async () => {
        const metrics = await collectPerformanceMetrics(accountId, user.id, period, includeDetails);
        return metrics;
      },
      "metrics",
      "monitoring"
    );

    return NextResponse.json({
      success: true,
      data: monitoringData,
      metadata: {
        accountId,
        userId: user.id,
        period,
        includeDetails,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[MONITORING] Erro:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao coletar métricas de monitoramento",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

/**
 * ✅ COLETA COMPLETA DE MÉTRICAS DE PERFORMANCE
 */
async function collectPerformanceMetrics(
  accountId: string,
  userId: string,
  period: string,
  includeDetails: boolean
) {
  const now = new Date();
  const periodMs = getPeriodMs(period);
  const startDate = new Date(now.getTime() - periodMs);

  console.log(`[MONITORING] Coletando métricas de ${startDate.toISOString()} até ${now.toISOString()}`);

  // ✅ MÉTRICAS PARALELAS
  const [
    syncMetrics,
    apiMetrics,
    cacheMetrics,
    businessMetrics,
    errorMetrics,
    systemMetrics,
  ] = await Promise.allSettled([
    collectSyncMetrics(accountId, startDate, now),
    collectApiMetrics(accountId, startDate, now),
    collectCacheMetrics(userId),
    collectBusinessMetrics(accountId, startDate, now),
    collectErrorMetrics(accountId, startDate, now),
    collectSystemMetrics(),
  ]);

  // Helper para resolver Promise.allSettled
  const resolveMetric = <T>(result: PromiseSettledResult<T>, fallback: T): T => {
    return result.status === "fulfilled" ? result.value : fallback;
  };

  const syncData = resolveMetric(syncMetrics, {
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    averageSyncTime: 0,
    lastSyncTime: null,
    syncHealthScore: 0,
  });

  const apiData = resolveMetric(apiMetrics, {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    apiHealthScore: 0,
  });

  const cacheData = resolveMetric(cacheMetrics, {
    hitRate: 0,
    entries: 0,
    memoryUsage: 0,
    efficiency: "N/A",
  });

  const businessData = resolveMetric(businessMetrics, {
    productsProcessed: 0,
    ordersProcessed: 0,
    revenueTracked: 0,
    stockUpdates: 0,
  });

  const errorData = resolveMetric(errorMetrics, {
    totalErrors: 0,
    criticalErrors: 0,
    errorRate: 0,
    topErrors: [],
  });

  const systemData = resolveMetric(systemMetrics, {
    uptime: 0,
    memoryUsage: 0,
    cpuUsage: 0,
  });

  // ✅ CALCULAR SCORE GERAL DE SAÚDE
  const overallHealthScore = calculateOverallHealthScore({
    sync: syncData.syncHealthScore,
    api: apiData.apiHealthScore,
    cache: cacheData.hitRate,
    errors: 100 - errorData.errorRate,
  });

  // ✅ INSIGHTS AUTOMÁTICOS
  const insights = generatePerformanceInsights({
    syncData,
    apiData,
    cacheData,
    businessData,
    errorData,
    overallHealthScore,
  });

  const result = {
    // Score geral
    healthScore: overallHealthScore,
    status: getHealthStatus(overallHealthScore),

    // Métricas detalhadas
    sync: syncData,
    api: apiData,
    cache: cacheData,
    business: businessData,
    errors: errorData,
    system: systemData,

    // Insights automáticos
    insights,

    // Recomendações
    recommendations: generateRecommendations({
      syncData,
      apiData,
      cacheData,
      errorData,
      overallHealthScore,
    }),

    // Metadata
    period,
    collectedAt: now.toISOString(),
    dataPoints: {
      sync: syncData.totalSyncs,
      api: apiData.totalRequests,
      business: businessData.productsProcessed,
      errors: errorData.totalErrors,
    },
  };

  // ✅ ADICIONAR DETALHES SE SOLICITADO
  if (includeDetails) {
    result.details = await collectDetailedMetrics(accountId, startDate, now);
  }

  return result;
}

/**
 * ✅ MÉTRICAS DE SINCRONIZAÇÃO
 */
async function collectSyncMetrics(accountId: string, startDate: Date, endDate: Date) {
  try {
    // Buscar histórico de sincronizações
    const syncHistory = await prisma.mercadoLivreSyncHistory.findMany({
      where: {
        accountId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const totalSyncs = syncHistory.length;
    const successfulSyncs = syncHistory.filter(s => s.status === "completed").length;
    const failedSyncs = syncHistory.filter(s => s.status === "error").length;

    // Calcular tempo médio de sincronização
    const syncTimes = syncHistory
      .filter(s => s.duration && s.duration > 0)
      .map(s => s.duration!);

    const averageSyncTime = syncTimes.length > 0
      ? Math.round(syncTimes.reduce((sum, time) => sum + time, 0) / syncTimes.length)
      : 0;

    // Última sincronização
    const lastSync = syncHistory[0];

    // Score de saúde da sincronização
    const successRate = totalSyncs > 0 ? (successfulSyncs / totalSyncs) * 100 : 100;
    const timeScore = averageSyncTime > 0 ? Math.max(0, 100 - (averageSyncTime / 1000)) : 100; // Penalizar se > 10s
    const syncHealthScore = Math.round((successRate * 0.7) + (timeScore * 0.3));

    return {
      totalSyncs,
      successfulSyncs,
      failedSyncs,
      averageSyncTime,
      lastSyncTime: lastSync?.createdAt.toISOString() || null,
      syncHealthScore: Math.min(100, syncHealthScore),
      successRate: Math.round(successRate * 100) / 100,
    };
  } catch (error) {
    console.error("[MONITORING] Erro ao coletar métricas de sync:", error);
    throw error;
  }
}

/**
 * ✅ MÉTRICAS DE API (SIMULADAS - em produção usar APM real)
 */
async function collectApiMetrics(accountId: string, startDate: Date, endDate: Date) {
  try {
    // Por enquanto, usar dados de produtos como proxy para atividade da API
    const productsActivity = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        lastSyncAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        lastSyncAt: true,
        syncStatus: true,
      },
    });

    const totalRequests = productsActivity.length;
    const successfulRequests = productsActivity.filter(p => p.syncStatus === "synced").length;
    const failedRequests = productsActivity.filter(p => p.syncStatus === "error").length;

    // Simular tempo de resposta baseado na atividade
    const averageResponseTime = totalRequests > 0 ? Math.random() * 1000 + 200 : 0; // 200-1200ms

    // Score de saúde da API
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
    const responseTimeScore = averageResponseTime > 0 ? Math.max(0, 100 - (averageResponseTime / 10)) : 100;
    const apiHealthScore = Math.round((successRate * 0.6) + (responseTimeScore * 0.4));

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime: Math.round(averageResponseTime),
      apiHealthScore: Math.min(100, apiHealthScore),
      successRate: Math.round(successRate * 100) / 100,
    };
  } catch (error) {
    console.error("[MONITORING] Erro ao coletar métricas de API:", error);
    throw error;
  }
}

/**
 * ✅ MÉTRICAS DE CACHE
 */
async function collectCacheMetrics(userId: string) {
  try {
    const cacheStats = getUserCacheStats(userId);
    const { mlCache } = await import("@/lib/cache");
    const globalStats = mlCache.getStats();

    return {
      hitRate: globalStats.hitRate || 0,
      entries: cacheStats.entries,
      memoryUsage: cacheStats.memoryUsageKB,
      efficiency: globalStats.efficiency || "N/A",
      globalEntries: globalStats.size,
      globalHitRate: globalStats.hitRate || 0,
    };
  } catch (error) {
    console.error("[MONITORING] Erro ao coletar métricas de cache:", error);
    throw error;
  }
}

/**
 * ✅ MÉTRICAS DE NEGÓCIO
 */
async function collectBusinessMetrics(accountId: string, startDate: Date, endDate: Date) {
  try {
    const [
      productsProcessed,
      stockUpdates,
      webhooksReceived,
    ] = await Promise.all([
      // Produtos processados
      prisma.produtoMercadoLivre.count({
        where: {
          mercadoLivreAccountId: accountId,
          lastSyncAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),

      // Atualizações de estoque
      prisma.produtoMercadoLivre.count({
        where: {
          mercadoLivreAccountId: accountId,
          lastSyncAt: {
            gte: startDate,
            lte: endDate,
          },
          syncStatus: "synced",
        },
      }),

      // Webhooks recebidos (se tivermos tabela de webhooks)
      prisma.mercadoLivreWebhook?.count?.({
        where: {
          accountId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      }) || Promise.resolve(0),
    ]);

    return {
      productsProcessed,
      stockUpdates,
      webhooksReceived,
      ordersProcessed: 0, // TODO: Implementar quando tivermos tabela de pedidos
      revenueTracked: 0,  // TODO: Implementar rastreamento de receita
    };
  } catch (error) {
    console.error("[MONITORING] Erro ao coletar métricas de negócio:", error);
    throw error;
  }
}

/**
 * ✅ MÉTRICAS DE ERRO
 */
async function collectErrorMetrics(accountId: string, startDate: Date, endDate: Date) {
  try {
    const errorProducts = await prisma.produtoMercadoLivre.findMany({
      where: {
        mercadoLivreAccountId: accountId,
        syncStatus: "error",
        lastSyncAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        syncError: true,
        mlItemId: true,
        mlTitle: true,
      },
    });

    const totalErrors = errorProducts.length;
    const criticalErrors = errorProducts.filter(p =>
      p.syncError?.toLowerCase().includes("critical") ||
      p.syncError?.toLowerCase().includes("authorization") ||
      p.syncError?.toLowerCase().includes("forbidden")
    ).length;

    // Agrupar erros por tipo
    const errorTypes = new Map<string, number>();
    errorProducts.forEach(product => {
      if (product.syncError) {
        const errorType = extractErrorType(product.syncError);
        errorTypes.set(errorType, (errorTypes.get(errorType) || 0) + 1);
      }
    });

    const topErrors = Array.from(errorTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Taxa de erro
    const totalProducts = await prisma.produtoMercadoLivre.count({
      where: {
        mercadoLivreAccountId: accountId,
      },
    });

    const errorRate = totalProducts > 0 ? (totalErrors / totalProducts) * 100 : 0;

    return {
      totalErrors,
      criticalErrors,
      errorRate: Math.round(errorRate * 100) / 100,
      topErrors,
      errorProducts: errorProducts.slice(0, 10), // Top 10 produtos com erro
    };
  } catch (error) {
    console.error("[MONITORING] Erro ao coletar métricas de erro:", error);
    throw error;
  }
}

/**
 * ✅ MÉTRICAS DE SISTEMA
 */
async function collectSystemMetrics() {
  try {
    // Simular métricas de sistema (em produção, usar bibliotecas como 'os' ou APM)
    const uptime = process.uptime() * 1000; // em ms
    const memoryUsage = process.memoryUsage();

    return {
      uptime: Math.round(uptime),
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      cpuUsage: 0, // TODO: Implementar CPU usage real
      nodeVersion: process.version,
      platform: process.platform,
    };
  } catch (error) {
    console.error("[MONITORING] Erro ao coletar métricas de sistema:", error);
    throw error;
  }
}

// ✅ FUNÇÕES AUXILIARES

function getPeriodMs(period: string): number {
  switch (period) {
    case "1h": return 60 * 60 * 1000;
    case "24h": return 24 * 60 * 60 * 1000;
    case "7d": return 7 * 24 * 60 * 60 * 1000;
    case "30d": return 30 * 24 * 60 * 60 * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}

function calculateOverallHealthScore(scores: any): number {
  const weights = { sync: 0.3, api: 0.3, cache: 0.2, errors: 0.2 };

  return Math.round(
    (scores.sync * weights.sync) +
    (scores.api * weights.api) +
    (scores.cache * weights.cache) +
    (scores.errors * weights.errors)
  );
}

function getHealthStatus(score: number): string {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

function extractErrorType(errorMessage: string): string {
  const error = errorMessage.toLowerCase();

  if (error.includes("timeout")) return "timeout";
  if (error.includes("authorization") || error.includes("token")) return "auth";
  if (error.includes("network") || error.includes("connection")) return "network";
  if (error.includes("rate limit")) return "rate_limit";
  if (error.includes("validation")) return "validation";
  if (error.includes("not found")) return "not_found";

  return "other";
}

function generatePerformanceInsights(data: any): string[] {
  const insights = [];

  if (data.syncData.syncHealthScore < 70) {
    insights.push(`Performance de sincronização baixa (${data.syncData.syncHealthScore}%) - Verificar conectividade`);
  }

  if (data.cacheData.hitRate < 60) {
    insights.push(`Taxa de acerto do cache baixa (${data.cacheData.hitRate}%) - Revisar estratégia de cache`);
  }

  if (data.errorData.errorRate > 10) {
    insights.push(`Taxa de erro alta (${data.errorData.errorRate}%) - Investigar problemas críticos`);
  }

  if (data.apiData.averageResponseTime > 2000) {
    insights.push(`Tempo de resposta da API alto (${data.apiData.averageResponseTime}ms) - Otimizar requisições`);
  }

  if (data.overallHealthScore >= 90) {
    insights.push("Sistema operando com excelente performance!");
  }

  return insights.slice(0, 3); // Máximo 3 insights
}

function generateRecommendations(data: any): string[] {
  const recommendations = [];

  if (data.syncData.averageSyncTime > 10000) {
    recommendations.push("Implementar sincronização incremental para reduzir tempo");
  }

  if (data.cacheData.hitRate < 70) {
    recommendations.push("Aumentar TTL do cache para dados menos voláteis");
  }

  if (data.errorData.totalErrors > 5) {
    recommendations.push("Configurar retry automático para reduzir erros temporários");
  }

  if (data.overallHealthScore < 60) {
    recommendations.push("Revisar configuração geral do sistema");
  }

  return recommendations.slice(0, 3); // Máximo 3 recomendações
}

async function collectDetailedMetrics(accountId: string, startDate: Date, endDate: Date) {
  // TODO: Implementar métricas detalhadas se necessário
  return {
    timeline: [], // Métricas por hora/dia
    breakdown: {}, // Breakdown detalhado por categoria
    comparisons: {}, // Comparações com períodos anteriores
  };
}