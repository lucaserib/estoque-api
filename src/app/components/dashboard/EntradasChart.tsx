"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EntradasChart = () => {
  const [data, setData] = useState<
    { periodo: string; quantidade: number; valor: number }[]
  >([]);
  const [period, setPeriod] = useState("hoje");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/dashboard/entradas?period=${period}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Erro ao buscar entradas", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="flex justify-between">
        <CardTitle className="text-lg font-bold">Entradas no Estoque</CardTitle>
        <Select value={period} onValueChange={(value) => setPeriod(value)}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="semanal">Semanal</SelectItem>
            <SelectItem value="mensal">Mensal</SelectItem>
            <SelectItem value="tres-meses">Últimos 3 meses</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-md" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data}
              margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip
                formatter={(value) => `R$ ${value.toLocaleString("pt-BR")}`}
              />
              <Bar dataKey="quantidade" fill="#34D399" name="Quantidade" />
              <Bar dataKey="valor" fill="#2563EB" name="Valor Total" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default EntradasChart;
