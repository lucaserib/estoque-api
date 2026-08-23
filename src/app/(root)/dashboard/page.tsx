"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Boxes, Store } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HeroMetric } from "@/components/ui/hero-metric";
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip";
import { SectionCard } from "@/components/ui/section-card";
import KpiCard from "@/components/dashboard/KpiCard";
import PartialDataAlert from "@/components/dashboard/PartialDataAlert";
import EvolutionChart, {
  DailySalesPoint,
} from "@/app/(root)/mercado-livre/vendas/components/EvolutionChart";
import { formatBRL, formatBRLReais, formatNumberBR } from "@/lib/format";

interface MLAccountSummary {
  id: string;
  nickname: string;
  isActive: boolean;
}

interface RestockSuggestion {
  productId: string;
  productName: string;
  sku: string;
  priority: "critical" | "high" | "medium" | "low";
  daysUntilStockout: number;
  suggestedRestock: number;
  currentMLStock: number;
}

interface HomeData {
  todaySales: number;
  periodRevenue: number;
  revenueGrowth: number | null;
  itemsSold: number;
  dailyRevenue: DailySalesPoint[];
  restockCount: number;
  restockTop: RestockSuggestion[];
}

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "15", label: "15 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
];

const PRIORITY_STYLES: Record<RestockSuggestion["priority"], string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-warning/15 text-warning",
  medium: "bg-info/15 text-info",
  low: "bg-muted text-muted-foreground",
};

const PRIORITY_LABELS: Record<RestockSuggestion["priority"], string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

export default function DashboardPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [mlAccount, setMlAccount] = useState<MLAccountSummary | null>(null);
  const [period, setPeriod] = useState("30");
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [stockValue, setStockValue] = useState<number | null>(null);
  const [salesDataPartial, setSalesDataPartial] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const loadBase = async () => {
      try {
        const [accountsRes, stockRes] = await Promise.all([
          fetch("/api/mercadolivre/auth?action=accounts"),
          fetch("/api/dashboard/valor-estoque"),
        ]);

        if (accountsRes.ok) {
          const data = await accountsRes.json();
          const list: MLAccountSummary[] = Array.isArray(data)
            ? data
            : data.accounts || [];
          setMlAccount(list.find((acc) => acc.isActive) ?? null);
        }

        if (stockRes.ok) {
          const stockData = await stockRes.json();
          setStockValue(stockData.valorTotal ?? null);
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
      } finally {
        setLoading(false);
      }
    };

    loadBase();
  }, [status]);

  const loadHomeData = useCallback(async () => {
    if (!mlAccount) return;

    setLoadingData(true);
    try {
      const [metricsRes, salesRes, restockRes] = await Promise.all([
        fetch(`/api/mercadolivre/dashboard/metrics?accountId=${mlAccount.id}`),
        fetch(
          `/api/mercadolivre/analytics/sales-complete?accountId=${mlAccount.id}&period=${period}&comparison=true`
        ),
        fetch(
          `/api/mercadolivre/analytics/restock?accountId=${mlAccount.id}&period=30`
        ),
      ]);

      const metrics = metricsRes.ok ? await metricsRes.json() : null;
      const restock = restockRes.ok ? await restockRes.json() : null;

      if (salesRes.status === 503) {
        const body = await salesRes.json().catch(() => null);
        setSalesDataPartial(body?.code === "ML_DADOS_PARCIAIS");
      } else {
        setSalesDataPartial(false);
      }

      const sales = salesRes.ok ? await salesRes.json() : null;

      setHomeData((previous) => ({
        todaySales: metrics?.todaySales ?? 0,
        periodRevenue: sales?.data?.summary?.totalRevenue ?? previous?.periodRevenue ?? 0,
        revenueGrowth:
          sales?.data?.comparison?.growth?.revenueGrowth ??
          previous?.revenueGrowth ??
          null,
        itemsSold: sales?.data?.summary?.totalItems ?? previous?.itemsSold ?? 0,
        dailyRevenue: sales?.data?.trends?.dailyRevenue ?? previous?.dailyRevenue ?? [],
        restockCount: restock?.summary?.needsAttention ?? 0,
        restockTop: (restock?.suggestions ?? []).slice(0, 5),
      }));
    } catch (error) {
      console.error("Erro ao carregar dados do dashboard:", error);
    } finally {
      setLoadingData(false);
    }
  }, [mlAccount, period]);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <PageHeader title="Visão Geral" subtitle="Carregando seu negócio…" />
        <Skeleton className="h-[124px] rounded-md" />
        <Skeleton className="h-16 rounded-md" />
        <Skeleton className="h-[340px] rounded-md" />
      </div>
    );
  }

  if (!mlAccount) {
    return (
      <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
        <PageHeader title="Visão Geral" subtitle="Visão geral do seu negócio" />

        <Card className="rounded-xl">
          <CardContent className="p-10 text-center">
            <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Conecte o Mercado Livre
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Conecte sua conta para acompanhar vendas, receita e sugestões de
              reposição direto no painel.
            </p>
            <Link href="/onboarding">
              <Button>
                Começar configuração
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {stockValue !== null && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Valor do Estoque Local"
              value={formatBRL(stockValue)}
              icon={Boxes}
              tooltip="Soma de quantidade × custo médio de todos os produtos em estoque."
            />
          </div>
        )}
      </div>
    );
  }

  const statStripItems: StatStripItem[] = [
    { label: "Vendas hoje", value: formatNumberBR(homeData?.todaySales ?? 0) },
    { label: "Itens vendidos", value: formatNumberBR(homeData?.itemsSold ?? 0) },
    {
      label: "SKUs a repor",
      value: formatNumberBR(homeData?.restockCount ?? 0),
    },
    {
      label: "Valor do estoque local",
      value: stockValue !== null ? formatBRL(stockValue) : "—",
    },
  ];

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        title="Visão Geral"
        subtitle={mlAccount.nickname}
        actions={
          <Select value={period} onValueChange={setPeriod}>
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
        }
      />

      {loadingData && !homeData ? (
        <>
          <Skeleton className="h-[124px] rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-[340px] rounded-md" />
        </>
      ) : (
        homeData && (
          <>
            {salesDataPartial && (
              <PartialDataAlert
                onRetry={loadHomeData}
                retrying={loadingData}
              />
            )}

            <HeroMetric
              label={`Receita ML — ${period} dias`}
              value={formatBRLReais(homeData.periodRevenue)}
              delta={homeData.revenueGrowth}
              deltaLabel={`vs ${period}d anteriores`}
              context="Pedidos pagos no Mercado Livre no período, incluindo frete."
            />

            <StatStrip items={statStripItems} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SectionCard title="Evolução da receita" className="lg:col-span-2">
                <EvolutionChart data={homeData.dailyRevenue} bare />
              </SectionCard>

              <SectionCard
                title="Reposição urgente"
                actions={
                  <Link
                    href="/reposicao"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Ver todos
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              >
                {homeData.restockTop.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum produto precisa de reposição urgente
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {homeData.restockTop.map((item) => (
                      <li
                        key={item.productId || item.sku}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.daysUntilStockout <= 0
                              ? "Sem estoque"
                              : `~${Math.round(
                                  item.daysUntilStockout
                                )} dias de estoque`}
                            {" · "}repor {item.suggestedRestock} un.
                          </p>
                        </div>
                        <Badge
                          className={`rounded-full shrink-0 ${
                            PRIORITY_STYLES[item.priority]
                          }`}
                        >
                          {PRIORITY_LABELS[item.priority]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </>
        )
      )}
    </div>
  );
}
