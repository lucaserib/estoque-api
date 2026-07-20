"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  ShoppingCart,
  Package,
  RefreshCw,
  Loader2,
  Target,
  Users,
  Wallet,
  CalendarClock,
  XCircle,
  PackageX,
  Download,
  ExternalLink,
  FileText,
  Calendar as CalendarIcon,
} from "lucide-react";
import Header from "@/app/components/Header";
import KpiCard from "@/components/dashboard/KpiCard";
import EvolutionChart from "./components/EvolutionChart";
import TopProductsChart from "./components/TopProductsChart";
import SalesHeatmap from "./components/SalesHeatmap";
import {
  formatBRLReais,
  formatNumberBR,
  formatPercent,
} from "@/lib/format";
import type { MLAccount } from "@/types/ml-analytics";

interface TopProduct {
  mlItemId: string;
  productName: string;
  sku: string;
  totalSales: number;
  totalRevenue: number;
  averagePrice: number;
  salesCount: number;
  saleFees: number;
  custoMedio?: number | null;
  estimatedProfit?: number | null;
}

interface SalesAnalyticsData {
  period: { startDate: string; endDate: string; days: number };
  summary: {
    totalOrders: number;
    totalItems: number;
    totalRevenue: number;
    totalProductRevenue: number;
    totalShippingRevenue: number;
    averageTicket: number;
    averageItemsPerOrder: number;
    totalSaleFees: number;
    netRevenue: number;
  };
  trends: {
    dailyRevenue: Array<{
      date: string;
      revenue: number;
      orders: number;
      items: number;
    }>;
    topProducts: TopProduct[];
    salesByDayBlock: Array<{ day: number; block: number; count: number }>;
  };
  cancelled: {
    totalCancelledOrders: number;
    cancellationRate: number;
  };
  skusWithoutSales?: {
    count: number;
    items: Array<{ mlItemId: string; title: string }>;
  };
  comparison?: {
    previousPeriod: {
      totalRevenue: number;
      totalOrders: number;
      totalItems: number;
      averageTicket: number;
    };
    growth: {
      revenueGrowth: number;
      ordersGrowth: number;
      itemsGrowth: number;
      ticketGrowth: number;
    };
  };
}

type ViewMode = "overview" | "products" | "reports";

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
];

const calcularProjecaoDoMes = (
  dailyRevenue: Array<{ date: string; revenue: number }>
): number | null => {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const monthDays = dailyRevenue.filter((day) =>
    day.date.startsWith(monthPrefix)
  );
  if (monthDays.length === 0) return null;

  const accumulated = monthDays.reduce((sum, day) => sum + day.revenue, 0);
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0
  ).getDate();

  return (accumulated / daysElapsed) * daysInMonth;
};

const KpiSkeletonRow = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <Skeleton key={index} className="h-[118px] rounded-xl" />
    ))}
  </div>
);

export default function MercadoLivreVendasPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<MLAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [salesData, setSalesData] = useState<SalesAnalyticsData | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [customDateRange, setCustomDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>({});
  const [loadingSales, setLoadingSales] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");

  useEffect(() => {
    if (status !== "authenticated") return;

    const loadAccounts = async () => {
      try {
        const response = await fetch("/api/mercadolivre/auth?action=accounts");
        if (!response.ok) throw new Error("Erro ao carregar contas");

        const accountsData = await response.json();
        const accountsList: MLAccount[] = Array.isArray(accountsData)
          ? accountsData
          : accountsData.accounts || [];

        setAccounts(accountsList);

        const activeAccount = accountsList.find((acc) => acc.isActive);
        if (activeAccount) {
          setSelectedAccount(activeAccount.id);
        }
      } catch {
        toast.error("Erro ao carregar contas do Mercado Livre");
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
  }, [status]);

  const loadSalesData = useCallback(async () => {
    if (!selectedAccount) return;

    setLoadingSales(true);
    try {
      let url = `/api/mercadolivre/analytics/sales-complete?accountId=${selectedAccount}&period=${selectedPeriod}&comparison=true`;

      if (customDateRange.from && customDateRange.to) {
        url += `&startDate=${customDateRange.from.toISOString()}&endDate=${customDateRange.to.toISOString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Erro ao carregar dados de vendas");
      }

      const payload = await response.json();
      setSalesData(payload.data as SalesAnalyticsData);
    } catch {
      toast.error("Erro ao carregar dados de vendas");
    } finally {
      setLoadingSales(false);
    }
  }, [selectedAccount, selectedPeriod, customDateRange]);

  useEffect(() => {
    loadSalesData();
  }, [loadSalesData]);

  const projecaoDoMes = useMemo(
    () =>
      salesData ? calcularProjecaoDoMes(salesData.trends.dailyRevenue) : null,
    [salesData]
  );

  const exportToCSV = () => {
    if (!salesData) return;

    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csvRows = [
      [
        "Produto",
        "SKU",
        "Unidades",
        "Receita",
        "Pedidos",
        "Preço Médio",
        "Tarifas ML",
        "Lucro Estimado",
      ],
      ...salesData.trends.topProducts.map((product) => [
        escapeCell(product.productName),
        escapeCell(product.sku),
        product.totalSales.toString(),
        product.totalRevenue.toFixed(2),
        product.salesCount.toString(),
        product.averagePrice.toFixed(2),
        product.saleFees.toFixed(2),
        product.estimatedProfit !== null &&
        product.estimatedProfit !== undefined
          ? product.estimatedProfit.toFixed(2)
          : "",
      ]),
    ];

    const csvContent = "﻿" + csvRows.map((row) => row.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vendas-ml-${selectedPeriod}dias-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
    toast.success("Relatório CSV exportado");
  };

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        <Header
          title="Análise de Vendas"
          subtitle="Mercado Livre — relatórios e indicadores"
        />
        <KpiSkeletonRow />
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="container mx-auto max-w-7xl p-6">
        <Header
          title="Análise de Vendas"
          subtitle="Mercado Livre — relatórios e indicadores"
        />
        <Card className="rounded-xl">
          <CardContent className="p-10 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nenhuma conta conectada
            </h3>
            <p className="text-muted-foreground mb-4">
              Conecte sua conta do Mercado Livre para acessar os relatórios de
              vendas.
            </p>
            <Link href="/configuracoes">
              <Button>Conectar Mercado Livre</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentAccount = accounts.find((acc) => acc.id === selectedAccount);
  const growth = salesData?.comparison?.growth;
  const periodLabel = customDateRange.from
    ? "período anterior equivalente"
    : `${selectedPeriod}d anteriores`;

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <Header
        title="Análise de Vendas"
        subtitle={`Mercado Livre${
          currentAccount ? ` — ${currentAccount.nickname}` : ""
        }`}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Select
            value={selectedPeriod}
            onValueChange={(value) => {
              setSelectedPeriod(value);
              setCustomDateRange({});
            }}
          >
            <SelectTrigger className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9",
                  !customDateRange.from && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {customDateRange.from && customDateRange.to
                  ? `${format(customDateRange.from, "dd/MM")} – ${format(
                      customDateRange.to,
                      "dd/MM"
                    )}`
                  : "Personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={
                  customDateRange.from
                    ? { from: customDateRange.from, to: customDateRange.to }
                    : undefined
                }
                onSelect={(range) =>
                  setCustomDateRange({
                    from: range?.from,
                    to: range?.to,
                  })
                }
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Select
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
          >
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Visão Geral</SelectItem>
              <SelectItem value="products">Produtos</SelectItem>
              <SelectItem value="reports">Relatórios</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={loadSalesData}
            disabled={loadingSales}
          >
            <RefreshCw
              className={cn("h-4 w-4", loadingSales && "animate-spin")}
            />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={exportToCSV}
            disabled={!salesData}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </Header>

      {loadingSales && !salesData && (
        <>
          <KpiSkeletonRow />
          <KpiSkeletonRow />
          <Skeleton className="h-[340px] rounded-xl" />
        </>
      )}

      {salesData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Receita Total"
              value={formatBRLReais(salesData.summary.totalRevenue)}
              icon={DollarSign}
              delta={growth?.revenueGrowth}
              deltaLabel={`vs ${periodLabel}`}
              tooltip="Soma de produtos e frete dos pedidos pagos no período."
            />
            <KpiCard
              label="Receita Líquida Estimada"
              value={formatBRLReais(salesData.summary.netRevenue)}
              icon={Wallet}
              subtitle={`Tarifas ML: ${formatBRLReais(
                salesData.summary.totalSaleFees
              )}`}
              tooltip="Receita de produtos menos as tarifas de venda do Mercado Livre (sale_fee). Não inclui custos de frete pagos pelo seller."
            />
            <KpiCard
              label="Itens Vendidos"
              value={formatNumberBR(salesData.summary.totalItems)}
              icon={ShoppingCart}
              delta={growth?.itemsGrowth}
              deltaLabel={`vs ${periodLabel}`}
              tooltip="Unidades vendidas em pedidos válidos do período."
            />
            <KpiCard
              label="Pedidos"
              value={formatNumberBR(salesData.summary.totalOrders)}
              icon={Users}
              delta={growth?.ordersGrowth}
              deltaLabel={`vs ${periodLabel}`}
              subtitle={`${salesData.summary.averageItemsPerOrder.toFixed(
                1
              )} itens/pedido`}
              tooltip="Pedidos pagos, enviados ou entregues no período."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Ticket Médio"
              value={formatBRLReais(salesData.summary.averageTicket)}
              icon={Target}
              delta={growth?.ticketGrowth}
              deltaLabel={`vs ${periodLabel}`}
              tooltip="Receita total dividida pelo número de pedidos."
            />
            <KpiCard
              label="Projeção do Mês"
              value={
                projecaoDoMes !== null ? formatBRLReais(projecaoDoMes) : "—"
              }
              icon={CalendarClock}
              tooltip="Receita acumulada no mês corrente dividida pelos dias decorridos e multiplicada pelos dias do mês. Requer vendas do mês dentro do período selecionado."
            />
            <KpiCard
              label="Taxa de Cancelamento"
              value={formatPercent(salesData.cancelled.cancellationRate)}
              icon={XCircle}
              subtitle={`${formatNumberBR(
                salesData.cancelled.totalCancelledOrders
              )} pedidos cancelados`}
              tooltip="Pedidos cancelados divididos pelo total de pedidos (válidos + cancelados) do período."
            />
            <KpiCard
              label="SKUs sem Venda"
              value={formatNumberBR(salesData.skusWithoutSales?.count ?? 0)}
              icon={PackageX}
              subtitle="Ver lista na visão Produtos"
              tooltip="Anúncios ativos no Mercado Livre sem nenhuma venda no período selecionado."
            />
          </div>

          {viewMode === "overview" && (
            <>
              <EvolutionChart data={salesData.trends.dailyRevenue} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TopProductsChart
                  products={salesData.trends.topProducts.map((product) => ({
                    itemId: product.mlItemId,
                    title: product.productName,
                    revenue: product.totalRevenue,
                    quantity: product.totalSales,
                  }))}
                  totalRevenue={salesData.summary.totalProductRevenue}
                />
                <SalesHeatmap data={salesData.trends.salesByDayBlock} />
              </div>
            </>
          )}

          {viewMode === "products" && (
            <>
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Produtos Vendidos no Período
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {salesData.trends.topProducts.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma venda no período selecionado
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">
                              Unidades
                            </TableHead>
                            <TableHead className="text-right">
                              Receita
                            </TableHead>
                            <TableHead className="text-right">
                              Preço Médio
                            </TableHead>
                            <TableHead className="text-right">
                              Lucro Estimado
                            </TableHead>
                            <TableHead className="w-40">
                              Participação
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesData.trends.topProducts.map(
                            (product, index) => {
                              const participation =
                                salesData.summary.totalProductRevenue > 0
                                  ? (product.totalRevenue /
                                      salesData.summary.totalProductRevenue) *
                                    100
                                  : 0;

                              return (
                                <TableRow key={product.mlItemId}>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Badge
                                        variant={
                                          index < 3 ? "default" : "secondary"
                                        }
                                        className="rounded-full"
                                      >
                                        #{index + 1}
                                      </Badge>
                                      <div className="min-w-0">
                                        <p className="font-medium truncate max-w-xs">
                                          {product.productName}
                                        </p>
                                        <a
                                          href={`https://mercadolivre.com.br/p/${product.mlItemId}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs text-info hover:underline flex items-center gap-1"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Ver no ML
                                        </a>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatNumberBR(product.totalSales)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums font-medium">
                                    {formatBRLReais(product.totalRevenue)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatBRLReais(product.averagePrice)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {product.estimatedProfit !== null &&
                                    product.estimatedProfit !== undefined ? (
                                      <span
                                        className={
                                          product.estimatedProfit >= 0
                                            ? "text-success font-medium"
                                            : "text-destructive font-medium"
                                        }
                                      >
                                        {formatBRLReais(
                                          product.estimatedProfit
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        sem custo
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                                        <div
                                          className="h-full rounded-full bg-primary"
                                          style={{
                                            width: `${Math.min(
                                              participation,
                                              100
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                                        {formatPercent(participation)}
                                      </span>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            }
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {salesData.skusWithoutSales &&
                salesData.skusWithoutSales.count > 0 && (
                  <Card className="rounded-xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <PackageX className="h-4 w-4 text-muted-foreground" />
                        SKUs sem Venda no Período (
                        {formatNumberBR(salesData.skusWithoutSales.count)})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5">
                        {salesData.skusWithoutSales.items.map((item) => (
                          <li
                            key={item.mlItemId}
                            className="text-sm text-muted-foreground truncate"
                          >
                            {item.title}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
            </>
          )}

          {viewMode === "reports" && (
            <Card className="rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Relatórios
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <button
                  onClick={exportToCSV}
                  className="w-full sm:w-auto flex items-center gap-3 p-4 border rounded-xl hover:shadow-md transition-shadow duration-200 text-left"
                >
                  <Download className="h-8 w-8 text-primary" />
                  <div>
                    <div className="font-semibold">Exportar CSV</div>
                    <div className="text-sm text-muted-foreground">
                      Produtos vendidos, receita, tarifas e lucro estimado
                    </div>
                  </div>
                </button>

                <div className="rounded-xl border p-4">
                  <h4 className="font-semibold mb-3">Resumo do Período</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <ul className="space-y-1.5 text-muted-foreground">
                      <li>
                        Itens vendidos:{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {formatNumberBR(salesData.summary.totalItems)}
                        </span>
                      </li>
                      <li>
                        Receita total:{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {formatBRLReais(salesData.summary.totalRevenue)}
                        </span>
                      </li>
                      <li>
                        Receita líquida estimada:{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {formatBRLReais(salesData.summary.netRevenue)}
                        </span>
                      </li>
                      <li>
                        Pedidos:{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {formatNumberBR(salesData.summary.totalOrders)}
                        </span>
                      </li>
                    </ul>
                    <ul className="space-y-1.5 text-muted-foreground">
                      <li>
                        Ticket médio:{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {formatBRLReais(salesData.summary.averageTicket)}
                        </span>
                      </li>
                      <li>
                        Itens por pedido:{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {salesData.summary.averageItemsPerOrder.toFixed(1)}
                        </span>
                      </li>
                      <li>
                        Taxa de cancelamento:{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {formatPercent(
                            salesData.cancelled.cancellationRate
                          )}
                        </span>
                      </li>
                      <li>
                        Produtos com venda:{" "}
                        <span className="text-foreground font-medium tabular-nums">
                          {formatNumberBR(
                            salesData.trends.topProducts.length
                          )}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loadingSales && salesData && (
        <div className="fixed bottom-6 right-6 rounded-full bg-card border shadow-md p-2.5">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
