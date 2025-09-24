"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  AreaChart,
} from "recharts";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Calendar,
  Package,
  Users,
  BarChart3,
  RefreshCw,
  Clock,
  ExternalLink,
  Loader2,
  Target,
  Activity,
  Zap,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  Info,
  Download,
  GitCompare,
  FileText,
  Eye,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import Header from "@/app/components/Header";
import Link from "next/link";
import { formatarReal, exibirValorEmReais } from "@/utils/currency";
import type { MLAccount, SalesAnalytics } from "@/types/ml-analytics";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82ca9d", "#ffc658"];

interface SalesDataComplete extends SalesAnalytics {
  insights?: string[];
  performanceIndicators?: {
    conversionRate: number;
    averageItemsPerOrder: number;
    dailyAverageRevenue: number;
    topProductContribution: number;
    priceVariationCoeff: number;
  };
}

interface PeriodComparison {
  current: SalesDataComplete;
  previous: SalesDataComplete;
  growth: {
    revenueGrowth: number;
    ordersGrowth: number;
    itemsGrowth: number;
    ticketGrowth: number;
  };
}

export default function MercadoLivreVendasPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<MLAccount[]>([]);
  const [salesData, setSalesData] = useState<SalesDataComplete | null>(null);
  const [comparisonData, setComparisonData] = useState<PeriodComparison | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [customDateRange, setCustomDateRange] = useState<{
    start: Date | null;
    end: Date | null;
  }>({ start: null, end: null });
  const [loadingSales, setLoadingSales] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"overview" | "products" | "trends" | "compare" | "reports">("overview");
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      loadAccounts();
    }
  }, [status]);

  useEffect(() => {
    if (selectedAccount) {
      loadSalesData();
      if (autoRefreshEnabled) {
        const interval = setInterval(() => {
          loadSalesData();
        }, 120000);
        return () => clearInterval(interval);
      }
    }
  }, [selectedAccount, selectedPeriod, autoRefreshEnabled, showComparison, customDateRange]);

  const loadAccounts = async () => {
    try {
      const response = await fetch("/api/mercadolivre/auth?action=accounts");
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

  const loadSalesData = async () => {
    if (!selectedAccount) return;

    setLoadingSales(true);
    try {
      let url = `/api/mercadolivre/analytics/sales-complete?accountId=${selectedAccount}&period=${selectedPeriod}`;

      if (showComparison) {
        url += `&comparison=true`;
      }

      // Se há data customizada, usar ela
      if (customDateRange.start && customDateRange.end) {
        url += `&startDate=${customDateRange.start.toISOString()}&endDate=${customDateRange.end.toISOString()}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Erro ao carregar dados de vendas");
      }

      const data = await response.json();

      // Processar dados com a nova estrutura da API
      const processedData: SalesDataComplete = {
        period: data.data.period,
        summary: {
          totalSales: data.data.summary.totalItems || 0,
          totalRevenue: data.data.summary.totalRevenue || 0,
          // ✅ CORREÇÃO: Ticket médio já calculado corretamente na API
          averageTicket: data.data.summary.averageTicket || 0,
          revenueGrowth: data.data.comparison?.growth?.revenueGrowth || 0,
          totalOrders: data.data.summary.totalOrders || 0,
        },
        topSellingProducts: (data.data.trends.topProducts || [])
          .slice(0, 20)
          .map((product: {
            mlItemId: string;
            productName: string;
            totalSales: number;
            totalRevenue: number;
            salesCount: number;
            averagePrice: number;
            originalPrice?: number;
            priceVariationPercentage?: number;
          }) => ({
            itemId: product.mlItemId,
            title: product.productName,
            quantity: product.totalSales,
            revenue: product.totalRevenue,
            orders: product.salesCount,
            averagePrice: product.averagePrice,
            originalPrice: product.originalPrice || product.averagePrice,
            discountPercentage: product.priceVariationPercentage || 0,
          })),
        salesChart: (data.data.trends.dailyRevenue || []).map((day: {
          date: string;
          revenue: number;
          orders: number;
          items: number;
        }) => ({
          date: day.date,
          items: day.items || 0,
          revenue: day.revenue || 0,
          orders: day.orders || 0,
        })),
        categoryBreakdown: [],
        recentOrders: [],
        insights: data.insights || [],
        performanceIndicators: {
          conversionRate: data.data.summary.totalOrders > 0
            ? (data.data.summary.totalItems / data.data.summary.totalOrders) * 100
            : 0,
          averageItemsPerOrder: data.data.summary.averageItemsPerOrder || 0,
          dailyAverageRevenue: data.data.period.days > 0
            ? data.data.summary.totalRevenue / data.data.period.days
            : 0,
          topProductContribution: data.data.trends.topProducts && data.data.trends.topProducts.length > 0 && data.data.summary.totalRevenue > 0
            ? (data.data.trends.topProducts[0].totalRevenue / data.data.summary.totalRevenue) * 100
            : 0,
          priceVariationCoeff: calculatePriceVariation(data.data.trends.topProducts || []),
        }
      };

      setSalesData(processedData);
      setLastUpdate(new Date());

      // Processar dados de comparação se estiverem disponíveis
      if (data.data?.comparison) {
        const processedPreviousData: SalesDataComplete = {
          period: {
            startDate: "",
            endDate: "",
            days: data.data.period.days,
          },
          summary: {
            totalSales: data.data.comparison.previousPeriod.totalItems || 0,
            totalRevenue: data.data.comparison.previousPeriod.totalRevenue || 0,
            averageTicket: data.data.comparison.previousPeriod.averageTicket || 0,
            revenueGrowth: 0,
            totalOrders: data.data.comparison.previousPeriod.totalOrders || 0,
          },
          topSellingProducts: [],
          salesChart: [],
          categoryBreakdown: [],
          recentOrders: [],
        };

        setComparisonData({
          current: processedData,
          previous: processedPreviousData,
          growth: data.data.comparison.growth
        });
      } else {
        // Limpar dados de comparação se não foi solicitada
        setComparisonData(null);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de vendas:", error);
      toast.error("Erro ao carregar dados de vendas");
    } finally {
      setLoadingSales(false);
    }
  };


  const calculatePriceVariation = (products: { averagePrice?: number }[]) => {
    if (products.length === 0) return 0;
    const prices = products.map(p => p.averagePrice || 0).filter(p => p > 0);
    if (prices.length === 0) return 0;
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length;
    return (Math.sqrt(variance) / mean) * 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-500" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return "text-green-600";
    if (value < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const exportToCSV = () => {
    if (!salesData) return;

    const csvData = [
      ["Produto", "Vendas", "Receita", "Pedidos", "Preço Médio"],
      ...salesData.topSellingProducts.map(product => [
        product.title,
        product.quantity.toString(),
        product.revenue.toString(),
        product.orders.toString(),
        product.averagePrice.toString()
      ])
    ];

    const csvContent = csvData.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-ml-${selectedPeriod}dias-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto p-6">
        <Header
          title="Análise de Vendas - Mercado Livre"
          subtitle="Relatórios completos e insights avançados"
        />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Header
          title="Análise de Vendas - Mercado Livre"
          subtitle="Relatórios completos e insights avançados"
        />
        <Card>
          <CardContent className="p-6 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhuma conta conectada
            </h3>
            <p className="text-muted-foreground mb-4">
              Conecte sua conta do Mercado Livre para acessar relatórios avançados de vendas.
            </p>
            <Link href="/mercado-livre">
              <Button>Conectar Mercado Livre</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentAccount = accounts.find((acc) => acc.id === selectedAccount);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Header
        title="Análise de Vendas - Mercado Livre"
        subtitle={`Relatórios completos e insights avançados${
          currentAccount ? ` - ${currentAccount.nickname}` : ""
        }`}
      />

      {/* Controles Avançados */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border border-blue-200">
          <div className="flex flex-wrap items-center gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={viewMode} onValueChange={(value: string) => setViewMode(value as typeof viewMode)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overview">Visão Geral</SelectItem>
                <SelectItem value="products">Produtos</SelectItem>
                <SelectItem value="trends">Tendências</SelectItem>
                <SelectItem value="compare">Comparar</SelectItem>
                <SelectItem value="reports">Relatórios</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={loadSalesData}
              disabled={loadingSales}
              className="bg-white/50"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loadingSales ? "animate-spin" : ""}`}
              />
              Atualizar
            </Button>

            <Button
              variant={showComparison ? "default" : "outline"}
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
              className={showComparison ? "" : "bg-white/50"}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Comparar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              disabled={!salesData}
              className="bg-white/50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  autoRefreshEnabled
                    ? "bg-green-500 animate-pulse"
                    : "bg-gray-400"
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {autoRefreshEnabled
                  ? "Dados em tempo real"
                  : "Atualização manual"}
              </span>
            </div>

            {lastUpdate && (
              <div className="text-sm text-muted-foreground">
                Última atualização: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Insights Rápidos */}
        {salesData && salesData.insights && salesData.insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesData.insights.slice(0, 3).map((insight, index) => (
              <Alert key={index} className="border-blue-200 bg-blue-50/50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  {insight}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </div>

      {/* KPIs Principais com Comparação */}
      {salesData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Itens Vendidos
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {salesData.summary.totalSales.toLocaleString("pt-BR")}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {(salesData.summary.totalSales / parseInt(selectedPeriod)).toFixed(1)} por dia
                      </span>
                      {showComparison && comparisonData && (
                        <div className="flex items-center gap-1 ml-2">
                          {getTrendIcon(comparisonData.growth.itemsGrowth)}
                          <span className={`text-xs font-medium ${getTrendColor(comparisonData.growth.itemsGrowth)}`}>
                            {comparisonData.growth.itemsGrowth > 0 ? "+" : ""}{comparisonData.growth.itemsGrowth.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Receita Total
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatarReal(salesData.summary.totalRevenue)}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {formatarReal(salesData.performanceIndicators?.dailyAverageRevenue || 0)}/dia
                      </span>
                      {showComparison && comparisonData && (
                        <div className="flex items-center gap-1 ml-2">
                          {getTrendIcon(comparisonData.growth.revenueGrowth)}
                          <span className={`text-xs font-medium ${getTrendColor(comparisonData.growth.revenueGrowth)}`}>
                            {comparisonData.growth.revenueGrowth > 0 ? "+" : ""}{comparisonData.growth.revenueGrowth.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <DollarSign className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Ticket Médio
                    </p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatarReal(salesData.summary.averageTicket)}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">Por item vendido</span>
                      {showComparison && comparisonData && (
                        <div className="flex items-center gap-1 ml-2">
                          {getTrendIcon(comparisonData.growth.ticketGrowth)}
                          <span className={`text-xs font-medium ${getTrendColor(comparisonData.growth.ticketGrowth)}`}>
                            {comparisonData.growth.ticketGrowth > 0 ? "+" : ""}{comparisonData.growth.ticketGrowth.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Target className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      Pedidos
                    </p>
                    <p className="text-2xl font-bold text-orange-600">
                      {salesData.summary.totalOrders.toLocaleString("pt-BR")}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {salesData.performanceIndicators?.averageItemsPerOrder.toFixed(1)} itens/pedido
                      </span>
                      {showComparison && comparisonData && (
                        <div className="flex items-center gap-1 ml-2">
                          {getTrendIcon(comparisonData.growth.ordersGrowth)}
                          <span className={`text-xs font-medium ${getTrendColor(comparisonData.growth.ordersGrowth)}`}>
                            {comparisonData.growth.ordersGrowth > 0 ? "+" : ""}{comparisonData.growth.ordersGrowth.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Users className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Indicadores de Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Indicadores de Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {(salesData.performanceIndicators?.conversionRate || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Taxa de Conversão</div>
                  <Progress
                    value={Math.min(salesData.performanceIndicators?.conversionRate || 0, 100)}
                    className="h-2 mt-2"
                  />
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(salesData.performanceIndicators?.topProductContribution || 0).toFixed(1)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Top Produto (Receita)</div>
                  <Progress
                    value={salesData.performanceIndicators?.topProductContribution || 0}
                    className="h-2 mt-2"
                  />
                </div>

                <div className="text-center">
                  <div className={`text-2xl font-bold ${getPerformanceColor(100 - (salesData.performanceIndicators?.priceVariationCoeff || 0))}`}>
                    {(100 - (salesData.performanceIndicators?.priceVariationCoeff || 0)).toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Consistência de Preços</div>
                  <Progress
                    value={Math.max(0, 100 - (salesData.performanceIndicators?.priceVariationCoeff || 0))}
                    className="h-2 mt-2"
                  />
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {(salesData.performanceIndicators?.averageItemsPerOrder || 0).toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">Itens por Pedido</div>
                  <Progress
                    value={Math.min((salesData.performanceIndicators?.averageItemsPerOrder || 0) * 20, 100)}
                    className="h-2 mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conteúdo baseado no modo de visualização */}
          {viewMode === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Evolução */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Evolução de Vendas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={salesData.salesChart}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={formatDate} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip
                        labelFormatter={(value) => formatDate(value as string)}
                        formatter={(value: number, name: string) => [
                          name === "revenue" ? formatarReal(value) : value,
                          name === "items" ? "Itens" : name === "revenue" ? "Receita" : "Pedidos",
                        ]}
                      />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="items"
                        fill="#10b981"
                        name="Itens"
                        opacity={0.8}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="revenue"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        name="Receita"
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="orders"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        name="Pedidos"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top 5 Produtos - Gráfico */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Top 5 Produtos por Receita
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={salesData.topSellingProducts.slice(0, 5).map(product => ({
                          name: product.title.length > 30
                            ? product.title.substring(0, 30) + "..."
                            : product.title,
                          value: product.revenue,
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({value}) => formatarReal(value)}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {salesData.topSellingProducts.slice(0, 5).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatarReal(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {viewMode === "products" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Análise Detalhada de Produtos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-center">Vendas</TableHead>
                      <TableHead className="text-center">Receita</TableHead>
                      <TableHead className="text-center">Pedidos</TableHead>
                      <TableHead className="text-center">Preço Médio</TableHead>
                      <TableHead className="text-center">Participação</TableHead>
                      <TableHead className="text-center">Performance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesData.topSellingProducts.map((product, index) => {
                      const participation = salesData.summary.totalRevenue > 0
                        ? (product.revenue / salesData.summary.totalRevenue) * 100
                        : 0;
                      const itemsPerOrder = product.orders > 0 ? product.quantity / product.orders : 0;

                      return (
                        <TableRow key={product.itemId}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={index < 3 ? "default" : "secondary"}>
                                #{index + 1}
                              </Badge>
                              <div>
                                <p className="font-medium truncate max-w-xs">
                                  {product.title}
                                </p>
                                <Link
                                  href={`https://mercadolivre.com.br/p/${product.itemId}`}
                                  target="_blank"
                                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Ver no ML
                                </Link>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-semibold">{product.quantity}</div>
                            <div className="text-xs text-muted-foreground">
                              {salesData.summary.totalSales > 0
                                ? ((product.quantity / salesData.summary.totalSales) * 100).toFixed(1)
                                : 0}%
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-semibold text-green-600">
                              {formatarReal(product.revenue)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {participation.toFixed(1)}%
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div>{product.orders}</div>
                            <div className="text-xs text-muted-foreground">
                              {itemsPerOrder.toFixed(1)} itens/pedido
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="font-medium">
                              {formatarReal(product.averagePrice)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Progress value={participation} className="h-2" />
                            <div className="text-xs text-muted-foreground mt-1">
                              {participation.toFixed(1)}%
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {index < 3 && (
                              <Badge variant="default" className="bg-green-500">
                                <Star className="h-3 w-3 mr-1" />
                                Top
                              </Badge>
                            )}
                            {participation > 5 && (
                              <Badge variant="secondary" className="bg-blue-500 text-white">
                                <Zap className="h-3 w-3 mr-1" />
                                Alta
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {viewMode === "compare" && comparisonData && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitCompare className="h-5 w-5" />
                    Comparação de Períodos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-semibold">Vendas</div>
                      <div className="text-2xl font-bold text-green-600">
                        {comparisonData.current.summary.totalSales}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        vs {comparisonData.previous.summary.totalSales}
                      </div>
                      <div className={`flex items-center justify-center gap-1 mt-2 ${getTrendColor(comparisonData.growth.itemsGrowth)}`}>
                        {getTrendIcon(comparisonData.growth.itemsGrowth)}
                        <span className="font-medium">
                          {comparisonData.growth.itemsGrowth > 0 ? "+" : ""}{comparisonData.growth.itemsGrowth.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-semibold">Receita</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatarReal(comparisonData.current.summary.totalRevenue)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        vs {formatarReal(comparisonData.previous.summary.totalRevenue)}
                      </div>
                      <div className={`flex items-center justify-center gap-1 mt-2 ${getTrendColor(comparisonData.growth.revenueGrowth)}`}>
                        {getTrendIcon(comparisonData.growth.revenueGrowth)}
                        <span className="font-medium">
                          {comparisonData.growth.revenueGrowth > 0 ? "+" : ""}{comparisonData.growth.revenueGrowth.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-semibold">Pedidos</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {comparisonData.current.summary.totalOrders}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        vs {comparisonData.previous.summary.totalOrders}
                      </div>
                      <div className={`flex items-center justify-center gap-1 mt-2 ${getTrendColor(comparisonData.growth.ordersGrowth)}`}>
                        {getTrendIcon(comparisonData.growth.ordersGrowth)}
                        <span className="font-medium">
                          {comparisonData.growth.ordersGrowth > 0 ? "+" : ""}{comparisonData.growth.ordersGrowth.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-lg font-semibold">Ticket Médio</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {formatarReal(comparisonData.current.summary.averageTicket)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        vs {formatarReal(comparisonData.previous.summary.averageTicket)}
                      </div>
                      <div className={`flex items-center justify-center gap-1 mt-2 ${getTrendColor(comparisonData.growth.ticketGrowth)}`}>
                        {getTrendIcon(comparisonData.growth.ticketGrowth)}
                        <span className="font-medium">
                          {comparisonData.growth.ticketGrowth > 0 ? "+" : ""}{comparisonData.growth.ticketGrowth.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {viewMode === "reports" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Relatórios Executivos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer" onClick={exportToCSV}>
                      <div className="flex items-center gap-3">
                        <Download className="h-8 w-8 text-blue-600" />
                        <div>
                          <div className="font-semibold">Exportar CSV</div>
                          <div className="text-sm text-muted-foreground">
                            Dados detalhados dos produtos
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-green-600" />
                        <div>
                          <div className="font-semibold">Relatório de Performance</div>
                          <div className="text-sm text-muted-foreground">
                            Análise completa de KPIs
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-purple-600" />
                        <div>
                          <div className="font-semibold">Relatório Mensal</div>
                          <div className="text-sm text-muted-foreground">
                            Resumo consolidado
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-2">Resumo do Período</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="font-medium">Métricas Principais:</div>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          <li>• Total de itens vendidos: {salesData.summary.totalSales.toLocaleString("pt-BR")}</li>
                          <li>• Receita total: {formatarReal(salesData.summary.totalRevenue)}</li>
                          <li>• Total de pedidos: {salesData.summary.totalOrders.toLocaleString("pt-BR")}</li>
                          <li>• Ticket médio: {formatarReal(salesData.summary.averageTicket)}</li>
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium">Performance:</div>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          <li>• Taxa de conversão: {(salesData.performanceIndicators?.conversionRate || 0).toFixed(1)}%</li>
                          <li>• Itens por pedido: {(salesData.performanceIndicators?.averageItemsPerOrder || 0).toFixed(1)}</li>
                          <li>• Receita diária: {formatarReal(salesData.performanceIndicators?.dailyAverageRevenue || 0)}</li>
                          <li>• Produtos únicos: {salesData.topSellingProducts.length}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Loading State */}
      {loadingSales && !salesData && (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">
              Carregando análise completa de vendas...
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}