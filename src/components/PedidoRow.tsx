"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/utils/currency";

// UI Components
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Check,
  Eye,
  MoreHorizontal,
  Trash2,
  Loader2,
  Calendar,
  Package,
  Truck,
} from "lucide-react";
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
  const [isHovered, setIsHovered] = useState(false);

  // Formatar data
  const formattedDate = (
    status === "pendente" ? pedido.dataPrevista : pedido.dataConclusao
  ) ? (
    format(
      new Date(
        status === "pendente" ? pedido.dataPrevista! : pedido.dataConclusao!
      ),
      "dd/MM/yyyy",
      { locale: ptBR }
    )
  ) : (
    <span className="text-gray-500 dark:text-gray-400 text-sm italic">
      Não definida
    </span>
  );

  const valorTotal = calcularValorPedido(pedido.produtos);

  return (
    <TableRow
      className={`
        group transition-all duration-150 
        ${isHovered ? "bg-gray-50 dark:bg-gray-800/70" : ""}
        hover:bg-gray-50 dark:hover:bg-gray-800/70
        border-b border-gray-100 dark:border-gray-800
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <TableCell className="font-medium">
        <div className="flex items-center">
          <span
            className={`
            text-indigo-600 dark:text-indigo-400
            ${isHovered ? "scale-110" : ""}
            transition-transform duration-200
          `}
          >
            #{pedido.id}
          </span>
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-gray-400" />
          <span
            className="truncate max-w-[180px]"
            title={pedido.fornecedor.nome}
          >
            {pedido.fornecedor.nome}
          </span>
        </div>
      </TableCell>

      <TableCell className="text-center">
        <Badge variant="outline" className="bg-gray-50 dark:bg-gray-800">
          <Package className="w-3 h-3 mr-1" />
          {pedido.produtos.length}
        </Badge>
      </TableCell>

      <TableCell className="font-medium">
        <span className="text-green-600 dark:text-green-400">
          {formatBRL(valorTotal)}
        </span>
      </TableCell>

      <TableCell>
        <div className="flex items-center gap-1">
          <Calendar className="w-4 h-4 text-gray-400" />
          {formattedDate}
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div className="flex justify-end">
          {status === "pendente" ? (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewDetails}
                className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
              >
                <Eye className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onConfirm}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50"
              >
                <Check className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDetails}
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
