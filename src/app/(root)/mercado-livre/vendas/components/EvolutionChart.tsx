"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBRLReais, formatNumberBR } from "@/lib/format";

export interface DailySalesPoint {
  date: string;
  revenue: number;
  items: number;
  orders: number;
}

type Metric = "revenue" | "items" | "orders";

const METRIC_LABELS: Record<Metric, string> = {
  revenue: "Receita",
  items: "Itens",
  orders: "Pedidos",
};

const MOVING_AVERAGE_WINDOW = 7;

const formatDay = (dateString: string): string =>
  new Date(`${dateString}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: DailySalesPoint & { movingAverage: number } }>;
}

const ChartTooltip = ({ active, label, payload }: ChartTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-medium">{formatDay(label ?? "")}</p>
      <p className="text-muted-foreground">
        Receita:{" "}
        <span className="text-foreground font-medium tabular-nums">
          {formatBRLReais(point.revenue)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Itens:{" "}
        <span className="text-foreground font-medium tabular-nums">
          {formatNumberBR(point.items)}
        </span>
      </p>
      <p className="text-muted-foreground">
        Pedidos:{" "}
        <span className="text-foreground font-medium tabular-nums">
          {formatNumberBR(point.orders)}
        </span>
      </p>
    </div>
  );
};

const EvolutionChart = ({ data }: { data: DailySalesPoint[] }) => {
  const [metric, setMetric] = useState<Metric>("revenue");

  const chartData = useMemo(() => {
    return data.map((point, index) => {
      const windowStart = Math.max(0, index - MOVING_AVERAGE_WINDOW + 1);
      const window = data.slice(windowStart, index + 1);
      const movingAverage =
        window.reduce((sum, p) => sum + p[metric], 0) / window.length;
      return { ...point, movingAverage };
    });
  }, [data, metric]);

  const formatAxisValue = (value: number): string =>
    metric === "revenue"
      ? value >= 1000
        ? `R$ ${(value / 1000).toLocaleString("pt-BR", {
            maximumFractionDigits: 1,
          })}k`
        : `R$ ${formatNumberBR(Math.round(value))}`
      : formatNumberBR(value);

  return (
    <Card className="rounded-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Evolução de Vendas
        </CardTitle>
        <Tabs value={metric} onValueChange={(value) => setMetric(value as Metric)}>
          <TabsList className="h-8">
            {(Object.keys(METRIC_LABELS) as Metric[]).map((key) => (
              <TabsTrigger key={key} value={key} className="text-xs h-6 px-2.5">
                {METRIC_LABELS[key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            Sem vendas no período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="4 4"
                vertical={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDay}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={formatAxisValue}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                width={64}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey={metric}
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="hsl(var(--primary))"
                fillOpacity={0.12}
              />
              <Line
                type="monotone"
                dataKey="movingAverage"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeOpacity={0.6}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          Linha tracejada: média móvel de {MOVING_AVERAGE_WINDOW} dias
        </p>
      </CardContent>
    </Card>
  );
};

export default EvolutionChart;
