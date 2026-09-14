// src/app/(root)/saidas/components/VendasMLList.tsx
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VendaML } from "../types";
import { VendaMLDetalhesDialog } from "./VendaMLDetalhesDialog";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Calendar,
  ShoppingCart,
  DollarSign,
  User,
  Package,
} from "lucide-react";

interface VendasMLListProps {
  vendas: VendaML[];
}

// Mapa de status para cores e labels
const statusConfig = {
  paid: {
    label: "Pago",
    color: "bg-success/10 text-success",
  },
  delivered: {
    label: "Entregue",
    color: "bg-success/10 text-success",
  },
  ready_to_ship: {
    label: "Pronto para Envio",
    color: "bg-warning/10 text-warning",
  },
  shipped: {
    label: "Enviado",
    color: "bg-info/10 text-info",
  },
  handling: {
    label: "Em Preparação",
    color: "bg-warning/10 text-warning",
  },
  confirmed: {
    label: "Confirmado",
    color: "bg-info/10 text-info",
  },
  cancelled: {
    label: "Cancelado",
    color: "bg-destructive/10 text-destructive",
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
          "bg-muted text-foreground",
      }
    );
  };

  // If there are no vendas, show a message
  if (!vendas || vendas.length === 0) {
    return (
      <div className="text-center py-12 bg-background rounded-md border border-dashed border-input">
        <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">
          Nenhuma venda encontrada
        </h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Não há vendas do Mercado Livre no período selecionado ou que
          correspondam aos critérios de busca.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-border rounded-md overflow-hidden">
        <DataTable>
          <DataTableHeader>
            <DataTableRow className="hover:bg-transparent">
              <DataTableHead className="pl-4">Data</DataTableHead>
              <DataTableHead>Pedido</DataTableHead>
              <DataTableHead>Comprador</DataTableHead>
              <DataTableHead>Status</DataTableHead>
              <DataTableHead>Itens</DataTableHead>
              <DataTableHead className="text-right">Valor</DataTableHead>
              <DataTableHead className="pr-4 text-right">Ações</DataTableHead>
            </DataTableRow>
          </DataTableHeader>
          <DataTableBody>
            {vendas.map((venda) => {
              const statusInfo = getStatusConfig(venda.status);

              return (
                <DataTableRow key={venda.id} className="group">
                  <DataTableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(venda.date_created), "dd/MM/yyyy", {
                          locale: ptBR,
                        })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground ml-6">
                      {format(new Date(venda.date_created), "HH:mm", {
                        locale: ptBR,
                      })}
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <div className="font-mono text-sm">
                      {venda.orderId.substring(0, 12)}...
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium text-sm">
                          {venda.buyer.nickname}
                        </div>
                        {(venda.buyer.first_name || venda.buyer.last_name) && (
                          <div className="text-xs text-muted-foreground">
                            {venda.buyer.first_name} {venda.buyer.last_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </DataTableCell>

                  <DataTableCell>
                    <Badge className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                  </DataTableCell>

                  <DataTableCell>
                    <Badge className="bg-info/10 text-info">
                      <Package className="h-3 w-3 mr-1" />
                      {countTotalItems(venda)}{" "}
                      {countTotalItems(venda) === 1 ? "item" : "itens"}
                    </Badge>
                    {venda.items.length > 1 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {venda.items.length} produtos
                      </div>
                    )}
                  </DataTableCell>

                  <DataTableCell numeric>
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-4 w-4 text-success" />
                      <span className="font-semibold text-success">
                        {formatCurrency(venda.total_amount, venda.currency_id)}
                      </span>
                    </div>
                    {venda.paid_amount !== venda.total_amount && (
                      <div className="text-xs text-muted-foreground">
                        Pago:{" "}
                        {formatCurrency(venda.paid_amount, venda.currency_id)}
                      </div>
                    )}
                  </DataTableCell>

                  <DataTableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(venda)}
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-muted-foreground hover:text-foreground hover:bg-accent"
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              );
            })}
          </DataTableBody>
        </DataTable>
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
