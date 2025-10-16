// src/app/(root)/saidas/components/VendaMLDetalhesDialog.tsx
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
          "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
      }
    );
  };

  // Calculate totals
  const totalItems = venda.items.reduce((sum, item) => sum + item.quantity, 0);
  const statusInfo = getStatusConfig(venda.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl backdrop-blur-md">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <ShoppingBag className="h-5 w-5 text-green-500" />
                Detalhes da Venda - Mercado Livre
              </DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full border border-gray-200 dark:border-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="max-h-[calc(90vh-5rem)]">
          <div className="p-6 space-y-6">
            {/* Informações do Pedido */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Hash className="h-4 w-4" />
                    Número do Pedido
                  </div>
                  <div className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {venda.orderId}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Calendar className="h-4 w-4" />
                    Data da Venda
                  </div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
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
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <Package className="h-4 w-4" />
                    Status
                  </div>
                  <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                    <DollarSign className="h-4 w-4" />
                    Valor Total
                  </div>
                  <div className="font-bold text-xl text-green-600 dark:text-green-400">
                    {formatCurrency(venda.total_amount, venda.currency_id)}
                  </div>
                </div>
              </div>
            </div>

            {/* Informações do Comprador */}
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-500" />
                Comprador
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Usuário
                  </div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {venda.buyer.nickname}
                  </div>
                </div>
                {(venda.buyer.first_name || venda.buyer.last_name) && (
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Nome
                    </div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {venda.buyer.first_name} {venda.buyer.last_name}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    ID do Comprador
                  </div>
                  <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                    {venda.buyer.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Informações de Envio */}
            {venda.shipping && (
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-500" />
                  Envio
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {venda.shipping.status && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Status do Envio
                      </div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {venda.shipping.status.replace(/_/g, " ")}
                      </div>
                    </div>
                  )}
                  {venda.shipping.tracking_number && (
                    <div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Rastreamento
                      </div>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                        {venda.shipping.tracking_number}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Informações de Pagamento */}
            {venda.payments && venda.payments.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                  Pagamento
                </h3>
                <div className="space-y-2">
                  {venda.payments.map((payment, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                        {payment.payment_type?.replace(/_/g, " ") || "N/A"}
                      </div>
                      <Badge
                        className={
                          payment.status === "approved"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
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
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-500" />
                Produtos ({totalItems} {totalItems === 1 ? "item" : "itens"})
              </h3>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                    <TableRow>
                      <TableHead className="font-medium">Produto</TableHead>
                      <TableHead className="font-medium text-center">
                        SKU Local
                      </TableHead>
                      <TableHead className="font-medium text-center">
                        Quantidade
                      </TableHead>
                      <TableHead className="font-medium text-right">
                        Preço Unit.
                      </TableHead>
                      <TableHead className="font-medium text-right">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {venda.items.map((item) => (
                      <TableRow
                        key={item.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <TableCell>
                          <div className="flex items-start gap-3">
                            {item.thumbnail && (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-gray-700"
                              />
                            )}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {item.title}
                              </div>
                              {item.nomeProdutoLocal &&
                                item.nomeProdutoLocal !== item.title && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Local: {item.nomeProdutoLocal}
                                  </div>
                                )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.sku ? (
                            <Badge
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              {item.sku}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Não vinculado
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {item.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.unit_price, venda.currency_id)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(item.total_price, venda.currency_id)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex justify-between items-center">
                <div className="text-gray-600 dark:text-gray-400 font-medium">
                  Valor Total da Venda
                </div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(venda.total_amount, venda.currency_id)}
                </div>
              </div>
              {venda.paid_amount !== venda.total_amount && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Valor Pago
                  </div>
                  <div className="text-lg font-semibold text-green-600 dark:text-green-400">
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
