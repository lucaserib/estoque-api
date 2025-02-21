"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingDown, TrendingUp } from "lucide-react";
import React, { useEffect, useState } from "react";

interface ValorEstoque {
  valorTotal: string;
  quantidadeTotal: number;
}

const CardValorEstoque = () => {
  const [data, setData] = useState<ValorEstoque | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/dashboard/valor-estoque`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Erro ao buscar valor do estoque:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-md p-4">
      {isLoading ? (
        <Skeleton className="h-10 w-full rounded-md bg-gray-200 dark:bg-gray-700" />
      ) : data ? (
        <>
          <CardHeader>
            <CardTitle className="text-lg font-bold">
              Valor total em estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="text-gray-500 text-sm">Custo Total Armazenado</p>
                <p className="text-2xl font-bold">
                  R$ {parseFloat(data.valorTotal).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            <p className="text-gray-500 text-sm">
              Quantidade Total de Produtos
            </p>
            <p className="text-xl font-semibold">
              {data.quantidadeTotal} itens
            </p>
          </CardContent>
        </>
      ) : (
        <p className="text-center text-gray-500">Nenhum dado encontrado</p>
      )}
    </Card>
  );
};

export default CardValorEstoque;
