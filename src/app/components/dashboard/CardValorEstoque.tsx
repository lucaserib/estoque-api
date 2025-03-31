"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, TrendingUp, AlertCircle } from "lucide-react";
import { exibirValorEmReais } from "@/utils/currency";

interface ValorEstoqueData {
  valorTotal: number; // Valor em centavos
  quantidadeTotal: number;
  valorMedio?: number; // Valor em centavos
}

interface CardValorEstoqueProps {
  data?: ValorEstoqueData;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const CardValorEstoque = ({
  data = { valorTotal: 0, quantidadeTotal: 0, valorMedio: 0 },
  loading = false,
  error = null,
  onRetry,
}: CardValorEstoqueProps) => {
  // Calcular valor médio por item (em centavos)
  const valorMedio =
    data.quantidadeTotal > 0
      ? Math.round(data.valorTotal / data.quantidadeTotal)
      : 0;

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
          <button
            onClick={onRetry}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Tentar novamente
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold flex items-center">
          <TrendingUp className="mr-2 h-5 w-5 text-blue-600" />
          Valor do Estoque
        </CardTitle>
        <CardDescription>Análise do valor atual do seu estoque</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-blue-600">Valor Total</p>
                <h3 className="text-2xl font-bold mt-1">
                  {exibirValorEmReais(data.valorTotal)}
                </h3>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-green-600">Quantidade</p>
                <h3 className="text-2xl font-bold mt-1">
                  {data.quantidadeTotal.toLocaleString("pt-BR")} itens
                </h3>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-600">
                Valor Médio por Item
              </p>
              <h3 className="text-2xl font-bold mt-1">
                {valorMedio ? exibirValorEmReais(valorMedio) : "R$ 0,00"}
              </h3>
              <p className="text-xs text-gray-500 mt-2">
                Representa o custo médio por item no seu estoque
              </p>
            </div>

            <div className="flex items-center text-sm text-gray-500 mt-2">
              <BarChart className="h-4 w-4 mr-1 text-blue-500" />
              Atualizado em{" "}
              {new Date().toLocaleDateString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CardValorEstoque;
