"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { exibirValorEmReais } from "@/utils/currency";
import { SalesAnalytics } from "@/types/ml-analytics";

interface MLTopSellingProductsProps {
  salesData: SalesAnalytics;
}

export default function MLTopSellingProducts({ salesData }: MLTopSellingProductsProps) {
  if (!salesData?.topSellingProducts?.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Produtos Mais Vendidos (30 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {salesData.topSellingProducts
            .slice(0, 5)
            .map((product, index) => (
              <div
                key={product.itemId}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Badge
                    variant="outline"
                    className="min-w-[28px] h-6 justify-center font-bold"
                  >
                    {index + 1}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2 mb-1">
                      {product.title}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{product.quantity} vendidos</span>
                      {product.orders && (
                        <span>{product.orders} pedidos</span>
                      )}
                      {product.averagePrice && (
                        <span>Preço médio: {exibirValorEmReais(product.averagePrice)}</span>
                      )}
                    </div>
                    
                    {/* Mostrar informações de desconto se disponível */}
                    {product.discountPercentage && product.discountPercentage > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="destructive" className="text-xs">
                          -{product.discountPercentage}% OFF
                        </Badge>
                        {product.originalPrice && (
                          <span className="text-xs text-muted-foreground line-through">
                            {exibirValorEmReais(product.originalPrice)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right ml-4">
                  <p className="font-semibold text-green-600 text-lg">
                    {exibirValorEmReais(product.revenue)}
                  </p>
                  <p className="text-xs text-muted-foreground">receita</p>
                </div>
              </div>
            ))}
        </div>
        
        {/* Resumo */}
        {salesData.summary && (
          <div className="mt-4 pt-4 border-t bg-muted/30 rounded-lg p-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {salesData.summary.totalSales}
                </p>
                <p className="text-xs text-muted-foreground">Total vendas</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {exibirValorEmReais(salesData.summary.totalRevenue)}
                </p>
                <p className="text-xs text-muted-foreground">Receita total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {exibirValorEmReais(salesData.summary.averageTicket)}
                </p>
                <p className="text-xs text-muted-foreground">Ticket médio</p>
              </div>
              {salesData.summary.totalOrders && (
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {salesData.summary.totalOrders}
                  </p>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
