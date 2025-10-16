// src/app/(root)/saidas/components/VendasMLList.tsx
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VendaML } from "../types";
import { VendaMLDetalhesDialog } from "./VendaMLDetalhesDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Calendar,
  ShoppingCart,
  DollarSign,
  User,
  Package,
  TrendingUp,
} from "lucide-react";

interface VendasMLListProps {
  vendas: VendaML[];
}

// Mapa de status para cores e labels
const statusConfig = {
  paid: {
    label: "Pago",
    color:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  },
  delivered: {
    label: "Entregue",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  },
  ready_to_ship: {
    label: "Pronto para Envio",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  },
  shipped: {
    label: "Enviado",
    color:
      "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  handling: {
    label: "Em Preparação",
    color:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  },
  confirmed: {
    label: "Confirmado",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  },
};

export function VendasMLList({ vendas }: VendasMLListProps) {
  const [selectedVenda, setSelectedVenda] = useState<VendaML | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Handle opening the details dialog
  const handleViewDetails = (venda: VendaML) => {
    setSelectedVenda(venda);
    setIsDetailsOpen(true);
  };

  // Count total items in a venda
  const countTotalItems = (venda: VendaML) => {
    return venda.items.reduce((acc, item) => acc + item.quantity, 0);
  };

  // Format currency
  const formatCurrency = (value: number, currency: string = "BRL") => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency,
    }).format(value);
  };

  // Get status config
  const getStatusConfig = (status: string) => {
    return (
      statusConfig[status as keyof typeof statusConfig] || {
        label: status,
        color:
          "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
      }
    );
  };

  // If there are no vendas, show a message
  if (!vendas || vendas.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-dashed border-gray-300 dark:border-gray-700">
        <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
          Nenhuma venda encontrada
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Não há vendas do Mercado Livre no período selecionado ou que
          correspondam aos critérios de busca.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
            <TableRow>
              <TableHead className="font-medium">Data</TableHead>
              <TableHead className="font-medium">Pedido</TableHead>
              <TableHead className="font-medium">Comprador</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead className="font-medium">Itens</TableHead>
              <TableHead className="font-medium text-right">Valor</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendas.map((venda) => {
              const statusInfo = getStatusConfig(venda.status);

              return (
                <TableRow
                  key={venda.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>
                        {format(new Date(venda.date_created), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                      {format(new Date(venda.date_created), "HH:mm", {
                        locale: ptBR,
                      })}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="font-mono text-sm">
                      {venda.orderId.substring(0, 12)}...
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-sm">
                          {venda.buyer.nickname}
                        </div>
                        {(venda.buyer.first_name || venda.buyer.last_name) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {venda.buyer.first_name} {venda.buyer.last_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      <Package className="h-3 w-3 mr-1" />
                      {countTotalItems(venda)}{" "}
                      {countTotalItems(venda) === 1 ? "item" : "itens"}
                    </Badge>
                    {venda.items.length > 1 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {venda.items.length} produtos
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(venda.total_amount, venda.currency_id)}
                      </span>
                    </div>
                    {venda.paid_amount !== venda.total_amount && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Pago:{" "}
                        {formatCurrency(venda.paid_amount, venda.currency_id)}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(venda)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/20"
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Details Dialog */}
      {selectedVenda && (
        <VendaMLDetalhesDialog
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          venda={selectedVenda}
        />
      )}
    </div>
  );
}
