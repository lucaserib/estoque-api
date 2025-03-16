"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/utils/currency";
import { useEffect } from "react";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Clock,
  Truck,
  Package,
  MessageSquare,
  CheckCircle2,
  CreditCard,
  X,
} from "lucide-react";
import { Pedido } from "@/app/(root)/gestao-pedidos/types";

interface PedidoDetalhesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pedido: Pedido;
  calcularValorPedido: (produtos: Pedido["produtos"]) => number;
}

export function PedidoDetalhesDialog({
  isOpen,
  onClose,
  pedido,
  calcularValorPedido,
}: PedidoDetalhesDialogProps) {
  // Valor total do pedido
  const valorTotal = calcularValorPedido(pedido.produtos);

  // Função auxiliar para exibir valores em reais (dividindo por 100)
  const exibirEmReais = (valorCentavos: number) => {
    return formatBRL(valorCentavos / 100);
  };

  // Cleanup para evitar recursão infinita quando o modal é fechado
  useEffect(() => {
    return () => {
      // Força o foco de volta para o documento quando o componente é desmontado
      if (!isOpen) {
        setTimeout(() => {
          document.body.focus();
        }, 0);
      }
    };
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          // Assegura que focamos em algo neutro antes de fechar
          document.body.focus();
          setTimeout(() => {
            onClose();
          }, 0);
        }
      }}
    >
      <DialogContent
        className="max-w-3xl max-h-[90vh] p-0 gap-0 bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl"
        onEscapeKeyDown={onClose}
        onInteractOutside={onClose}
        onPointerDownOutside={onClose}
        aria-describedby="dialog-description"
      >
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 border-b border-gray-200 dark:border-gray-800 rounded-t-xl">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                  <span className="text-indigo-600 dark:text-indigo-400 text-sm">
                    #
                  </span>
                </span>
                Pedido #{pedido.id}
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

        <ScrollArea className="max-h-[calc(90vh-11rem)]">
          <div className="p-6 pt-2" id="dialog-description">
            {/* Status Badge */}
            <div className="mb-4">
              <Badge
                className={`px-3 py-1 ${
                  pedido.status === "confirmado"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                }`}
              >
                {pedido.status === "confirmado" ? (
                  <CheckCircle2 className="mr-1 h-4 w-4" />
                ) : (
                  <Clock className="mr-1 h-4 w-4" />
                )}
                {pedido.status === "confirmado" ? "Concluído" : "Pendente"}
              </Badge>
            </div>

            {/* Informações gerais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Fornecedor:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {pedido.fornecedor.nome}
                  </span>
                </div>

                {pedido.dataPrevista && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Data prevista:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {format(new Date(pedido.dataPrevista), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}

                {pedido.dataConclusao && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Data de conclusão:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {format(new Date(pedido.dataConclusao), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Produtos:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {pedido.produtos.length} itens
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Valor total:
                  </span>
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {exibirEmReais(valorTotal)}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-400 mt-0.5" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Comentários:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {pedido.comentarios || (
                      <span className="text-gray-400 italic">
                        Nenhum comentário
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Tabela de produtos */}
            <div className="mb-4">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-500" />
                Lista de Produtos
              </h3>

              <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
                <Table>
                  <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
                    <TableRow>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400">
                        Produto
                      </TableHead>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400 text-right">
                        Qtd
                      </TableHead>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400 text-right">
                        Custo Unit.
                      </TableHead>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400 text-right">
                        Mult.
                      </TableHead>
                      <TableHead className="font-medium text-gray-500 dark:text-gray-400 text-right">
                        Subtotal
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pedido.produtos.map((produto) => {
                      const multiplicador =
                        produto.multiplicador ||
                        produto.produto?.multiplicador ||
                        1;
                      const subtotal =
                        produto.quantidade * produto.custo * multiplicador;

                      return (
                        <TableRow
                          key={produto.produtoId}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
                        >
                          <TableCell>
                            <div className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {produto.produto?.nome ||
                                "Produto não encontrado"}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              SKU: {produto.produto?.sku || "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {produto.quantidade}
                          </TableCell>
                          <TableCell className="text-right text-gray-600 dark:text-gray-300">
                            {exibirEmReais(produto.custo)}
                          </TableCell>
                          <TableCell className="text-right text-gray-600 dark:text-gray-300">
                            {multiplicador}x
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                            {exibirEmReais(subtotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {/* Linha do total */}
                    <TableRow className="bg-gray-50 dark:bg-gray-800/80 font-medium">
                      <TableCell
                        colSpan={4}
                        className="text-right text-gray-700 dark:text-gray-300"
                      >
                        Total do Pedido:
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
                        {exibirEmReais(valorTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="sticky bottom-0 bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 p-4 rounded-b-xl">
          <Button onClick={onClose} className="px-6">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
