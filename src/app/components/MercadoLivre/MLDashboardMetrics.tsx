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
} from "lucide-react";
import MLMetricsCard from "./MLMetricsCard";
import { DashboardMetrics } from "@/types/ml-analytics";
import { formatBRL } from "@/lib/format";

interface MLDashboardMetricsProps {
  metrics: DashboardMetrics;
}

export default function MLDashboardMetrics({
  metrics,
}: MLDashboardMetricsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MLMetricsCard
          title="Vendas Hoje"
          value={metrics.todaySales}
          subtitle={`${metrics.weekSales} na semana`}
          icon={ShoppingCart}
        />

        <MLMetricsCard
          title="Receita Semanal"
          value={metrics.totalRevenue}
          format="brl-reais"
          subtitle={`Ticket médio: ${formatBRL(metrics.averageTicket)}`}
          icon={DollarSign}
        />

        <MLMetricsCard
          title="Pedidos Pendentes"
          value={metrics.pendingOrders}
          subtitle={metrics.pendingOrders > 0 ? "Requer atenção" : undefined}
          icon={Clock}
        />

        <MLMetricsCard
          title="Produtos Ativos"
          value={metrics.activeProducts}
          subtitle={`de ${metrics.totalProducts} total`}
          icon={Package}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MLMetricsCard
          title="Estoque Baixo"
          value={metrics.lowStockProducts}
          subtitle={
            metrics.lowStockProducts > 0 ? "Precisa reposição" : undefined
          }
          icon={AlertTriangle}
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
        />

        <MLMetricsCard
          title="Produtos Pausados"
          value={metrics.pausedProducts}
          subtitle={
            metrics.pausedProducts > 0 ? "Reativar para vender" : undefined
          }
          icon={AlertCircle}
        />

        <MLMetricsCard
          title="Saúde dos Produtos"
          value={`${metrics.productHealth.healthPercentage}%`}
          format="text"
          subtitle={`${metrics.productHealth.healthy} de ${metrics.productHealth.total} saudáveis`}
          icon={Star}
          progress={{
            value: metrics.productHealth.healthPercentage,
            label: "Produtos saudáveis",
          }}
          details={[
            { label: "Ativos", value: metrics.activeProducts },
            ...(metrics.pausedProducts > 0
              ? [{ label: "Pausados", value: metrics.pausedProducts }]
              : []),
            ...(metrics.lowStockProducts > 0
              ? [{ label: "Estoque baixo", value: metrics.lowStockProducts }]
              : []),
          ]}
        />
      </div>
    </div>
  );
}
