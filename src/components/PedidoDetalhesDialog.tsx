"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/utils/currency";

// UI Components
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <span className="h-6 w-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <span className="text-indigo-600 dark:text-indigo-400 text-sm">
                #
              </span>
            </span>
            Detalhes do Pedido #{pedido.id}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Fornecedor:</span>{" "}
              {pedido.fornecedor.nome}
            </div>
            <div>
              <span className="font-semibold">Status:</span>{" "}
              <Badge
                variant={pedido.status === "confirmado" ? "success" : "warning"}
              >
                {pedido.status === "confirmado" ? "Concluído" : "Pendente"}
              </Badge>
            </div>
            {pedido.dataPrevista && (
              <div>
                <span className="font-semibold">Data prevista:</span>{" "}
                {format(new Date(pedido.dataPrevista), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </div>
            )}
            {pedido.dataConclusao && (
              <div>
                <span className="font-semibold">Data de conclusão:</span>{" "}
                {format(new Date(pedido.dataConclusao), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <div>
              <span className="font-semibold">Comentários:</span>{" "}
              {pedido.comentarios || (
                <span className="text-gray-400">Nenhum comentário</span>
              )}
            </div>
            <div>
              <span className="font-semibold">Valor total:</span>{" "}
              {formatBRL(calcularValorPedido(pedido.produtos))}
            </div>
          </div>
        </div>

        <Card className="w-full border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-100 dark:bg-gray-800">
                <TableRow>
                  <TableHead className="font-medium">Produto</TableHead>
                  <TableHead className="font-medium text-right">
                    Quantidade
                  </TableHead>
                  <TableHead className="font-medium text-right">
                    Custo Unitário
                  </TableHead>
                  <TableHead className="font-medium text-right">
                    Multiplicador
                  </TableHead>
                  <TableHead className="font-medium text-right">
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
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <TableCell>
                        <div className="font-medium">
                          {produto.produto?.nome || "Produto não encontrado"}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          SKU: {produto.produto?.sku || "N/A"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {produto.quantidade}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBRL(produto.custo)}
                      </TableCell>
                      <TableCell className="text-right">
                        {multiplicador}x
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatBRL(subtotal)}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Linha do total */}
                <TableRow className="bg-gray-50 dark:bg-gray-900/50 font-medium">
                  <TableCell colSpan={4} className="text-right">
                    Valor Total:
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatBRL(calcularValorPedido(pedido.produtos))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
