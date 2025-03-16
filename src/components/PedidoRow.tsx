"use client";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/utils/currency";

// UI Components
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Eye, MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import { Pedido } from "@/app/(root)/gestao-pedidos/types";

interface PedidoRowProps {
  pedido: Pedido;
  status: string;
  loadingAction: boolean;
  onViewDetails: () => void;
  onConfirm: () => void;
  onDelete: () => void;
  calcularValorPedido: (produtos: Pedido["produtos"]) => number;
}

export function PedidoRow({
  pedido,
  status,
  loadingAction,
  onViewDetails,
  onConfirm,
  onDelete,
  calcularValorPedido,
}: PedidoRowProps) {
  return (
    <TableRow className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
      <TableCell className="font-medium">#{pedido.id}</TableCell>
      <TableCell>{pedido.fornecedor.nome}</TableCell>
      <TableCell className="text-center">{pedido.produtos.length}</TableCell>
      <TableCell className="font-medium">
        {formatBRL(calcularValorPedido(pedido.produtos))}
      </TableCell>
      <TableCell>
        {(
          status === "pendente" ? pedido.dataPrevista : pedido.dataConclusao
        ) ? (
          format(
            new Date(
              status === "pendente"
                ? pedido.dataPrevista!
                : pedido.dataConclusao!
            ),
            "dd/MM/yyyy",
            { locale: ptBR }
          )
        ) : (
          <span className="text-gray-500 dark:text-gray-400">Não definida</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {loadingAction ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md"
            >
              <DropdownMenuItem
                onClick={onViewDetails}
                className="flex items-center cursor-pointer"
              >
                <Eye className="mr-2 h-4 w-4 text-indigo-500" /> Ver detalhes
              </DropdownMenuItem>

              {status === "pendente" && (
                <>
                  <DropdownMenuItem
                    onClick={onConfirm}
                    className="flex items-center cursor-pointer"
                  >
                    <Check className="mr-2 h-4 w-4 text-green-500" /> Confirmar
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={onDelete}
                    className="flex items-center cursor-pointer"
                  >
                    <Trash2 className="mr-2 h-4 w-4 text-red-500" /> Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}
