"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { 
  Eye, 
  Edit, 
  Link, 
  Unlink, 
  AlertTriangle, 
  CheckCircle,
  Store 
} from "lucide-react";
import { exibirValorEmReais } from "@/utils/currency";

interface Product {
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlOriginalPrice?: number;
  mlHasPromotion: boolean;
  mlPromotionDiscount?: number;
  mlSavings?: number;
  mlStatus: string;
  mlAvailableQuantity: number;
  mlThumbnail?: string;
  localProduct?: {
    id: string;
    nome: string;
    sku: string;
  } | null;
  localStock: number;
  stockStatus: string;
  lastSync: string;
  syncStatus: string;
  salesData: {
    quantityThisMonth: number;
    revenueThisMonth: number;
    salesVelocity: number;
    daysInMonth: number;
    quantityPreviousMonth: number;
    revenuePreviousMonth: number;
    quantityGrowth: number;
    revenueGrowth: number;
    totalHistoricalSales: number;
  };
}

interface MLProductRowProps {
  product: Product;
  onViewProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onLinkProduct: (product: Product) => void;
  onUnlinkProduct: (product: Product) => void;
}

export default function MLProductRow({
  product,
  onViewProduct,
  onEditProduct,
  onLinkProduct,
  onUnlinkProduct,
}: MLProductRowProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, {
      variant: "default" | "secondary" | "destructive" | "outline";
      color: string;
      text: string;
    }> = {
      active: { variant: "default", color: "bg-green-100 text-green-800", text: "Ativo" },
      paused: { variant: "secondary", color: "bg-yellow-100 text-yellow-800", text: "Pausado" },
      closed: { variant: "destructive", color: "bg-red-100 text-red-800", text: "Fechado" },
      under_review: { variant: "outline", color: "bg-blue-100 text-blue-800", text: "Em Análise" },
    };

    const statusInfo = variants[status] || variants.closed;
    
    return (
      <Badge variant={statusInfo.variant} className={statusInfo.color}>
        {statusInfo.text}
      </Badge>
    );
  };

  const getStockBadge = (stockStatus: string, stock: number) => {
    const variants: Record<string, {
      variant: "default" | "secondary" | "destructive" | "outline";
      color: string;
      icon: React.ReactNode;
    }> = {
      ok: { 
        variant: "default", 
        color: "bg-green-100 text-green-800", 
        icon: <CheckCircle className="h-3 w-3" /> 
      },
      low: { 
        variant: "secondary", 
        color: "bg-yellow-100 text-yellow-800", 
        icon: <AlertTriangle className="h-3 w-3" /> 
      },
      out: { 
        variant: "destructive", 
        color: "bg-red-100 text-red-800", 
        icon: <AlertTriangle className="h-3 w-3" /> 
      },
      unlinked: { 
        variant: "outline", 
        color: "bg-gray-100 text-gray-800", 
        icon: <Unlink className="h-3 w-3" /> 
      },
    };

    const stockInfo = variants[stockStatus] || variants.unlinked;

    return (
      <Badge variant={stockInfo.variant} className={`${stockInfo.color} flex items-center gap-1`}>
        {stockInfo.icon}
        {stock}
      </Badge>
    );
  };

  return (
    <TableRow key={product.mlItemId}>
      {/* Produto */}
      <TableCell>
        <div className="flex items-center space-x-3">
          {product.mlThumbnail && (
            <img
              src={product.mlThumbnail}
              alt={product.mlTitle}
              className="w-10 h-10 rounded-md object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">
              {product.mlTitle}
            </div>
            <div className="text-xs text-muted-foreground">
              {product.mlItemId}
            </div>
          </div>
        </div>
      </TableCell>

      {/* Preço */}
      <TableCell>
        <div className="space-y-1">
          {/* ✅ CORREÇÃO: Exibir preço promocional corretamente */}
          {product.mlHasPromotion && product.mlOriginalPrice ? (
            <div>
              {/* Preço atual (promocional) */}
              <div className="font-bold text-green-600">
                {exibirValorEmReais(product.mlPrice)}
              </div>
              {/* Preço original riscado */}
              <div className="text-xs text-muted-foreground line-through">
                {exibirValorEmReais(product.mlOriginalPrice)}
              </div>
              {/* Badge de desconto */}
              {product.mlPromotionDiscount && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                  -{product.mlPromotionDiscount}%
                </Badge>
              )}
            </div>
          ) : (
            <div className="font-medium">
              {exibirValorEmReais(product.mlPrice)}
            </div>
          )}
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        {getStatusBadge(product.mlStatus)}
      </TableCell>

      {/* Estoque ML */}
      <TableCell>
        <Badge variant="outline" className="font-mono">
          {product.mlAvailableQuantity}
        </Badge>
      </TableCell>

      {/* Vendas */}
      <TableCell>
        <div>
          {/* ✅ NOVO: Vendas deste mês */}
          <div className="font-medium text-sm">
            <span className="text-green-600 font-bold">
              {product.salesData.quantityThisMonth}
            </span>{" "}
            unid. (este mês)
          </div>
          <div className="text-xs text-muted-foreground">
            {exibirValorEmReais(product.salesData.revenueThisMonth)}
          </div>
          {product.salesData.salesVelocity > 0 && (
            <div className="text-xs text-blue-600">
              {product.salesData.salesVelocity.toFixed(1)}/dia
            </div>
          )}
          {/* ✅ NOVO: Comparação com mês anterior */}
          {product.salesData.quantityPreviousMonth > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Mês anterior: {product.salesData.quantityPreviousMonth} unid.
              {product.salesData.quantityGrowth !== 0 && (
                <span
                  className={`ml-1 font-medium ${
                    product.salesData.quantityGrowth > 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  ({product.salesData.quantityGrowth > 0 ? "+" : ""}
                  {product.salesData.quantityGrowth.toFixed(1)}%)
                </span>
              )}
            </div>
          )}
        </div>
      </TableCell>

      {/* Produto Local */}
      <TableCell>
        {product.localProduct ? (
          <div>
            <div className="font-medium text-sm">
              {product.localProduct.nome}
            </div>
            <div className="text-xs text-muted-foreground">
              SKU: {product.localProduct.sku}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Não vinculado
          </div>
        )}
      </TableCell>

      {/* Estoque Local */}
      <TableCell>
        {getStockBadge(product.stockStatus, product.localStock)}
      </TableCell>

      {/* Última Sync */}
      <TableCell>
        <div className="text-xs text-muted-foreground">
          {product.lastSync
            ? new Date(product.lastSync).toLocaleDateString("pt-BR")
            : "Nunca"}
        </div>
      </TableCell>

      {/* Ações */}
      <TableCell>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewProduct(product)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEditProduct(product)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {product.localProduct ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUnlinkProduct(product)}
            >
              <Unlink className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onLinkProduct(product)}
            >
              <Link className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://mercadolibre.com.br/p/${product.mlItemId}`, '_blank')}
          >
            <Store className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
