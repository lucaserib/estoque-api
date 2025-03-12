"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, PiggyBank } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  CartesianGrid,
} from "recharts";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface FluxoFinanceiro {
  entradas: number;
  saidas: number;
  custoSaidas: number;
  variacaoSaidas: string;
}

interface ChartDataItem {
  date: string;
  entradas: number;
  saidas: number;
  custoSaidas: string;
}

const FluxoFinanceiroChart = () => {
  const [data, setData] = useState<FluxoFinanceiro | null>(null);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState("mensal");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const today = new Date();
        const startDate = new Date(today);
        const endDate = new Date(today);

        if (period === "semanal") {
          startDate.setDate(today.getDate() - 7);
        } else if (period === "mensal") {
          startDate.setMonth(today.getMonth() - 1);
        } else if (period === "anual") {
          startDate.setFullYear(today.getFullYear() - 1);
        }

        const query = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
        const response = await fetch(`/api/dashboard/fluxo-financeiro${query}`);
        const result = await response.json();

        setData(result);

        // Data for the trend chart - mock data for demonstration
        // In a real app, you would fetch this historical data from the API
        const mockHistoricalData: ChartDataItem[] = [];
        const daysInPeriod =
          period === "semanal" ? 7 : period === "mensal" ? 30 : 12;

        // Generate dates for the period
        for (let i = 0; i < daysInPeriod; i++) {
          const date = new Date(startDate);
          date.setDate(startDate.getDate() + i);

          // Generate realistic mock data with some randomness but following a trend
          const baseEntradas = result.entradas / daysInPeriod;
          const baseSaidas = result.saidas / daysInPeriod;

          mockHistoricalData.push({
            date:
              period === "anual"
                ? date.toLocaleDateString("pt-BR", { month: "short" })
                : date.toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                  }),
            entradas: Math.round(baseEntradas * (0.7 + Math.random() * 0.6)),
            saidas: Math.round(baseSaidas * (0.7 + Math.random() * 0.6)),
            custoSaidas: (
              baseSaidas *
              (0.7 + Math.random() * 0.6) *
              (result.custoSaidas / result.saidas)
            ).toFixed(2),
          });
        }

        setChartData(mockHistoricalData);
      } catch (error) {
        console.error("Erro ao buscar fluxo financeiro:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [period]);

  const formattedVariation = data
    ? Math.abs(parseFloat(data.variacaoSaidas)).toFixed(1)
    : "0";
  const isPositiveVariation = data
    ? parseFloat(data.variacaoSaidas) >= 0
    : false;

  // Formatter para o tooltip - corrigindo o erro de tipo
  const formatTooltipValue = (
    value: number | string | (number | string)[] | undefined
  ) => {
    if (typeof value === "number") {
      return value.toLocaleString("pt-BR") + " itens";
    }
    if (Array.isArray(value)) {
      return value.map((v) => v.toLocaleString("pt-BR")).join(", ") + " itens";
    }
    return value;
  };

  const formatTooltipCurrency = (
    value: number | string | (number | string)[] | undefined
  ) => {
    if (Array.isArray(value)) {
      return value
        .map((v) => "R$ " + parseFloat(String(v)).toLocaleString("pt-BR"))
        .join(", ");
    }
    if (value) {
      return "R$ " + parseFloat(String(value)).toLocaleString("pt-BR");
    }
    return value;
  };

  return (
    <Card className="shadow-md overflow-hidden h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">Fluxo Financeiro</CardTitle>
          <div className="flex space-x-1">
            <Button
              variant={period === "semanal" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("semanal")}
              className="h-8"
            >
              7D
            </Button>
            <Button
              variant={period === "mensal" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("mensal")}
              className="h-8"
            >
              30D
            </Button>
            <Button
              variant={period === "anual" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("anual")}
              className="h-8"
            >
              12M
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
        ) : data ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4 flex items-center space-x-4">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900 p-2">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Custo das Saídas
                  </p>
                  <p className="text-lg font-bold">
                    R${" "}
                    {parseFloat(data.custoSaidas.toString()).toLocaleString(
                      "pt-BR"
                    )}
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-4 flex items-center space-x-4">
                <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-2">
                  <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    Total de Saídas
                  </p>
                  <p className="text-lg font-bold">
                    {data.saidas.toLocaleString("pt-BR")} itens
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4 flex items-center space-x-4">
                <div className="rounded-full bg-gray-100 dark:bg-gray-700 p-2">
                  <PiggyBank className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="flex items-center space-x-1">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Variação
                    </p>
                    <p className="text-lg font-bold flex items-center">
                      {isPositiveVariation ? (
                        <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                      )}
                      <span
                        className={
                          isPositiveVariation
                            ? "text-green-500"
                            : "text-red-500"
                        }
                      >
                        {formattedVariation}%
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="quantidade">
              <TabsList className="mb-4">
                <TabsTrigger value="quantidade">Quantidade</TabsTrigger>
                <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
              </TabsList>

              <TabsContent value="quantidade" className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorEntradas"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3b82f6"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3b82f6"
                          stopOpacity={0.2}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorSaidas"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f97316"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#f97316"
                          stopOpacity={0.2}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={formatTooltipValue}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="entradas"
                      name="Entradas"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorEntradas)"
                    />
                    <Area
                      type="monotone"
                      dataKey="saidas"
                      name="Saídas"
                      stroke="#f97316"
                      fillOpacity={1}
                      fill="url(#colorSaidas)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="financeiro" className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorCusto"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.8}
                        />
                        <stop
                          offset="95%"
                          stopColor="#10b981"
                          stopOpacity={0.2}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={formatTooltipCurrency}
                      labelFormatter={(label) => `Data: ${label}`}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="custoSaidas"
                      name="Custo das Saídas"
                      stroke="#10b981"
                      fillOpacity={1}
                      fill="url(#colorCusto)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <p className="text-center text-gray-500">Nenhum dado encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default FluxoFinanceiroChart;
