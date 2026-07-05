import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/helpers/verifyUser";
import { prisma } from "@/lib/prisma";
import { withCache, createCacheKey } from "@/lib/cache";

type AlertSeverity = "critical" | "warning" | "info";
type AlertType = "stock" | "sync" | "sales";

interface AlertAction {
  label: string;
  action: string;
  urgent?: boolean;
}

interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string | Date;
  details?: Record<string, unknown>;
  actions?: AlertAction[];
  url?: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const type = searchParams.get("type") || "all"; // all, stock, sync, sales
    const severity = searchParams.get("severity") || "all"; // all, critical, warning, info
    const limit = parseInt(searchParams.get("limit") || "20");

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

    console.log(`[ALERTS_API] Buscando alertas: type=${type}, severity=${severity}`);

    const cacheKey = createCacheKey("alerts", accountId, type, severity);

    const alerts = await withCache(
      cacheKey,
      async () => {
        const allAlerts = [];

        // ✅ ALERTAS DE ESTOQUE
        if (type === "all" || type === "stock") {
          const stockAlerts = await getStockAlerts(accountId, severity);
          allAlerts.push(...stockAlerts);
        }

        // ✅ ALERTAS DE SINCRONIZAÇÃO
        if (type === "all" || type === "sync") {
          const syncAlerts = await getSyncAlerts(accountId, severity);
          allAlerts.push(...syncAlerts);
        }

        // ✅ ALERTAS DE VENDAS
        if (type === "all" || type === "sales") {
          const salesAlerts = await getSalesAlerts(accountId, severity);
          allAlerts.push(...salesAlerts);
        }

        // Ordenar por criticidade e data
        return allAlerts
          .sort((a: Alert, b: Alert) => {
            const severityOrder: Record<AlertSeverity, number> = { critical: 3, warning: 2, info: 1 };
            if (severityOrder[a.severity] !== severityOrder[b.severity]) {
              return severityOrder[b.severity] - severityOrder[a.severity];
            }
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          })
          .slice(0, limit);
      },
      "alerts",
      "realtime"
    );

    // ✅ ESTATÍSTICAS DOS ALERTAS
    const stats = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === "critical").length,
      warning: alerts.filter(a => a.severity === "warning").length,
      info: alerts.filter(a => a.severity === "info").length,
      byType: {
        stock: alerts.filter(a => a.type === "stock").length,
        sync: alerts.filter(a => a.type === "sync").length,
        sales: alerts.filter(a => a.type === "sales").length,
      },
    };

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        stats,
        metadata: {
          accountId,
          type,
          severity,
          limit,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("[ALERTS_API] Erro:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao buscar alertas",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}

// ✅ FUNÇÕES DE ALERTAS

async function getStockAlerts(accountId: string, severityFilter: string): Promise<Alert[]> {
  const produtos = await prisma.produtoMercadoLivre.findMany({
    where: {
      mercadoLivreAccountId: accountId,
      mlStatus: "active", // Apenas produtos ativos
    },
    include: {
      produto: {
        include: {
          estoques: {
            include: {
              armazem: true,
            },
          },
        },
      },
    },
  });

  const alerts: Alert[] = [];
  const now = new Date();

  produtos.forEach(produtoML => {
    const localStock = produtoML.produto?.estoques.reduce(
      (sum, estoque) => sum + estoque.quantidade,
      0
    ) || 0;

    // Pegar estoque de segurança do primeiro armazém ou usar valor padrão
    const estoqueSeguranca = produtoML.produto?.estoques[0]?.estoqueSeguranca || 10;
    const mlStock = produtoML.mlAvailableQuantity;

    // ✅ ALERTA CRÍTICO: Sem estoque
    if (mlStock === 0) {
      const alert = {
        id: `stock_critical_${produtoML.mlItemId}`,
        type: "stock" as const,
        severity: "critical" as const,
        title: "Produto Esgotado",
        message: `${produtoML.mlTitle} está sem estoque no Mercado Livre`,
        details: {
          mlItemId: produtoML.mlItemId,
          productName: produtoML.mlTitle,
          mlStock: 0,
          localStock,
          sku: produtoML.produto?.sku,
        },
        actions: [
          { label: "Repor Estoque", action: "restock", urgent: true },
          { label: "Pausar Produto", action: "pause", urgent: false },
        ],
        timestamp: now.toISOString(),
        url: `/mercado-livre/produtos?search=${produtoML.mlItemId}`,
      };

      if (severityFilter === "all" || severityFilter === "critical") {
        alerts.push(alert);
      }
    }

    // ✅ ALERTA WARNING: Estoque baixo
    else if (mlStock <= 5 && mlStock > 0) {
      const alert = {
        id: `stock_warning_${produtoML.mlItemId}`,
        type: "stock" as const,
        severity: "warning" as const,
        title: "Estoque Baixo",
        message: `${produtoML.mlTitle} tem apenas ${mlStock} unidades`,
        details: {
          mlItemId: produtoML.mlItemId,
          productName: produtoML.mlTitle,
          mlStock,
          localStock,
          sku: produtoML.produto?.sku,
          threshold: 5,
        },
        actions: [
          { label: "Repor Estoque", action: "restock", urgent: false },
          { label: "Ajustar Limite", action: "adjust_threshold", urgent: false },
        ],
        timestamp: now.toISOString(),
        url: `/mercado-livre/produtos?search=${produtoML.mlItemId}`,
      };

      if (severityFilter === "all" || severityFilter === "warning") {
        alerts.push(alert);
      }
    }

    // ✅ ALERTA INFO: Dessincronia de estoque
    else if (Math.abs(mlStock - localStock) > 5 && localStock > 0) {
      const alert = {
        id: `stock_info_${produtoML.mlItemId}`,
        type: "stock" as const,
        severity: "info" as const,
        title: "Estoque Dessincronizado",
        message: `Diferença entre estoque local (${localStock}) e ML (${mlStock})`,
        details: {
          mlItemId: produtoML.mlItemId,
          productName: produtoML.mlTitle,
          mlStock,
          localStock,
          difference: Math.abs(mlStock - localStock),
          sku: produtoML.produto?.sku,
        },
        actions: [
          { label: "Sincronizar", action: "sync_stock", urgent: false },
          { label: "Verificar Estoque", action: "check_inventory", urgent: false },
        ],
        timestamp: now.toISOString(),
        url: `/mercado-livre/produtos?search=${produtoML.mlItemId}`,
      };

      if (severityFilter === "all" || severityFilter === "info") {
        alerts.push(alert);
      }
    }
  });

  return alerts;
}

async function getSyncAlerts(accountId: string, severityFilter: string): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();

  // ✅ PRODUTOS COM ERRO DE SINCRONIZAÇÃO
  const produtosComErro = await prisma.produtoMercadoLivre.findMany({
    where: {
      mercadoLivreAccountId: accountId,
      syncStatus: "error",
    },
    include: {
      produto: true,
    },
  });

  produtosComErro.forEach(produto => {
    const alert = {
      id: `sync_error_${produto.mlItemId}`,
      type: "sync" as const,
      severity: "warning" as const,
      title: "Erro de Sincronização",
      message: `Falha ao sincronizar ${produto.mlTitle}`,
      details: {
        mlItemId: produto.mlItemId,
        productName: produto.mlTitle,
        error: produto.syncError,
        lastSync: produto.lastSyncAt?.toISOString(),
        sku: produto.produto?.sku,
      },
      actions: [
        { label: "Tentar Novamente", action: "retry_sync", urgent: true },
        { label: "Ver Detalhes", action: "view_details", urgent: false },
      ],
      timestamp: now.toISOString(),
      url: `/mercado-livre/produtos?search=${produto.mlItemId}`,
    };

    if (severityFilter === "all" || severityFilter === "warning") {
      alerts.push(alert);
    }
  });

  // ✅ SINCRONIZAÇÃO DESATUALIZADA
  const umHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
  const produtosDesatualizados = await prisma.produtoMercadoLivre.count({
    where: {
      mercadoLivreAccountId: accountId,
      lastSyncAt: {
        lt: umHoraAtras,
      },
      syncStatus: { not: "error" },
    },
  });

  if (produtosDesatualizados > 0) {
    const alert = {
      id: `sync_outdated_${accountId}`,
      type: "sync" as const,
      severity: "info" as const,
      title: "Sincronização Desatualizada",
      message: `${produtosDesatualizados} produtos não sincronizados há mais de 1 hora`,
      details: {
        count: produtosDesatualizados,
        threshold: "1 hora",
        lastSync: umHoraAtras.toISOString(),
      },
      actions: [
        { label: "Sincronizar Agora", action: "full_sync", urgent: false },
        { label: "Configurar Auto-Sync", action: "setup_auto_sync", urgent: false },
      ],
      timestamp: now.toISOString(),
      url: `/mercado-livre/configuracoes`,
    };

    if (severityFilter === "all" || severityFilter === "info") {
      alerts.push(alert);
    }
  }

  return alerts;
}

async function getSalesAlerts(accountId: string, severityFilter: string): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();

  // ✅ VERIFICAR PRODUTOS SEM VENDAS HÁ MUITO TEMPO
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const produtosSemVendas = await prisma.produtoMercadoLivre.findMany({
    where: {
      mercadoLivreAccountId: accountId,
      mlStatus: "active",
      mlSoldQuantity: 0,
      // Produtos criados há mais de 30 dias
      createdAt: {
        lt: trintaDiasAtras,
      },
    },
    include: {
      produto: true,
    },
    take: 10, // Top 10 produtos sem vendas
    orderBy: {
      mlPrice: "desc", // Produtos mais caros primeiro
    },
  });

  if (produtosSemVendas.length > 0) {
    const alert = {
      id: `sales_no_sales_${accountId}`,
      type: "sales" as const,
      severity: "info" as const,
      title: "Produtos Sem Vendas",
      message: `${produtosSemVendas.length} produtos ativos sem vendas em 30+ dias`,
      details: {
        products: produtosSemVendas.slice(0, 5).map(p => ({
          mlItemId: p.mlItemId,
          title: p.mlTitle,
          price: p.mlPrice,
          daysActive: Math.floor((now.getTime() - p.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
        })),
        totalCount: produtosSemVendas.length,
      },
      actions: [
        { label: "Revisar Preços", action: "review_prices", urgent: false },
        { label: "Melhorar SEO", action: "improve_seo", urgent: false },
        { label: "Criar Promoção", action: "create_promotion", urgent: false },
      ],
      timestamp: now.toISOString(),
      url: `/mercado-livre/produtos?filter=no_sales`,
    };

    if (severityFilter === "all" || severityFilter === "info") {
      alerts.push(alert);
    }
  }

  // ✅ PRODUTOS COM PREÇOS MUITO BAIXOS OU ALTOS (comparado à média)
  const produtosComPrecos = await prisma.produtoMercadoLivre.findMany({
    where: {
      mercadoLivreAccountId: accountId,
      mlStatus: "active",
      mlPrice: { gt: 0 },
    },
    select: {
      mlItemId: true,
      mlTitle: true,
      mlPrice: true,
      produto: {
        select: {
          custoMedio: true,
          sku: true,
        },
      },
    },
  });

  const precosProblematicos = produtosComPrecos.filter(p => {
    if (!p.produto?.custoMedio || p.produto.custoMedio === 0) return false;

    const precoVenda = p.mlPrice / 100; // Converter de centavos
    const custoMedio = p.produto.custoMedio / 100; // Converter de centavos
    const margem = ((precoVenda - custoMedio) / precoVenda) * 100;

    // Alertar se margem < 10% ou > 200%
    return margem < 10 || margem > 200;
  });

  if (precosProblematicos.length > 0) {
    const alert = {
      id: `sales_pricing_${accountId}`,
      type: "sales" as const,
      severity: "warning" as const,
      title: "Preços Problemáticos",
      message: `${precosProblematicos.length} produtos com margem inadequada`,
      details: {
        products: precosProblematicos.slice(0, 3).map(p => {
          const precoVenda = p.mlPrice / 100;
          const custoMedio = p.produto!.custoMedio! / 100;
          const margem = ((precoVenda - custoMedio) / precoVenda) * 100;

          return {
            mlItemId: p.mlItemId,
            title: p.mlTitle,
            price: precoVenda,
            cost: custoMedio,
            margin: Math.round(margem * 100) / 100,
            issue: margem < 10 ? "margem_baixa" : "margem_alta",
          };
        }),
        totalCount: precosProblematicos.length,
      },
      actions: [
        { label: "Revisar Custos", action: "review_costs", urgent: true },
        { label: "Ajustar Preços", action: "adjust_prices", urgent: true },
        { label: "Analisar Concorrência", action: "analyze_competition", urgent: false },
      ],
      timestamp: now.toISOString(),
      url: `/mercado-livre/produtos?filter=pricing_issues`,
    };

    if (severityFilter === "all" || severityFilter === "warning") {
      alerts.push(alert);
    }
  }

  return alerts;
}

// ✅ ENDPOINT PARA MARCAR ALERTAS COMO LIDOS
export async function POST(request: NextRequest) {
  try {
    const user = await verifyUser(request);
    const body = await request.json();
    const { accountId, alertIds, action } = body;

    if (!accountId || !alertIds || !Array.isArray(alertIds)) {
      return NextResponse.json(
        { error: "Parâmetros inválidos" },
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

    console.log(`[ALERTS_API] Processando ação: ${action} para ${alertIds.length} alertas`);

    // ✅ PROCESSAR AÇÃO
    const result = { success: true, processed: 0, errors: [] as string[] };

    switch (action) {
      case "mark_read":
        // Por enquanto, apenas log. Em produção, armazenar em tabela de alertas lidos
        console.log(`[ALERTS_API] Marcando como lidos:`, alertIds);
        result.processed = alertIds.length;
        break;

      case "dismiss":
        // Dispensar alertas permanentemente
        console.log(`[ALERTS_API] Dispensando alertas:`, alertIds);
        result.processed = alertIds.length;
        break;

      default:
        return NextResponse.json(
          { error: `Ação '${action}' não suportada` },
          { status: 400 }
        );
    }

    // ✅ INVALIDAR CACHE DE ALERTAS
    const { mlCache } = await import("@/lib/cache");
    mlCache.invalidatePattern(`alerts:${accountId}:.*`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ALERTS_API] Erro ao processar ação:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erro ao processar ação",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 }
    );
  }
}