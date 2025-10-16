"use client";

import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, CheckCircle, DollarSign } from "lucide-react";

interface ReplenishmentSummaryCardsProps {
  summary: {
    total: number;
    critico: number;
    atencao: number;
    ok: number;
    custoTotalCritico: number;
    custoTotalAtencao: number;
    custoTotalGeral: number;
  };
}

export function ReplenishmentSummaryCards({ summary }: ReplenishmentSummaryCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total de Produtos */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Produtos Alerta
              </p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {summary.total}
              </h3>
            </div>
            <div className="h-12 w-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Críticos */}
      <Card className="border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Críticos
              </p>
              <h3 className="text-3xl font-bold text-red-900 dark:text-red-300 mt-2">
                {summary.critico}
              </h3>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                {formatCurrency(summary.custoTotalCritico)}
              </p>
            </div>
            <div className="h-12 w-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Atenção */}
      <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50 dark:bg-yellow-950/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Atenção
              </p>
              <h3 className="text-3xl font-bold text-yellow-900 dark:text-yellow-300 mt-2">
                {summary.atencao}
              </h3>
              <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                {formatCurrency(summary.custoTotalAtencao)}
              </p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custo Total */}
      <Card className="border-purple-200 dark:border-purple-900 bg-purple-50 dark:bg-purple-950/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-400">
                Custo Total
              </p>
              <h3 className="text-2xl font-bold text-purple-900 dark:text-purple-300 mt-2">
                {formatCurrency(summary.custoTotalGeral)}
              </h3>
              <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">
                Para reposição completa
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
