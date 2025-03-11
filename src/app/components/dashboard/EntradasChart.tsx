"use client";

import React, { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ArrowUpIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface EntradaData {
  periodo: string;
  quantidade: number;
  valor: number;
}

const EntradasChart = () => {
  const [period, setPeriod] = useState("semanal");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EntradaData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/dashboard/entradas?period=${period}`
        );

        if (!response.ok) {
          throw new Error("Falha ao obter dados de entradas");
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error("Erro ao carregar entradas:", err);
        setError("Não foi possível carregar os dados de entradas");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period]);

  // Calcular totais
  const totalValor = data.reduce((sum, item) => sum + item.valor, 0);
  const totalQuantidade = data.reduce((sum, item) => sum + item.quantidade, 0);

  // Calcular tendência (se está aumentando ou diminuindo)
  const getTendencia = () => {
    if (data.length < 2) return null;

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstHalfAvg =
      firstHalf.reduce((sum, item) => sum + item.valor, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, item) => sum + item.valor, 0) / secondHalf.length;

    return secondHalfAvg > firstHalfAvg;
  };

  const tendenciaPositiva = getTendencia();

  // Encontrar o período com maior entrada
  const periodoMaisEntrada =
    data.length > 0
      ? data.reduce(
          (max, item) => (item.valor > max.valor ? item : max),
          data[0]
        )
      : null;

  if (error) {
    return (
      <Card className="shadow-md border-orange-200 bg-orange-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-orange-600" />
            Erro ao Carregar Dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-orange-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-lg font-bold flex items-center">
              <ArrowUpIcon className="mr-2 h-5 w-5 text-green-600" />
              Entradas no Estoque
            </CardTitle>
            <CardDescription>
              Análise das entradas de produtos no seu estoque
            </CardDescription>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
              <SelectItem value="tres-meses">Trimestral</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-green-600">
                  Total de Entradas
                </p>
                <h3 className="text-2xl font-bold mt-1">
                  {totalQuantidade.toLocaleString("pt-BR")} itens
                </h3>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-600">Valor Total</p>
                <h3 className="text-2xl font-bold mt-1">
                  R${" "}
                  {totalValor.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </h3>
              </div>
            </div>

            <div className="h-52 flex items-center justify-center overflow-hidden">
              {data.length === 0 ? (
                <p className="text-gray-500 text-center">
                  Nenhum dado disponível para o período selecionado
                </p>
              ) : (
                <div className="w-full h-full">
                  <div className="flex justify-between items-end h-full">
                    {data.map((item, index) => (
                      <div
                        key={index}
                        className="flex flex-col items-center"
                        style={{ width: `${100 / data.length}%` }}
                      >
                        <div
                          className="bg-green-500 hover:bg-green-600 transition-colors w-4/5 rounded-t-md"
                          style={{
                            height: `${Math.max(
                              (item.valor /
                                Math.max(...data.map((d) => d.valor))) *
                                100,
                              5
                            )}%`,
                          }}
                          title={`R$ ${item.valor.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}`}
                        ></div>
                        <p
                          className="text-xs mt-1 truncate w-full text-center"
                          title={item.periodo}
                        >
                          {item.periodo}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center">
                {tendenciaPositiva !== null &&
                  (tendenciaPositiva ? (
                    <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-orange-500 mr-2" />
                  ))}
                <p className="text-sm text-gray-700">
                  {tendenciaPositiva !== null
                    ? tendenciaPositiva
                      ? "Tendência de aumento nas entradas"
                      : "Tendência de diminuição nas entradas"
                    : "Dados insuficientes para análise de tendência"}
                </p>
              </div>
              {periodoMaisEntrada && (
                <p className="text-sm mt-2 text-gray-700">
                  Maior volume de entrada:{" "}
                  <span className="font-medium">
                    {periodoMaisEntrada.periodo}
                  </span>{" "}
                  com{" "}
                  <span className="font-medium">
                    R${" "}
                    {periodoMaisEntrada.valor.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EntradasChart;
