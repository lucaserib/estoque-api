"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Package, TrendingDown } from "lucide-react";
import { formatarReal } from "@/utils/currency";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CancelledProduct } from "@/types/ml-analytics";

interface ProdutosCanceladosSectionProps {
  products: CancelledProduct[];
}

export default function ProdutosCanceladosSection({
  products,
}: ProdutosCanceladosSectionProps) {
  if (!products || products.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Nenhum produto com cancelamentos no período
          </p>
        </CardContent>
      </Card>
    );
  }

  // Produtos com alta taxa de cancelamento (>20%)
  const highCancellationProducts = products.filter(
    (p) => p.cancellationRate > 20
  );

  const getCancellationBadge = (rate: number) => {
    if (rate >= 50) {
      return <Badge variant="destructive">Crítico ({rate.toFixed(1)}%)</Badge>;
    }
    if (rate >= 20) {
      return (
        <Badge variant="destructive" className="bg-orange-500">
          Alerta ({rate.toFixed(1)}%)
        </Badge>
      );
    }
    return <Badge variant="secondary">Normal ({rate.toFixed(1)}%)</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Alerta se houver produtos com alta taxa */}
      {highCancellationProducts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{highCancellationProducts.length} produto(s)</strong> com
            taxa de cancelamento elevada (acima de 20%). Revise descrições,
            imagens e qualidade destes itens.
          </AlertDescription>
        </Alert>
      )}

      {/* Card Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Produtos com Mais Cancelamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Qtd. Cancelada</TableHead>
                <TableHead className="text-center">Pedidos Cancel.</TableHead>
                <TableHead className="text-right">Receita Perdida</TableHead>
                <TableHead className="text-center">Taxa Cancel.</TableHead>
                <TableHead className="text-center">Último Cancel.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.mlItemId}>
                  <TableCell className="max-w-[300px]">
                    <div className="flex flex-col">
                      <span className="font-medium truncate">
                        {product.productName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ID: {product.mlItemId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {product.sku}
                    </code>
                  </TableCell>
                  <TableCell className="text-center font-semibold">
                    {product.totalCancelled}
                  </TableCell>
                  <TableCell className="text-center">
                    {product.cancellationCount}
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    {formatarReal(product.totalCancelledRevenue)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getCancellationBadge(product.cancellationRate)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {format(
                      new Date(product.lastCancellationDate),
                      "dd/MM/yyyy",
                      { locale: ptBR }
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo Estatístico */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total de Produtos</p>
            <p className="text-2xl font-bold">{products.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Taxa Média de Cancelamento
            </p>
            <p className="text-2xl font-bold text-orange-600">
              {(
                products.reduce((acc, p) => acc + p.cancellationRate, 0) /
                products.length
              ).toFixed(1)}
              %
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Receita Total Perdida
            </p>
            <p className="text-2xl font-bold text-red-600">
              {formatarReal(
                products.reduce((acc, p) => acc + p.totalCancelledRevenue, 0)
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
