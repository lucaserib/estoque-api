import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import {
  XCircle,
  AlertTriangle,
  DollarSign,
  Package,
  TrendingDown,
  User,
  Calendar,
} from "lucide-react";
import { formatarReal } from "@/utils/currency";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CancelledSalesData } from "@/types/ml-analytics";

interface VendasCanceladasSectionProps {
  data: CancelledSalesData;
}

export function VendasCanceladasSection({
  data,
}: VendasCanceladasSectionProps) {
  if (!data || data.totalCancelledOrders === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <XCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-green-900 dark:text-green-100">
                Vendas Canceladas
              </CardTitle>
              <CardDescription className="text-green-700 dark:text-green-300">
                Nenhuma venda cancelada no período selecionado
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const getCancellationRateColor = (rate: number) => {
    if (rate < 5) return "text-green-600 dark:text-green-400";
    if (rate < 10) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getCancellationRateBadge = (rate: number) => {
    if (rate < 5)
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    if (rate < 10)
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  };

  return (
    <div className="space-y-6">
      {/* Header com Alert */}
      {data.cancellationRate >= 10 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Taxa de cancelamento elevada!</strong>{" "}
            {data.cancellationRate.toFixed(1)}% dos pedidos foram cancelados.
            Considere revisar suas políticas de venda, descrições de produtos e
            prazos de entrega.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Pedidos Cancelados
                </p>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {data.totalCancelledOrders}
                </h3>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Itens Cancelados
                </p>
                <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {data.totalCancelledItems}
                </h3>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-200 dark:border-rose-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Receita Perdida
                </p>
                <h3 className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {formatarReal(data.totalCancelledRevenue)}
                </h3>
              </div>
              <div className="p-3 bg-rose-100 dark:bg-rose-900/20 rounded-lg">
                <DollarSign className="h-6 w-6 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border-2 ${
            data.cancellationRate < 5
              ? "border-green-200 dark:border-green-800"
              : data.cancellationRate < 10
              ? "border-yellow-200 dark:border-yellow-800"
              : "border-red-200 dark:border-red-800"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Taxa de Cancelamento
                </p>
                <h3
                  className={`text-2xl font-bold mt-1 ${getCancellationRateColor(
                    data.cancellationRate
                  )}`}
                >
                  {data.cancellationRate.toFixed(1)}%
                </h3>
              </div>
              <div
                className={`p-3 rounded-lg ${
                  data.cancellationRate < 5
                    ? "bg-green-100 dark:bg-green-900/20"
                    : data.cancellationRate < 10
                    ? "bg-yellow-100 dark:bg-yellow-900/20"
                    : "bg-red-100 dark:bg-red-900/20"
                }`}
              >
                <TrendingDown
                  className={`h-6 w-6 ${getCancellationRateColor(
                    data.cancellationRate
                  )}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Pedidos Cancelados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500" />
            Histórico de Pedidos Cancelados
          </CardTitle>
          <CardDescription>
            Detalhes dos {data.orders.length} pedidos cancelados mais recentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                <TableRow>
                  <TableHead className="font-medium">Data</TableHead>
                  <TableHead className="font-medium">Pedido</TableHead>
                  <TableHead className="font-medium">Comprador</TableHead>
                  <TableHead className="font-medium">Itens</TableHead>
                  <TableHead className="font-medium text-right">
                    Valor
                  </TableHead>
                  <TableHead className="font-medium">Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-gray-500"
                    >
                      Nenhum pedido cancelado encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  data.orders.map((order) => (
                    <TableRow
                      key={order.orderId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="font-medium">
                              {format(
                                new Date(order.date_created),
                                "dd/MM/yyyy",
                                { locale: ptBR }
                              )}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {format(new Date(order.date_created), "HH:mm", {
                                locale: ptBR,
                              })}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm text-gray-600 dark:text-gray-300">
                          {order.orderId.substring(0, 12)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">
                            {order.buyer_nickname}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-gray-100 dark:bg-gray-800"
                        >
                          <Package className="h-3 w-3 mr-1" />
                          {order.items_count}{" "}
                          {order.items_count === 1 ? "item" : "itens"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-red-600 dark:text-red-400">
                          {formatarReal(order.total_amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getCancellationRateBadge(
                            data.cancellationRate
                          )}
                        >
                          {order.cancellation_reason || "Não especificado"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
