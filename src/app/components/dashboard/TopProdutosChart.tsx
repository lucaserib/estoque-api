"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Calendar, Search } from "lucide-react";
import { Input } from "../ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface ProdutoTop {
  nome: string;
  sku: string;
  quantidade: number;
}

const TopProdutosList = () => {
  const [data, setData] = useState<ProdutoTop[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Usando useCallback para memoizar a função fetchData
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = `?startDate=${startDate || "2000-01-01"}&endDate=${
        endDate || new Date().toISOString()
      }`;
      const response = await fetch(`/api/dashboard/top-produtos${query}`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Erro ao buscar top produtos vendidos:", error);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!endDate) {
      const today = new Date();
      setEndDate(today.toISOString().split("T")[0]);
    }

    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
    }
  }, [endDate, startDate]);

  const getBadgeColor = (index: number) => {
    if (index === 0) return "bg-amber-500";
    if (index === 1) return "bg-gray-400";
    if (index === 2) return "bg-amber-700";
    return "bg-blue-500";
  };

  return (
    <Card className="shadow-md h-full overflow-hidden">
      <CardHeader className="flex items-start pb-2">
        <div className="flex justify-between items-center w-full">
          <CardTitle className="text-lg font-bold flex items-center">
            <Package className="h-5 w-5 mr-2 text-indigo-500" />
            Top 3 Produtos Mais Vendidos
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="relative">
            <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            onClick={fetchData}
            className="bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <Search className="h-4 w-4 mr-2" /> Filtrar
          </Button>
        </div>

        {/* Skeleton Loader enquanto os dados carregam */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-md bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-16 w-full rounded-md bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-16 w-full rounded-md bg-gray-200 dark:bg-gray-700" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-3">
            {data.map((produto, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${getBadgeColor(
                      index
                    )}`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{produto.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs py-0 px-2">
                        SKU: {produto.sku}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {produto.quantidade}
                  </p>
                  <p className="text-xs text-gray-500">unidades vendidas</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Package className="h-10 w-10 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">
              Nenhum dado de venda encontrado no período selecionado.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopProdutosList;
