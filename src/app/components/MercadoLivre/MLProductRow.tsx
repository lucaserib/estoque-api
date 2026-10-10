"use client";

import { ProductImage } from "@/components/ui/product-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableCell, DataTableRow } from "@/components/ui/data-table";
import {
  Eye,
  Edit,
  Link,
  Unlink,
  AlertTriangle,
  CheckCircle,
  Store,
  Pause,
  Play,
} from "lucide-react";
import { exibirValorEmReais } from "@/utils/currency";

interface Product {
  id: string;
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlAutoStockPausado?: boolean;
  mlOriginalPrice?: number | null;
  mlHasPromotion?: boolean;
  mlPromotionDiscount?: number | null;
  mlSavings?: number;
  mlStatus: string;
  mlAvailableQuantity: number;
  mlSoldQuantity: number;
  mlPermalink: string;
  mlThumbnail?: string;
  localProduct?: {
    id: string;
    nome: string;
    sku: string;
  } | null;
  localStock?: number;
  stockStatus?: "ok" | "low" | "out" | "unlinked" | string;
  lastSync?: string;
  syncStatus?: string;
  salesData?: {
    quantityThisMonth?: number;
    revenueThisMonth?: number;
    salesVelocity?: number;
    daysInMonth?: number;
    quantityPreviousMonth?: number;
    revenuePreviousMonth?: number;
    quantityGrowth?: number;
    revenueGrowth?: number;
    totalHistoricalSales?: number;
    quantity30d?: number;
    revenue30d?: number;
  } | null;
}

interface MLProductRowProps {
  product: Product;
  onViewProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onLinkProduct: (product: Product) => void;
  onUnlinkProduct: (product: Product) => void;
  onTogglePause: (product: Product) => void;
}

export default function MLProductRow({
  product,
  onViewProduct,
  onEditProduct,
  onLinkProduct,
  onUnlinkProduct,
  onTogglePause,
}: MLProductRowProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline";
        color: string;
        text: string;
      }
    > = {
      active: {
        variant: "default",
        color: "bg-success/10 text-success",
        text: "Ativo",
      },
      paused: {
        variant: "secondary",
        color: "bg-warning/10 text-warning",
        text: "Pausado",
      },
      closed: {
        variant: "destructive",
        color: "bg-destructive/10 text-destructive",
        text: "Fechado",
      },
      under_review: {
        variant: "outline",
        color: "bg-info/10 text-info",
        text: "Em Análise",
      },
    };

    const statusInfo = variants[status] || variants.closed;

    return (
      <Badge variant={statusInfo.variant} className={statusInfo.color}>
        {statusInfo.text}
      </Badge>
    );
  };

  const getStockBadge = (stockStatus: string, stock: number) => {
    const variants: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline";
        color: string;
        icon: React.ReactNode;
      }
    > = {
      ok: {
        variant: "default",
        color: "bg-success/10 text-success",
        icon: <CheckCircle className="h-3 w-3" />,
      },
      low: {
        variant: "secondary",
        color: "bg-warning/10 text-warning",
        icon: <AlertTriangle className="h-3 w-3" />,
      },
      out: {
        variant: "destructive",
        color: "bg-destructive/10 text-destructive",
        icon: <AlertTriangle className="h-3 w-3" />,
      },
      unlinked: {
        variant: "outline",
        color: "bg-muted text-foreground",
        icon: <Unlink className="h-3 w-3" />,
      },
    };

    const stockInfo = variants[stockStatus] || variants.unlinked;

    return (
      <Badge
        variant={stockInfo.variant}
        className={`${stockInfo.color} flex items-center gap-1`}
      >
        {stockInfo.icon}
        {stock}
      </Badge>
    );
  };

  return (
    <DataTableRow key={product.mlItemId}>
      <DataTableCell>
        <div className="flex items-center space-x-3">
          <ProductImage src={product.mlThumbnail} alt={product.mlTitle} size={40} />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">
              {product.mlTitle}
            </div>
            <div className="text-xs text-muted-foreground">
              {product.mlItemId}
            </div>
          </div>
        </div>
      </DataTableCell>

      <DataTableCell>
        <div className="space-y-1">
          {product.mlHasPromotion && product.mlOriginalPrice ? (
            <div>
              <div className="font-bold text-success">
                {exibirValorEmReais(product.mlPrice)}
              </div>
              <div className="text-xs text-muted-foreground line-through">
                {exibirValorEmReais(product.mlOriginalPrice)}
              </div>
              {product.mlPromotionDiscount && (
                <Badge
                  variant="secondary"
                  className="text-xs bg-warning/10 text-warning"
                >
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
      </DataTableCell>

      <DataTableCell>{getStatusBadge(product.mlStatus)}</DataTableCell>

      <DataTableCell>
        <Badge variant="outline" className="font-mono">
          {product.mlAvailableQuantity}
        </Badge>
      </DataTableCell>

      <DataTableCell>
        <div>
          <div className="font-medium text-sm">
            <span className="text-success font-bold">
              {product.salesData?.quantityThisMonth || 0}
            </span>{" "}
            unid. (este mês)
          </div>
          <div className="text-xs text-muted-foreground">
            {exibirValorEmReais(product.salesData?.revenueThisMonth || 0)}
          </div>
          {product.salesData?.salesVelocity &&
            product.salesData.salesVelocity > 0 && (
              <div className="text-xs text-info">
                {product.salesData.salesVelocity.toFixed(1)}/dia
              </div>
            )}
          {product.salesData?.quantityPreviousMonth &&
            product.salesData.quantityPreviousMonth > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                Mês anterior: {product.salesData.quantityPreviousMonth} unid.
                {product.salesData.quantityGrowth !== undefined &&
                  product.salesData.quantityGrowth !== 0 && (
                    <span
                      className={`ml-1 font-medium ${
                        product.salesData.quantityGrowth > 0
                          ? "text-success"
                          : "text-destructive"
                      }`}
                    >
                      ({product.salesData.quantityGrowth > 0 ? "+" : ""}
                      {product.salesData.quantityGrowth.toFixed(1)}%)
                    </span>
                  )}
              </div>
            )}
        </div>
      </DataTableCell>

      <DataTableCell>
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
          <div className="text-sm text-muted-foreground">Não vinculado</div>
        )}
      </DataTableCell>

      <DataTableCell>
        {getStockBadge(
          product.stockStatus || "unlinked",
          product.localStock || 0
        )}
      </DataTableCell>

      <DataTableCell>
        <div className="text-xs text-muted-foreground">
          {product.lastSync
            ? new Date(product.lastSync).toLocaleDateString("pt-BR")
            : "Nunca"}
        </div>
      </DataTableCell>

      <DataTableCell>
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
            onClick={() =>
              window.open(
                `https://mercadolibre.com.br/p/${product.mlItemId}`,
                "_blank"
              )
            }
          >
            <Store className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            title={
              product.mlAutoStockPausado
                ? "Retomar envio automático de estoque"
                : "Pausar envio automático de estoque"
            }
            onClick={() => onTogglePause(product)}
          >
            {product.mlAutoStockPausado ? (
              <Play className="h-4 w-4 text-warning" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </Button>
        </div>
      </DataTableCell>
    </DataTableRow>
  );
}
