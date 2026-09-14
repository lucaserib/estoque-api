// src/app/(root)/saidas/components/VendaMLDetalhesDialog.tsx
import Image from "next/image";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { VendaML } from "../types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import {
  X,
  Calendar,
  User,
  Package,
  DollarSign,
  Truck,
  CreditCard,
  ShoppingBag,
  Hash,
  MapPin,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface VendaMLDetalhesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  venda: VendaML;
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

export function VendaMLDetalhesDialog({
  isOpen,
  onClose,
  venda,
}: VendaMLDetalhesDialogProps) {
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

  // Calculate totals
  const totalItems = venda.items.reduce((sum, item) => sum + item.quantity, 0);
  const statusInfo = getStatusConfig(venda.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 bg-card/95 border border-border shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-card/90 border-b border-border rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <ShoppingBag className="h-5 w-5 text-primary" />
                Detalhes da Venda - Mercado Livre
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full border border-border"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-5rem)]">
          <div className="p-6 space-y-6">
            {/* Informações do Pedido */}
            <div className="bg-success/10 p-4 rounded-lg border border-success/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Hash className="h-4 w-4" />
                    Número do Pedido
                  </div>
                  <div className="font-mono font-semibold text-foreground">
                    {venda.orderId}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="h-4 w-4" />
                    Data da Venda
                  </div>
                  <div className="font-semibold text-foreground">
                    {format(
                      new Date(venda.date_created),
                      "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                      {
                        locale: ptBR,
                      }
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Package className="h-4 w-4" />
                    Status
                  </div>
                  <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    Valor Total
                  </div>
                  <div className="font-bold text-xl text-success">
                    {formatCurrency(venda.total_amount, venda.currency_id)}
                  </div>
                </div>
              </div>
            </div>

            {/* Informações do Comprador */}
            <div className="bg-background p-4 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Comprador
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-muted-foreground">
                    Usuário
                  </div>
                  <div className="font-medium text-foreground">
                    {venda.buyer.nickname}
                  </div>
                </div>
                {(venda.buyer.first_name || venda.buyer.last_name) && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Nome
                    </div>
                    <div className="font-medium text-foreground">
                      {venda.buyer.first_name} {venda.buyer.last_name}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-muted-foreground">
                    ID do Comprador
                  </div>
                  <div className="font-mono text-sm text-foreground">
                    {venda.buyer.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Informações de Envio */}
            {venda.shipping && (
              <div className="bg-background p-4 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-info" />
                  Envio
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {venda.shipping.status && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Status do Envio
                      </div>
                      <div className="font-medium text-foreground capitalize">
                        {venda.shipping.status.replace(/_/g, " ")}
                      </div>
                    </div>
                  )}
                  {venda.shipping.tracking_number && (
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Rastreamento
                      </div>
                      <div className="font-mono text-sm text-foreground">
                        {venda.shipping.tracking_number}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Informações de Pagamento */}
            {venda.payments && venda.payments.length > 0 && (
              <div className="bg-background p-4 rounded-lg border border-border">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Pagamento
                </h3>
                <div className="space-y-2">
                  {venda.payments.map((payment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="text-sm text-muted-foreground capitalize">
                        {payment.payment_type?.replace(/_/g, " ") || "N/A"}
                      </div>
                      <Badge
                        className={
                          payment.status === "approved"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }
                      >
                        {payment.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de Produtos */}
            <div>
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Produtos ({totalItems} {totalItems === 1 ? "item" : "itens"})
              </h3>

              <div className="border border-border rounded-lg overflow-hidden">
                <DataTable>
                  <DataTableHeader>
                    <DataTableRow className="hover:bg-transparent">
                      <DataTableHead className="pl-4">Produto</DataTableHead>
                      <DataTableHead>SKU Local</DataTableHead>
                      <DataTableHead>Quantidade</DataTableHead>
                      <DataTableHead className="text-right">Preço Unit.</DataTableHead>
                      <DataTableHead className="pr-4 text-right">Total</DataTableHead>
                    </DataTableRow>
                  </DataTableHeader>
                  <DataTableBody>
                    {venda.items.map((item) => (
                      <DataTableRow key={item.id}>
                        <DataTableCell className="pl-4">
                          <div className="flex items-start gap-3">
                            {item.thumbnail && (
                              <Image
                                src={item.thumbnail}
                                alt={item.title}
                                width={48}
                                height={48}
                                className="w-12 h-12 object-cover rounded border border-border"
                              />
                            )}
                            <div>
                              <div className="font-medium text-foreground">
                                {item.title}
                              </div>
                              {item.nomeProdutoLocal &&
                                item.nomeProdutoLocal !== item.title && (
                                  <div className="text-xs text-muted-foreground">
                                    Local: {item.nomeProdutoLocal}
                                  </div>
                                )}
                            </div>
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          {item.sku ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {item.sku}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Não vinculado
                            </span>
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          <Badge className="bg-info/10 text-info">{item.quantity}</Badge>
                        </DataTableCell>
                        <DataTableCell numeric>
                          {formatCurrency(item.unit_price, venda.currency_id)}
                        </DataTableCell>
                        <DataTableCell numeric emphasis className="pr-4">
                          {formatCurrency(item.total_price, venda.currency_id)}
                        </DataTableCell>
                      </DataTableRow>
                    ))}
                  </DataTableBody>
                </DataTable>
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="bg-success/10 p-4 rounded-lg border border-success/30">
              <div className="flex justify-between items-center">
                <div className="text-muted-foreground font-medium">
                  Valor Total da Venda
                </div>
                <div className="text-2xl font-bold text-success">
                  {formatCurrency(venda.total_amount, venda.currency_id)}
                </div>
              </div>
              {venda.paid_amount !== venda.total_amount && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-success/30">
                  <div className="text-sm text-muted-foreground">
                    Valor Pago
                  </div>
                  <div className="text-lg font-semibold text-success">
                    {formatCurrency(venda.paid_amount, venda.currency_id)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
