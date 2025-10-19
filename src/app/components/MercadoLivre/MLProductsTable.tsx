"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import MLProductRow from "./MLProductRow";

interface Product {
  mlItemId: string;
  mlTitle: string;
  mlPrice: number;
  mlOriginalPrice?: number | null;
  mlBasePrice?: number | null;
  mlHasPromotion?: boolean;
  mlPromotionDiscount?: number | null;
  mlSavings?: number;
  mlAvailableQuantity: number;
  mlSoldQuantity: number;
  mlStatus: string;
  mlThumbnail?: string;
  mlPermalink: string;
  produto?: {
    id: string;
    nome: string;
    sku: string;
    estoqueLocal?: number;
  } | null;
  localProduct?: {
    id: string;
    nome: string;
    sku: string;
  } | null;
  localStock?: number;
  stockStatus?: "ok" | "low" | "out" | "unlinked" | string;
  lastSync?: string;
  lastSyncAt?: string;
  syncStatus?: string;
  salesData?: {
    quantityThisMonth?: number;
    revenueThisMonth?: number;
    salesVelocity?: number;
    daysInMonth?: number;
    quantity30d?: number;
    revenue30d?: number;
  } | null;
}

interface MLProductsTableProps {
  products: Product[];
  loading: boolean;
  onViewProduct: (product: Product) => void;
  onEditProduct: (product: Product) => void;
  onLinkProduct: (product: Product) => void;
  onUnlinkProduct: (product: Product) => void;
}

// Skeleton para loading
const ProductRowSkeleton = () => (
  <TableRow>
    <td className="p-4">
      <div className="flex items-center space-x-3">
        <Skeleton className="w-10 h-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="w-48 h-4" />
          <Skeleton className="w-32 h-3" />
        </div>
      </div>
    </td>
    <td className="p-4">
      <Skeleton className="w-20 h-6" />
    </td>
    <td className="p-4">
      <Skeleton className="w-16 h-6 rounded-full" />
    </td>
    <td className="p-4">
      <Skeleton className="w-12 h-6" />
    </td>
    <td className="p-4">
      <div className="space-y-1">
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-20 h-3" />
      </div>
    </td>
    <td className="p-4">
      <div className="space-y-1">
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-20 h-3" />
      </div>
    </td>
    <td className="p-4">
      <Skeleton className="w-16 h-6 rounded-full" />
    </td>
    <td className="p-4">
      <Skeleton className="w-20 h-3" />
    </td>
    <td className="p-4">
      <div className="flex gap-1">
        <Skeleton className="w-8 h-8" />
        <Skeleton className="w-8 h-8" />
        <Skeleton className="w-8 h-8" />
        <Skeleton className="w-8 h-8" />
      </div>
    </td>
  </TableRow>
);

export default function MLProductsTable({
  products,
  loading,
  onViewProduct,
  onEditProduct,
  onLinkProduct,
  onUnlinkProduct,
}: MLProductsTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-[300px]">Produto</TableHead>
                <TableHead className="w-[120px]">Preço</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[100px]">Estoque ML</TableHead>
                <TableHead className="w-[160px]">Vendas (Set/2025)</TableHead>
                <TableHead className="w-[200px]">Produto Local</TableHead>
                <TableHead className="w-[120px]">Estoque Local</TableHead>
                <TableHead className="w-[100px]">Última Sync</TableHead>
                <TableHead className="w-[200px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                // Skeleton Loading
                Array.from({ length: 5 }).map((_, index) => (
                  <ProductRowSkeleton key={index} />
                ))
              ) : products.length === 0 ? (
                // Estado vazio
                <TableRow>
                  <td
                    colSpan={9}
                    className="p-8 text-center text-muted-foreground"
                  >
                    <div className="space-y-2">
                      <div className="text-lg font-medium">
                        Nenhum produto encontrado
                      </div>
                      <div className="text-sm">
                        Tente ajustar os filtros ou recarregar a página
                      </div>
                    </div>
                  </td>
                </TableRow>
              ) : (
                // Lista de produtos
                products.map((product) => (
                  <MLProductRow
                    key={product.mlItemId}
                    product={product}
                    onViewProduct={onViewProduct}
                    onEditProduct={onEditProduct}
                    onLinkProduct={onLinkProduct}
                    onUnlinkProduct={onUnlinkProduct}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Informações de paginação/totais */}
        {!loading && products.length > 0 && (
          <div className="p-4 border-t bg-muted/50">
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <div>
                Mostrando <span className="font-medium">{products.length}</span>{" "}
                produtos
              </div>
              <div className="flex gap-4">
                <div>
                  Ativos:{" "}
                  <span className="font-medium text-green-600">
                    {products.filter((p) => p.mlStatus === "active").length}
                  </span>
                </div>
                <div>
                  Com vendas:{" "}
                  <span className="font-medium text-blue-600">
                    {
                      products.filter(
                        (p) =>
                          p.salesData?.quantityThisMonth &&
                          p.salesData.quantityThisMonth > 0
                      ).length
                    }
                  </span>
                </div>
                <div>
                  Vinculados:{" "}
                  <span className="font-medium text-purple-600">
                    {products.filter((p) => p.localProduct).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
