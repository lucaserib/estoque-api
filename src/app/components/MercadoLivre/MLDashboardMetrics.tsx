"use client";

import {
  ShoppingCart,
  DollarSign,
  Clock,
  Package,
  AlertTriangle,
  BarChart3,
  AlertCircle,
  Star,
  TrendingUp,
} from "lucide-react";
import MLMetricsCard from "./MLMetricsCard";
import { DashboardMetrics } from "@/types/ml-analytics";

interface MLDashboardMetricsProps {
  metrics: DashboardMetrics;
}

export default function MLDashboardMetrics({
  metrics,
}: MLDashboardMetricsProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Vendas e Performance */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MLMetricsCard
          title="Vendas Hoje"
          value={metrics.todaySales}
          subtitle={`${metrics.weekSales} na semana`}
          icon={ShoppingCart}
          color="green"
        />

        <MLMetricsCard
          title="Receita Semanal"
          value={metrics.totalRevenue}
          subtitle={`Ticket médio: ${metrics.averageTicket}`}
          icon={DollarSign}
          color="blue"
          trend={metrics.salesGrowth === "positive" ? "up" : "neutral"}
        />

        <MLMetricsCard
          title="Pedidos Pendentes"
          value={metrics.pendingOrders}
          subtitle={metrics.pendingOrders > 0 ? "Requer atenção" : undefined}
          icon={Clock}
          color={metrics.pendingOrders > 0 ? "orange" : "green"}
        />

        <MLMetricsCard
          title="Produtos Ativos"
          value={metrics.activeProducts}
          subtitle={`de ${metrics.totalProducts} total`}
          icon={Package}
          color="green"
        />
      </div>

      {/* Row 2: Estoque e Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MLMetricsCard
          title="Estoque Baixo"
          value={metrics.lowStockProducts}
          subtitle={
            metrics.lowStockProducts > 0 ? "Precisa reposição" : undefined
          }
          icon={AlertTriangle}
          color={metrics.lowStockProducts > 0 ? "red" : "green"}
        />

        <MLMetricsCard
          title="Sugestões Reposição"
          value={metrics.needsRestockProducts}
          subtitle={
            metrics.needsRestockProducts > 0
              ? "Produtos prioritários"
              : undefined
          }
          icon={BarChart3}
          color={metrics.needsRestockProducts > 0 ? "purple" : "green"}
        />

        <MLMetricsCard
          title="Produtos Pausados"
          value={metrics.pausedProducts}
          subtitle={
            metrics.pausedProducts > 0 ? "Reativar para vender" : undefined
          }
          icon={AlertCircle}
          color={metrics.pausedProducts > 0 ? "orange" : "green"}
        />

        <MLMetricsCard
          title="Saúde dos Produtos"
          value={`${metrics.productHealth.healthPercentage}%`}
          subtitle={`${metrics.productHealth.healthy} de ${metrics.productHealth.total} saudáveis`}
          icon={Star}
          color="blue"
          progress={{
            value: metrics.productHealth.healthPercentage,
            label: "Produtos saudáveis",
          }}
          details={[
            {
              label: "✓ Ativos",
              value: metrics.activeProducts,
              color: "text-green-600",
            },
            ...(metrics.pausedProducts > 0
              ? [
                  {
                    label: "⏸ Pausados",
                    value: metrics.pausedProducts,
                    color: "text-orange-600",
                  },
                ]
              : []),
            ...(metrics.lowStockProducts > 0
              ? [
                  {
                    label: "⚠ Estoque baixo",
                    value: metrics.lowStockProducts,
                    color: "text-red-600",
                  },
                ]
              : []),
          ]}
        />
      </div>
    </div>
  );
}
