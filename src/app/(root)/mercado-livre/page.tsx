"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

  useEffect(() => {
    if (selectedAccount) {
      loadAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount]);

  useEffect(() => {
    setupAutoRefresh();

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshEnabled, selectedAccount]); // ✅ DEPENDÊNCIAS CORRETAS

  const loadAllData = async () => {
    if (!selectedAccount) return;

    await Promise.all([loadMetrics(), loadSalesData(), loadRestockData()]);
    setLastUpdate(new Date());
  };

  const setupAutoRefresh = useCallback(() => {
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
        }
      }, 120000); // ✅ OTIMIZAÇÃO: Refresh a cada 2 minutos (menos agressivo)

      setPollingInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const accountsList = Array.isArray(accountsData)
        ? accountsData
        : accountsData.accounts || [];

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
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        <Header title="Mercado Livre" subtitle="Gestão integrada de vendas" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[118px] rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
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
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <Header
        title="Mercado Livre"
        subtitle={`Gestão integrada de vendas${
          currentAccount ? ` — ${currentAccount.nickname}` : ""
        }${
          lastUpdate
            ? ` · atualizado às ${lastUpdate.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}`
            : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => loadAllData()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            variant={autoRefreshEnabled ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={toggleAutoRefresh}
          >
            <Clock className="h-4 w-4 mr-2" />
            {autoRefreshEnabled ? "Auto ativado" : "Auto desativado"}
          </Button>
        </div>
      </Header>

      {metrics?.warning && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {metrics?.warning} - Algumas funcionalidades podem estar limitadas.
          </AlertDescription>
        </Alert>
      )}

      {metrics && <MLDashboardMetrics metrics={metrics} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {salesData && <MLTopSellingProducts salesData={salesData} />}

        {restockData && <MLRestockSuggestions restockData={restockData} />}
      </div>

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

      {metrics?.lastSync && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Última sincronização:{" "}
            {new Date(metrics.lastSync).toLocaleString("pt-BR")}
          </AlertDescription>
        </Alert>
      )}

      {metrics?.needsSync && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Alguns produtos precisam ser sincronizados. Clique em "Sincronizar
            Produtos" para atualizar.
          </AlertDescription>
        </Alert>
      )}

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
