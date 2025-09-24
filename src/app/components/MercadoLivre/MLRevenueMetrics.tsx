"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Info,
  Calculator,
  Target,
  BarChart3
} from "lucide-react";
import { exibirValorEmReais } from "@/utils/currency";

interface RevenueMetrics {
  totalRevenue: number;
  totalRevenueProducts: number;
  shippingRevenue: number;
  averageTicket: number;
  averageTicketProducts: number;
  averageTicketWithShipping: number;
  shippingPercentage: number;
  weekSales: number;
  todaySales: number;
  pendingOrders: number;
  salesGrowth: string;
}

interface MLRevenueMetricsProps {
  metrics: RevenueMetrics;
  loading?: boolean;
}

export default function MLRevenueMetrics({ metrics, loading }: MLRevenueMetricsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const hasShippingData = metrics.shippingRevenue > 0;
  const revenueGrowthIcon = metrics.salesGrowth === "positive" ? TrendingUp : TrendingDown;
  const revenueGrowthColor = metrics.salesGrowth === "positive" ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-6">
      {/* Header explicativo */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold text-blue-900">Faturamento Completo</h3>
              <p className="text-sm text-blue-700">
                {hasShippingData
                  ? "Análise completa incluindo receita de produtos e frete para uma visão precisa do seu negócio."
                  : "Análise baseada nos valores de produtos. Dados de frete podem não estar disponíveis para todos os pedidos."
                }
              </p>
              {hasShippingData && (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <Package className="h-3 w-3" />
                  <span>Produtos: {exibirValorEmReais(metrics.totalRevenueProducts)}</span>
                  <span>•</span>
                  <Truck className="h-3 w-3" />
                  <span>Frete: {exibirValorEmReais(metrics.shippingRevenue)} ({metrics.shippingPercentage}%)</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Faturamento Total */}
        <Card className="border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-muted-foreground">Faturamento Total</p>
                  {hasShippingData && (
                    <Badge variant="secondary" className="text-xs">
                      + Frete
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {exibirValorEmReais(metrics.totalRevenue)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {metrics.weekSales} vendas na semana
                  </span>
                  {metrics.salesGrowth === "positive" && (
                    <TrendingUp className={`h-3 w-3 ${revenueGrowthColor}`} />
                  )}
                </div>

                {/* Breakdown detalhado */}
                {hasShippingData && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        Produtos
                      </span>
                      <span className="font-medium">
                        {exibirValorEmReais(metrics.totalRevenueProducts)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        Frete
                      </span>
                      <span className="font-medium">
                        {exibirValorEmReais(metrics.shippingRevenue)}
                      </span>
                    </div>
                    <Progress
                      value={100 - metrics.shippingPercentage}
                      className="h-1 mt-2"
                    />
                  </div>
                )}
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Ticket Médio Detalhado */}
        <Card className="border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm text-muted-foreground">Ticket Médio</p>
                  <div className="group relative">
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-black text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      Valor médio por pedido {hasShippingData ? "incluindo frete" : "baseado nos produtos"}
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {exibirValorEmReais(metrics.averageTicket)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Baseado em pedidos recentes
                </p>

                {/* Comparação de tickets */}
                {hasShippingData && metrics.averageTicketProducts !== metrics.averageTicketWithShipping && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Só produtos:</span>
                      <span className="font-medium">
                        {exibirValorEmReais(metrics.averageTicketProducts)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Com frete:</span>
                      <span className="font-medium">
                        {exibirValorEmReais(metrics.averageTicketWithShipping)}
                      </span>
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      +{exibirValorEmReais(metrics.averageTicketWithShipping - metrics.averageTicketProducts)} por frete
                    </div>
                  </div>
                )}
              </div>
              <Target className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Performance de Vendas */}
        <Card className="border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">Performance</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Hoje:</span>
                    <span className="font-semibold text-green-600">
                      {metrics.todaySales} vendas
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Semana:</span>
                    <span className="font-semibold text-blue-600">
                      {metrics.weekSales} vendas
                    </span>
                  </div>
                  {metrics.pendingOrders > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Pendentes:</span>
                      <Badge variant="destructive" className="text-xs">
                        {metrics.pendingOrders}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Média diária estimada */}
                <div className="mt-3 pt-2 border-t border-orange-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Média/dia:</span>
                    <span className="font-medium">
                      {(metrics.weekSales / 7).toFixed(1)} vendas
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-muted-foreground">Receita/dia:</span>
                    <span className="font-medium">
                      {exibirValorEmReais(Math.round(metrics.totalRevenue / 7))}
                    </span>
                  </div>
                </div>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights sobre frete */}
      {hasShippingData && metrics.shippingPercentage > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Calculator className="h-5 w-5 text-purple-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-purple-900 mb-2">Análise de Frete</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-purple-700">Representatividade do frete:</span>
                    <div className="font-semibold text-purple-900">
                      {metrics.shippingPercentage}% do faturamento
                    </div>
                  </div>
                  <div>
                    <span className="text-purple-700">Frete por pedido:</span>
                    <div className="font-semibold text-purple-900">
                      {exibirValorEmReais(metrics.averageTicketWithShipping - metrics.averageTicketProducts)}
                    </div>
                  </div>
                  <div>
                    <span className="text-purple-700">Estratégia:</span>
                    <div className="font-semibold text-purple-900">
                      {metrics.shippingPercentage > 15
                        ? "Considere frete grátis"
                        : "Frete otimizado"
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}