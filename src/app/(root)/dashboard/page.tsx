"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  ShoppingCart,
  DollarSign,
  PackageSearch,
  Boxes,
  ArrowRight,
  Store,
  TrendingDown,
} from "lucide-react";
import Header from "@/app/components/Header";
import KpiCard from "@/components/dashboard/KpiCard";
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
      const sales = salesRes.ok ? await salesRes.json() : null;
      const restock = restockRes.ok ? await restockRes.json() : null;

      setHomeData({
        todaySales: metrics?.todaySales ?? 0,
        periodRevenue: sales?.data?.summary?.totalRevenue ?? 0,
        revenueGrowth: sales?.data?.comparison?.growth?.revenueGrowth ?? null,
        dailyRevenue: sales?.data?.trends?.dailyRevenue ?? [],
        restockCount: restock?.summary?.needsAttention ?? 0,
        restockTop: (restock?.suggestions ?? []).slice(0, 5),
      });
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
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        <Header title="Dashboard" subtitle="Visão geral do seu negócio" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[118px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[340px] rounded-xl" />
      </div>
    );
  }

  if (!mlAccount) {
    return (
      <div className="container mx-auto max-w-7xl p-6 space-y-6">
        <Header title="Dashboard" subtitle="Visão geral do seu negócio" />

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
            <Link href="/configuracoes">
              <Button>
                Conectar Mercado Livre
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

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-6">
      <Header
        title="Dashboard"
        subtitle={`Visão geral — ${mlAccount.nickname}`}
      >
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
      </Header>

      {loadingData && !homeData ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[118px] rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-[340px] rounded-xl" />
        </>
      ) : (
        homeData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Vendas Hoje"
                value={formatNumberBR(homeData.todaySales)}
                icon={ShoppingCart}
                tooltip="Pedidos do Mercado Livre criados hoje."
              />
              <KpiCard
                label={`Receita ML (${period}d)`}
                value={formatBRLReais(homeData.periodRevenue)}
                icon={DollarSign}
                delta={homeData.revenueGrowth}
                deltaLabel={`vs ${period}d anteriores`}
                tooltip="Receita de pedidos pagos no Mercado Livre no período, incluindo frete."
              />
              <KpiCard
                label="SKUs a Repor"
                value={formatNumberBR(homeData.restockCount)}
                icon={PackageSearch}
                href="/reposicao"
                subtitle="Ver plano de reposição"
                tooltip="Anúncios com estoque projetado para acabar, segundo a velocidade de vendas."
              />
              <KpiCard
                label="Valor do Estoque Local"
                value={stockValue !== null ? formatBRL(stockValue) : "—"}
                icon={Boxes}
                tooltip="Soma de quantidade × custo médio de todos os produtos em estoque."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <EvolutionChart data={homeData.dailyRevenue} />
              </div>

              <Card className="rounded-xl">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    Reposição Urgente
                  </CardTitle>
                  <Link
                    href="/reposicao"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Ver todos
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}
