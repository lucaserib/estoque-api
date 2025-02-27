"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FaBoxOpen } from "react-icons/fa";
import { Input } from "../ui/input";
import { Skeleton } from "@/components/ui/skeleton";

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

  // Executa fetchData quando o componente é montado
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-bold">
          Top 3 Produtos Mais Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="flex gap-4 mb-4">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Button onClick={fetchData}>Filtrar</Button>
        </div>

        {/* Skeleton Loader enquanto os dados carregam */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-10 w-full rounded-md bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-10 w-full rounded-md bg-gray-200 dark:bg-gray-700" />
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-3">
            {data.map((produto, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FaBoxOpen className="text-blue-500 text-xl" />
                  <div>
                    <p className="text-sm font-semibold">{produto.nome}</p>
                    <p className="text-xs text-gray-500">SKU: {produto.sku}</p>
                  </div>
                </div>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  Vendas: {produto.quantidade}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">Nenhum dado encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default TopProdutosList;
