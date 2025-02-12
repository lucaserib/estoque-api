"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "../ui/button";

interface FluxoFinanceiro {
  entradas: number;
  saidas: number;
  custoSaidas: number;
  variacaoSaidas: string;
}

const CardFluxoFinanceiro = () => {
  const [data, setData] = useState<FluxoFinanceiro | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [period, setPeriod] = useState("mensal");

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      let startDate = new Date(today);
      let endDate = new Date(today);

      if (period === "semanal") {
        startDate.setDate(today.getDate() - 7);
      } else if (period === "mensal") {
        startDate.setMonth(today.getMonth() - 1);
      }

      const query = `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      const response = await fetch(`/api/dashboard/fluxo-financeiro${query}`);
      const result = await response.json();

      setData(result);

      // Criando dados para o gráfico
      setChartData([
        {
          date: "Período Anterior",
          value:
            result.variacaoSaidas < 0
              ? result.saidas * 1.2
              : result.saidas * 0.8,
        },
        { date: "Atual", value: result.saidas },
      ]);
    } catch (error) {
      console.error("Erro ao buscar fluxo financeiro:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md p-4">
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-md" />
      ) : data ? (
        <>
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Fluxo Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="text-gray-500 text-sm">Saídas no Período</p>
                <p className="text-2xl font-bold">{data.saidas} itens</p>
              </div>
              <div className="flex items-center">
                {parseFloat(data.variacaoSaidas) >= 0 ? (
                  <TrendingUp className="text-green-500 w-6 h-6" />
                ) : (
                  <TrendingDown className="text-red-500 w-6 h-6" />
                )}
                <p
                  className={`ml-2 font-semibold ${
                    parseFloat(data.variacaoSaidas) >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {Math.abs(parseFloat(data.variacaoSaidas))}%
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-gray-500 text-sm">Custo Total das Saídas</p>
              <p className="text-xl font-semibold">
                R${" "}
                {parseFloat(data.custoSaidas.toString()).toLocaleString(
                  "pt-BR"
                )}
              </p>
            </div>

            {/* Gráfico de Tendência */}
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart data={chartData}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip formatter={(value: number) => [`${value} itens`]} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366F1"
                  fill="#C7D2FE"
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Botões de filtro */}
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => setPeriod("semanal")}
                variant={period === "semanal" ? "default" : "outline"}
              >
                Semanal
              </Button>
              <Button
                onClick={() => setPeriod("mensal")}
                variant={period === "mensal" ? "default" : "outline"}
              >
                Mensal
              </Button>
            </div>
          </CardContent>
        </>
      ) : (
        <p className="text-center text-gray-500">Nenhum dado encontrado.</p>
      )}
    </Card>
  );
};

export default CardFluxoFinanceiro;
