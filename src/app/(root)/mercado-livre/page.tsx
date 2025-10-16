"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Store,
  Package,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Loader2,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Clock,
  BarChart3,
  AlertCircle,
  Users,
  Star,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import MercadoLivreAutoSync from "@/app/components/MercadoLivreAutoSync";
import MLDashboardMetrics from "@/app/components/MercadoLivre/MLDashboardMetrics";
import MLTopSellingProducts from "@/app/components/MercadoLivre/MLTopSellingProducts";
import MLRestockSuggestions from "@/app/components/MercadoLivre/MLRestockSuggestions";
import Link from "next/link";
import { exibirValorEmReais } from "@/utils/currency";
import type {
  MLAccount,
  DashboardMetrics,
  SalesAnalytics,
  RestockAnalytics,
} from "@/types/ml-analytics";

export default function MercadoLivrePage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<MLAccount[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [salesData, setSalesData] = useState<SalesAnalytics | null>(null);
  const [restockData, setRestockData] = useState<RestockAnalytics | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loadingSales, setLoadingSales] = useState(false);
  const [loadingRestock, setLoadingRestock] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(
    null
  );

  useEffect(() => {
    if (status === "authenticated") {
      loadAccounts();
    }
  }, [status]);

  // ✅ CORREÇÃO: Effect otimizado para configurar auto-refresh
  useEffect(() => {
    if (selectedAccount) {
      loadAllData();
    }
  }, [selectedAccount]);

  // ✅ CORREÇÃO: Effect separado para auto-refresh
  useEffect(() => {
    setupAutoRefresh();

    // Cleanup na desmontagem ou mudança de estado
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [autoRefreshEnabled, selectedAccount]); // ✅ DEPENDÊNCIAS CORRETAS

  const loadAllData = async () => {
    if (!selectedAccount) return;

    await Promise.all([loadMetrics(), loadSalesData(), loadRestockData()]);
    setLastUpdate(new Date());
  };

  // ✅ CORREÇÃO: Sistema de polling mais inteligente e eficiente
  const setupAutoRefresh = useCallback(() => {
    // Limpar interval anterior
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }

    if (autoRefreshEnabled && selectedAccount) {
      console.log("[AUTO_REFRESH] Configurando polling inteligente...");

      const interval = setInterval(async () => {
        try {
          console.log("[AUTO_REFRESH] Atualizando dados automaticamente...");
          await loadAllData();
          console.log("[AUTO_REFRESH] Dados atualizados com sucesso");
        } catch (error) {
          console.error(
            "[AUTO_REFRESH] Erro na atualização automática:",
            error
          );
          // Em caso de erro, continuar o polling mas com menos frequência
        }
      }, 120000); // ✅ OTIMIZAÇÃO: Refresh a cada 2 minutos (menos agressivo)

      setPollingInterval(interval);
    }
  }, [autoRefreshEnabled, selectedAccount, pollingInterval]);

  const toggleAutoRefresh = () => {
    const newState = !autoRefreshEnabled;
    setAutoRefreshEnabled(newState);

    console.log(`[AUTO_REFRESH] Toggle: ${newState ? "ON" : "OFF"}`);

    if (!newState && pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await fetch("/api/mercadolivre/auth?action=accounts", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao carregar contas");

      const accountsData = await response.json();

      // Fix: The API returns accounts directly, not wrapped in accounts property
      const accountsList = Array.isArray(accountsData)
        ? accountsData
        : accountsData.accounts || [];

      // Extract basic account info from the detailed response
      const formattedAccounts = accountsList.map(
        (acc: {
          id: string;
          nickname: string;
          siteId: string;
          isActive: boolean;
        }) => ({
          id: acc.id,
          nickname: acc.nickname,
          siteId: acc.siteId,
          isActive: acc.isActive,
        })
      );

      setAccounts(formattedAccounts);

      // Select first active account
      const activeAccount = formattedAccounts.find(
        (acc: MLAccount) => acc.isActive
      );
      if (activeAccount) {
        setSelectedAccount(activeAccount.id);
      }
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar contas do Mercado Livre");
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    if (!selectedAccount) return;

    try {
      const response = await fetch(
        `/api/mercadolivre/dashboard/metrics?accountId=${selectedAccount}`
      );
      if (!response.ok) throw new Error("Erro ao carregar métricas");

      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao carregar métricas do dashboard");
    }
  };

  const loadSalesData = async () => {
    if (!selectedAccount) return;

    setLoadingSales(true);
    try {
      // Tentar primeiro a API detalhada, fallback para a simples
      let response = await fetch(
        `/api/mercadolivre/analytics/sales-detailed?accountId=${selectedAccount}&period=30`
      );

      if (!response.ok) {
        console.warn("API detalhada indisponível, usando API simples");
        response = await fetch(
          `/api/mercadolivre/analytics/sales?accountId=${selectedAccount}&period=30`
        );
      }

      if (!response.ok) {
        console.warn("Erro ao carregar dados de vendas");
        return;
      }

      const data = await response.json();

      // Adaptar dados se vieram da API detalhada
      if (data.topProducts) {
        setSalesData({
          period: data.period,
          summary: {
            totalSales: data.summary.totalItemsSold,
            totalRevenue: data.summary.totalRevenue,
            averageTicket: data.summary.averageOrderValue,
            revenueGrowth: 0, // Não calculado na API detalhada
            totalOrders: data.summary.relevantOrders || 0,
          },
          topSellingProducts: data.topProducts
            .slice(0, 5)
            .map(
              (product: {
                itemId: string;
                title: string;
                totalQuantitySold: number;
                totalRevenue: number;
                totalOrders: number;
                averagePrice: number;
                originalPrice: number;
                discountPercentage: number;
              }) => ({
                itemId: product.itemId,
                title: product.title,
                quantity: product.totalQuantitySold,
                revenue: product.totalRevenue,
                orders: product.totalOrders,
                averagePrice: product.averagePrice,
                originalPrice: product.originalPrice,
                discountPercentage: product.discountPercentage,
              })
            ),
          salesChart: data.salesChart,
          categoryBreakdown: [],
          recentOrders: [],
        });
      } else {
        setSalesData(data);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de vendas:", error);
    } finally {
      setLoadingSales(false);
    }
  };

  const loadRestockData = async () => {
    if (!selectedAccount) return;

    setLoadingRestock(true);
    try {
      const response = await fetch(
        `/api/mercadolivre/analytics/restock?accountId=${selectedAccount}&period=30`
      );
      if (!response.ok) {
        console.warn("Erro ao carregar sugestões de reposição");
        return;
      }

      const data = await response.json();
      setRestockData(data);
    } catch (error) {
      console.error("Erro ao carregar sugestões de reposição:", error);
    } finally {
      setLoadingRestock(false);
    }
  };

  const handleSync = async () => {
    if (!selectedAccount) return;

    setSyncing(true);
    try {
      const response = await fetch("/api/mercadolivre/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accountId: selectedAccount,
          syncType: "products",
        }),
      });

      if (!response.ok) throw new Error("Erro na sincronização");

      const result = await response.json();
      toast.success(
        `Sincronização concluída! ${
          result.syncedCount || 0
        } produtos atualizados`
      );
      // Atualizar dados imediatamente após sync
      await loadAllData();
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro na sincronização");
    } finally {
      setSyncing(false);
    }
  };

  const handleAutoSync = async (syncAll: boolean = false) => {
    if (!selectedAccount) return;

    setSyncing(true);
    try {
      const response = await fetch("/api/mercadolivre/sync/auto-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ accountId: selectedAccount, syncAll }),
      });

      if (!response.ok) throw new Error("Erro na sincronização automática");

      const result = await response.json();

      if (result.success) {
        const message = syncAll
          ? `Sincronização completa: ${result.updatedItems} produtos atualizados de ${result.totalProcessed} verificados`
          : `Sincronização inteligente: ${result.updatedItems} produtos atualizados de ${result.totalProcessed} verificados`;

        toast.success(message);

        if (result.errors && result.errors.length > 0) {
          toast.warning(
            `${result.errors.length} produto(s) com erro na sincronização`
          );
        }
      } else {
        toast.error("Erro na sincronização automática");
      }

      // Atualizar dados imediatamente após sync automático
      await loadAllData();
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro na sincronização automática de estoque");
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    try {
      const response = await fetch("/api/mercadolivre/auth?action=connect", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Erro ao gerar URL de conexão");

      const data = await response.json();
      window.location.href = data.authUrl;
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao conectar conta do Mercado Livre");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto p-6">
        <Header title="Mercado Livre" subtitle="Gestão integrada de vendas" />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Header title="Mercado Livre" subtitle="Gestão integrada de vendas" />
        <Card>
          <CardContent className="p-8 text-center">
            <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">
              Conecte sua conta do Mercado Livre
            </h3>
            <p className="text-muted-foreground mb-6">
              Para começar a gerenciar seus produtos e vendas, conecte sua conta
              do Mercado Livre.
            </p>
            <Button onClick={handleConnect}>
              <Store className="h-4 w-4 mr-2" />
              Conectar Mercado Livre
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentAccount = accounts.find((acc) => acc.id === selectedAccount);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Header
        title="Mercado Livre"
        subtitle={`Gestão integrada de vendas${
          currentAccount ? ` - ${currentAccount.nickname}` : ""
        }`}
      />

      {/* Controles de Atualização e Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAllData()}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>

            <Button
              variant={autoRefreshEnabled ? "default" : "outline"}
              size="sm"
              onClick={toggleAutoRefresh}
            >
              <Clock className="h-4 w-4 mr-2" />
              {autoRefreshEnabled ? "Auto On" : "Auto Off"}
            </Button>
          </div>

          {lastUpdate && (
            <div className="text-sm text-muted-foreground">
              Última atualização: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              autoRefreshEnabled ? "bg-green-500" : "bg-gray-400"
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {autoRefreshEnabled ? "Dados em tempo real" : "Atualização manual"}
          </span>
        </div>
      </div>

      {/* Warning se houver problemas */}
      {metrics?.warning && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {metrics?.warning} - Algumas funcionalidades podem estar limitadas.
          </AlertDescription>
        </Alert>
      )}

      {/* ✅ NOVO: Componente de Métricas Refatorado */}
      {metrics && <MLDashboardMetrics metrics={metrics} />}

      {/* ✅ NOVO: Grid de Componentes Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produtos Mais Vendidos */}
        {salesData && <MLTopSellingProducts salesData={salesData} />}

        {/* Sugestões de Reposição */}
        {restockData && <MLRestockSuggestions restockData={restockData} />}
      </div>

      {/* Métricas Legadas (temporário para comparação) */}
      {false && metrics && (
        <>
          {/* Row 1: Vendas e Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Vendas Hoje</p>
                    <p className="text-2xl font-bold text-green-600">
                      {metrics.todaySales}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metrics.weekSales} na semana
                    </p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Receita Semanal
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {exibirValorEmReais(metrics.totalRevenue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ticket: {exibirValorEmReais(metrics.averageTicket)}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-blue-600" />
                    {metrics.salesGrowth === "positive" && (
                      <TrendingUp className="h-4 w-4 text-green-500 ml-1" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pedidos Pendentes
                    </p>
                    <p className="text-2xl font-bold text-orange-600">
                      {metrics.pendingOrders}
                    </p>
                    {metrics.pendingOrders > 0 && (
                      <p className="text-xs text-orange-600">Requer atenção</p>
                    )}
                  </div>
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Produtos Ativos
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {metrics.activeProducts}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      de {metrics.totalProducts} total
                    </p>
                  </div>
                  <Package className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Estoque e Alertas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Estoque Baixo
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      {metrics.lowStockProducts}
                    </p>
                    {metrics.lowStockProducts > 0 && (
                      <p className="text-xs text-red-600">Precisa reposição</p>
                    )}
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Sugestões Reposição
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {metrics.needsRestockProducts}
                    </p>
                    {metrics.needsRestockProducts > 0 && (
                      <p className="text-xs text-purple-600">
                        Produtos prioritários
                      </p>
                    )}
                  </div>
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Produtos Pausados
                    </p>
                    <p className="text-2xl font-bold text-orange-600">
                      {metrics.pausedProducts}
                    </p>
                    {metrics.pausedProducts > 0 && (
                      <p className="text-xs text-orange-600">
                        Reativar para vender
                      </p>
                    )}
                  </div>
                  <AlertCircle className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm text-muted-foreground">
                        Saúde dos Produtos
                      </p>
                      {/* ✅ MELHORIA: Tooltip explicativo */}
                      <div className="group relative">
                        <AlertCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          Produtos ativos, com estoque adequado e sem problemas
                        </div>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-blue-600">
                      {metrics.productHealth.healthPercentage}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metrics.productHealth.healthy} de{" "}
                      {metrics.productHealth.total} saudáveis
                    </p>
                    <Progress
                      value={metrics.productHealth.healthPercentage}
                      className="h-2 mt-1"
                    />
                    {/* ✅ NOVO: Detalhamento rápido */}
                    <div className="mt-2 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-green-600">✓ Ativos:</span>
                        <span>{metrics.activeProducts}</span>
                      </div>
                      {metrics.pausedProducts > 0 && (
                        <div className="flex justify-between">
                          <span className="text-orange-600">⏸ Pausados:</span>
                          <span>{metrics.pausedProducts}</span>
                        </div>
                      )}
                      {metrics.lowStockProducts > 0 && (
                        <div className="flex justify-between">
                          <span className="text-red-600">⚠ Estoque baixo:</span>
                          <span>{metrics.lowStockProducts}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Star className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Fim das métricas legadas */}

      {/* ✅ REMOVIDO: Produtos Mais Vendidos (agora no componente MLTopSellingProducts) */}
      {false && salesData && salesData.topSellingProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Produtos Mais Vendidos (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salesData.topSellingProducts
                .slice(0, 5)
                .map((product, index) => (
                  <div
                    key={product.itemId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="min-w-[24px] h-6 justify-center"
                      >
                        {index + 1}
                      </Badge>
                      <div>
                        <p className="font-medium text-sm line-clamp-2 max-w-md">
                          {product.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.quantity} vendidos
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">
                        {exibirValorEmReais(product.revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">receita</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ✅ REMOVIDO: Sugestões de Reposição (agora no componente MLRestockSuggestions) */}
      {false && restockData && restockData.summary.needsAttention > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Sugestões de Reposição
              <Badge variant="destructive" className="ml-2">
                {restockData.summary.needsAttention}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {restockData.summary.recommendations.map((rec, index) => (
              <Alert key={index} className="mb-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{rec}</AlertDescription>
              </Alert>
            ))}

            <div className="space-y-3 mt-4">
              {restockData.suggestions
                .filter(
                  (s) => s.priority === "critical" || s.priority === "high"
                )
                .slice(0, 5)
                .map((suggestion) => (
                  <div
                    key={suggestion.sku}
                    className={`p-3 rounded-lg border ${
                      suggestion.priority === "critical"
                        ? "border-red-200 bg-red-50"
                        : "border-orange-200 bg-orange-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              suggestion.priority === "critical"
                                ? "destructive"
                                : "default"
                            }
                            className="text-xs"
                          >
                            {suggestion.priority.toUpperCase()}
                          </Badge>
                          <p className="font-medium text-sm">
                            {suggestion.productName}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          SKU: {suggestion.sku} | Estoque ML:{" "}
                          {suggestion.currentMLStock}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          {suggestion.reasons.join(" • ")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">
                          Sugestão: {suggestion.suggestedRestock}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Velocidade: {suggestion.salesVelocity.toFixed(1)}/dia
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {restockData.suggestions.length > 5 && (
              <div className="mt-4 text-center">
                <Link href="/mercado-livre/produtos">
                  <Button variant="outline" size="sm">
                    Ver Todos os Produtos
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button
            onClick={handleSync}
            disabled={syncing}
            variant={metrics?.needsSync ? "default" : "outline"}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {syncing ? "Sincronizando..." : "Sincronizar Produtos"}
          </Button>

          <Button
            onClick={() => handleAutoSync(false)}
            disabled={syncing}
            variant="outline"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Sync Inteligente
          </Button>

          <Button
            onClick={() => handleAutoSync(true)}
            disabled={syncing}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync Estoque Completo
          </Button>

          <Link href="/mercado-livre/produtos">
            <Button variant="outline">
              <Package className="h-4 w-4 mr-2" />
              Gerenciar Produtos
            </Button>
          </Link>

          <Link href="/mercado-livre/vendas">
            <Button variant="outline">
              <BarChart3 className="h-4 w-4 mr-2" />
              Análise de Vendas
            </Button>
          </Link>

          {currentAccount && (
            <Button
              variant="outline"
              onClick={() =>
                window.open(
                  `https://www.mercadolivre.com.br/perfil/${currentAccount.nickname}`,
                  "_blank"
                )
              }
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir no ML
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Status da Sincronização */}
      {metrics?.lastSync && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Última sincronização:{" "}
            {new Date(metrics.lastSync).toLocaleString("pt-BR")}
          </AlertDescription>
        </Alert>
      )}

      {/* Alerta se precisa sincronizar */}
      {metrics?.needsSync && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Alguns produtos precisam ser sincronizados. Clique em "Sincronizar
            Produtos" para atualizar.
          </AlertDescription>
        </Alert>
      )}

      {/* Sincronização Automática */}
      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Sincronização Automática
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MercadoLivreAutoSync accountId={selectedAccount} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
