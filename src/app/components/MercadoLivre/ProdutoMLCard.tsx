"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { exibirValorEmReais } from "@/utils/currency";
import { Package, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";

interface ProdutoMLProps {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlOriginalPrice?: number | null;
  mlHasPromotion?: boolean;
  mlPromotionDiscount?: number | null;
  mlSavings?: number;
  mlAvailableQuantity: number;
  mlSoldQuantity: number;
  mlStatus: string;
  produto?: {
    nome: string;
    sku: string;
  } | null;
  onClick?: () => void;
}

export default function ProdutoMLCard({
  id,
  mlItemId,
  mlTitle,
  mlPrice,
  mlOriginalPrice,
  mlHasPromotion,
  mlPromotionDiscount,
  mlSavings,
  mlAvailableQuantity,
  mlSoldQuantity,
  mlStatus,
  produto,
  onClick,
}: ProdutoMLProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      case "closed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { color: "text-red-600", icon: AlertTriangle, text: "Esgotado" };
    if (quantity <= 5) return { color: "text-yellow-600", icon: AlertTriangle, text: "Baixo" };
    return { color: "text-green-600", icon: Package, text: "Disponível" };
  };

  const stockStatus = getStockStatus(mlAvailableQuantity);
  const StockIcon = stockStatus.icon;

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
        mlStatus !== "active" ? "opacity-75" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header com Status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm line-clamp-2 mb-1">
              {mlTitle}
            </h3>
            {produto && (
              <p className="text-xs text-muted-foreground truncate">
                SKU: {produto.sku}
              </p>
            )}
          </div>
          <Badge className={`ml-2 text-xs ${getStatusColor(mlStatus)}`}>
            {mlStatus === "active" ? "Ativo" : mlStatus === "paused" ? "Pausado" : "Fechado"}
          </Badge>
        </div>

        {/* Preços */}
        <div className="mb-3">
          {mlHasPromotion && mlOriginalPrice ? (
            <div className="space-y-1">
              {/* Preço promocional */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-green-600 text-lg">
                  {exibirValorEmReais(mlPrice)}
                </span>
                {mlPromotionDiscount && (
                  <Badge variant="destructive" className="text-xs">
                    -{mlPromotionDiscount}%
                  </Badge>
                )}
              </div>
              
              {/* Preço original riscado */}
              <div className="text-sm text-muted-foreground">
                <span className="line-through">
                  De: {exibirValorEmReais(mlOriginalPrice)}
                </span>
              </div>
              
              {/* Economia */}
              {mlSavings && mlSavings > 0 && (
                <div className="text-xs text-green-600 font-medium">
                  Economia: {exibirValorEmReais(mlSavings)}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg">
                {exibirValorEmReais(mlPrice)}
              </span>
            </div>
          )}
        </div>

        {/* Estoque e Vendas */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <StockIcon className={`h-4 w-4 ${stockStatus.color}`} />
            <span className={stockStatus.color}>
              {mlAvailableQuantity} {stockStatus.text}
            </span>
          </div>
          
          {mlSoldQuantity > 0 && (
            <div className="flex items-center gap-1 text-blue-600">
              <TrendingUp className="h-4 w-4" />
              <span>{mlSoldQuantity} vendidos</span>
            </div>
          )}
        </div>

        {/* ML Item ID para debug */}
        <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
          ML ID: {mlItemId}
        </div>
      </CardContent>
    </Card>
  );
}
