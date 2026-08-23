"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
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
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Package,
  RefreshCw,
  Loader2,
  Download,
  ExternalLink,
  Calendar as CalendarIcon,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HeroMetric } from "@/components/ui/hero-metric";
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip";
import { SectionCard } from "@/components/ui/section-card";
import PartialDataAlert from "@/components/dashboard/PartialDataAlert";
import EvolutionChart, {
  EvolutionChartTabs,
  type EvolutionMetric,
} from "./components/EvolutionChart";
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

const MetricsSkeleton = () => (
  <>
    <Skeleton className="h-[124px] rounded-md" />
    <Skeleton className="h-16 rounded-md" />
    <Skeleton className="h-12 rounded-md" />
  </>
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
  const [salesDataPartial, setSalesDataPartial] = useState(false);
  const [evolutionMetric, setEvolutionMetric] = useState<EvolutionMetric>("revenue");

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

      if (response.status === 503) {
        const body = await response.json().catch(() => null);
        if (body?.code === "ML_DADOS_PARCIAIS") {
          setSalesDataPartial(true);
          return;
        }
      }

      if (!response.ok) {
        throw new Error("Erro ao carregar dados de vendas");
      }

      const payload = await response.json();
      setSalesDataPartial(false);
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
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <PageHeader
          title="Análise de Vendas"
          subtitle="Mercado Livre — relatórios e indicadores"
        />
        <MetricsSkeleton />
        <Skeleton className="h-[340px] rounded-md" />
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="container mx-auto max-w-[1400px] p-6">
        <PageHeader
          title="Análise de Vendas"
          subtitle="Mercado Livre — relatórios e indicadores"
        />
        <Card className="mt-8 rounded-xl">
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

  const primaryStatItems: StatStripItem[] = salesData
    ? [
        {
          label: "Receita Líquida",
          value: formatBRLReais(salesData.summary.netRevenue),
        },
        {
          label: "Itens Vendidos",
          value: formatNumberBR(salesData.summary.totalItems),
          delta: growth?.itemsGrowth,
        },
        {
          label: "Pedidos",
          value: formatNumberBR(salesData.summary.totalOrders),
          delta: growth?.ordersGrowth,
        },
        {
          label: "Ticket Médio",
          value: formatBRLReais(salesData.summary.averageTicket),
          delta: growth?.ticketGrowth,
        },
      ]
    : [];

  const secondaryStatItems: StatStripItem[] = salesData
    ? [
        {
          label: "Projeção do Mês",
          value:
            projecaoDoMes !== null ? formatBRLReais(projecaoDoMes) : "—",
        },
        {
          label: "Taxa de Cancelamento",
          value: formatPercent(salesData.cancelled.cancellationRate),
        },
        {
          label: "SKUs sem Venda",
          value: formatNumberBR(salesData.skusWithoutSales?.count ?? 0),
        },
      ]
    : [];

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        title="Análise de Vendas"
        subtitle={`Mercado Livre${
          currentAccount ? ` — ${currentAccount.nickname}` : ""
        }`}
        actions={
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
        }
      />

      {salesDataPartial && (
        <PartialDataAlert onRetry={loadSalesData} retrying={loadingSales} />
      )}

      {loadingSales && !salesData && (
        <>
          <MetricsSkeleton />
          <Skeleton className="h-[340px] rounded-md" />
        </>
      )}

      {salesData && (
        <>
          <HeroMetric
            label="Receita Total"
            value={formatBRLReais(salesData.summary.totalRevenue)}
            delta={growth?.revenueGrowth}
            deltaLabel={`vs ${periodLabel}`}
            context="Soma de produtos e frete dos pedidos pagos no período."
          />

          <StatStrip items={primaryStatItems} />

          <StatStrip items={secondaryStatItems} size="sm" />

          {viewMode === "overview" && (
            <>
              <SectionCard
                title="Evolução de Vendas"
                actions={
                  <EvolutionChartTabs
                    value={evolutionMetric}
                    onChange={setEvolutionMetric}
                  />
                }
              >
                <EvolutionChart
                  data={salesData.trends.dailyRevenue}
                  metric={evolutionMetric}
                  bare
                />
              </SectionCard>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Top 5 Produtos por Receita">
                  <TopProductsChart
                    products={salesData.trends.topProducts.map((product) => ({
                      itemId: product.mlItemId,
                      title: product.productName,
                      revenue: product.totalRevenue,
                      quantity: product.totalSales,
                    }))}
                    totalRevenue={salesData.summary.totalProductRevenue}
                    bare
                  />
                </SectionCard>
                <SectionCard title="Vendas por Dia e Horário">
                  <SalesHeatmap data={salesData.trends.salesByDayBlock} bare />
                </SectionCard>
              </div>
            </>
          )}

          {viewMode === "products" && (
            <>
              <SectionCard
                title="Produtos Vendidos no Período"
                contentClassName={
                  salesData.trends.topProducts.length === 0 ? undefined : "p-0"
                }
              >
                {salesData.trends.topProducts.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma venda no período selecionado
                  </div>
                ) : (
                  <DataTable>
                    <DataTableHeader>
                      <DataTableRow className="hover:bg-transparent">
                        <DataTableHead className="pl-5">Produto</DataTableHead>
                        <DataTableHead className="text-right">
                          Unidades
                        </DataTableHead>
                        <DataTableHead className="text-right">
                          Receita
                        </DataTableHead>
                        <DataTableHead className="text-right">
                          Preço Médio
                        </DataTableHead>
                        <DataTableHead className="text-right">
                          Lucro Estimado
                        </DataTableHead>
                        <DataTableHead className="w-40 pr-5">
                          Participação
                        </DataTableHead>
                      </DataTableRow>
                    </DataTableHeader>
                    <DataTableBody>
                      {salesData.trends.topProducts.map((product, index) => {
                        const participation =
                          salesData.summary.totalProductRevenue > 0
                            ? (product.totalRevenue /
                                salesData.summary.totalProductRevenue) *
                              100
                            : 0;

                        return (
                          <DataTableRow key={product.mlItemId}>
                            <DataTableCell className="pl-5">
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
                            </DataTableCell>
                            <DataTableCell numeric>
                              {formatNumberBR(product.totalSales)}
                            </DataTableCell>
                            <DataTableCell numeric emphasis>
                              {formatBRLReais(product.totalRevenue)}
                            </DataTableCell>
                            <DataTableCell numeric>
                              {formatBRLReais(product.averagePrice)}
                            </DataTableCell>
                            <DataTableCell numeric>
                              {product.estimatedProfit !== null &&
                              product.estimatedProfit !== undefined ? (
                                <span
                                  className={
                                    product.estimatedProfit >= 0
                                      ? "text-success font-medium"
                                      : "text-destructive font-medium"
                                  }
                                >
                                  {formatBRLReais(product.estimatedProfit)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">
                                  sem custo
                                </span>
                              )}
                            </DataTableCell>
                            <DataTableCell className="pr-5">
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
                            </DataTableCell>
                          </DataTableRow>
                        );
                      })}
                    </DataTableBody>
                  </DataTable>
                )}
              </SectionCard>

              {salesData.skusWithoutSales &&
                salesData.skusWithoutSales.count > 0 && (
                  <SectionCard
                    title={`SKUs sem Venda no Período (${formatNumberBR(
                      salesData.skusWithoutSales.count
                    )})`}
                  >
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
                  </SectionCard>
                )}
            </>
          )}

          {viewMode === "reports" && (
            <SectionCard title="Relatórios">
              <div className="space-y-6">
                <button
                  onClick={exportToCSV}
                  className="w-full sm:w-auto flex items-center gap-3 p-4 border border-metal rounded-md hover:bg-accent transition-colors duration-150 text-left"
                >
                  <Download className="h-8 w-8 text-primary" />
                  <div>
                    <div className="font-semibold">Exportar CSV</div>
                    <div className="text-sm text-muted-foreground">
                      Produtos vendidos, receita, tarifas e lucro estimado
                    </div>
                  </div>
                </button>

                <div className="rounded-md border border-metal p-4">
                  <h4 className="text-eyebrow mb-3">Resumo do Período</h4>
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
              </div>
            </SectionCard>
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
