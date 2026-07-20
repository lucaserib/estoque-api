"use client";

import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBRLReais, formatPercent } from "@/lib/format";

export interface TopProductEntry {
  itemId: string;
  title: string;
  revenue: number;
  quantity: number;
}

interface TopProductsChartProps {
  products: TopProductEntry[];
  totalRevenue: number;
}

const TopProductsChart = ({
  products,
  totalRevenue,
}: TopProductsChartProps) => {
  const top = products.slice(0, 5);
  const maxRevenue = top.length > 0 ? top[0].revenue : 0;

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-4 w-4 text-muted-foreground" />
          Top 5 Produtos por Receita
        </CardTitle>
      </CardHeader>
      <CardContent>
        {top.length === 0 ? (
          <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
            Sem vendas no período selecionado
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="space-y-4">
              {top.map((product) => {
                const participation =
                  totalRevenue > 0
                    ? (product.revenue / totalRevenue) * 100
                    : 0;
                const barWidth =
                  maxRevenue > 0 ? (product.revenue / maxRevenue) * 100 : 0;

                return (
                  <div key={product.itemId}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm truncate cursor-default">
                            {product.title}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-72 text-xs">
                          {product.title} · {product.quantity} un.
                        </TooltipContent>
                      </Tooltip>
                      <p className="text-sm font-medium tabular-nums shrink-0">
                        {formatBRLReais(product.revenue)}
                        <span className="text-muted-foreground font-normal ml-1.5">
                          {formatPercent(participation)}
                        </span>
                      </p>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
};

export default TopProductsChart;
