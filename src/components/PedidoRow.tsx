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
  Check,
  Eye,
  Trash2,
  Calendar,
  Package,
  Truck,
  Loader2,
  FileDown,
} from "lucide-react";
import { Pedido } from "@/app/(root)/gestao-pedidos/types";
import { generatePedidoPDF } from "@/utils/pdf";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

interface PedidoRowProps {
  pedido: Pedido;
  status: string;
  loadingAction: boolean;
  onViewDetails: () => void;
  onConfirm: () => void;
  onDelete: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  calcularValorPedido: (produtos: Pedido["produtos"]) => number;
}

export function PedidoRow({
  pedido,
  status,
  loadingAction,
  onViewDetails,
  onConfirm,
  onDelete,
  isSelected,
  onToggleSelect,
  calcularValorPedido,
}: PedidoRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleDownloadPDF = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);

    try {
      await generatePedidoPDF(pedido);
      toast.success(`PDF do Pedido #${pedido.id} gerado com sucesso!`);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Erro ao gerar PDF. Por favor, tente novamente.");
    } finally {
      setIsDownloading(false);
    }
  };
  return (
    <TableRow
      className={`
        group transition-all duration-150 
        ${isHovered ? "bg-gray-50 dark:bg-gray-800/70" : ""}
        ${isSelected ? "bg-indigo-50 dark:bg-indigo-900/20" : ""}
        hover:bg-gray-50 dark:hover:bg-gray-800/70
        border-b border-gray-100 dark:border-gray-800
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Coluna de seleção (opcional) */}
      {onToggleSelect && (
        <TableCell className="w-10 pr-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0"
          />
        </TableCell>
      )}

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
          {pedido.produtos && Array.isArray(pedido.produtos)
            ? pedido.produtos.length
            : 0}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onViewDetails}
                      className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver detalhes</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onConfirm}
                      className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/50"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Confirmar pedido</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onDelete}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Excluir pedido</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ) : (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onViewDetails}
                      className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ver detalhes</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDownloadPDF}
                      disabled={isDownloading}
                      className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
                    >
                      {isDownloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Baixar PDF</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

const calcularValorPedido = (produtos: Pedido["produtos"]) => {
  if (!produtos || !Array.isArray(produtos)) return 0;

  return produtos.reduce((total, produto) => {
    if (!produto) return total;

    const quantidade = produto.quantidade || 0;
    const custo = produto.custo || 0;
    const multiplicador =
      produto.multiplicador ||
      (produto.produto && produto.produto.multiplicador) ||
      1;

    const valor = quantidade * custo * multiplicador;
    return total + valor;
  }, 0);
};
