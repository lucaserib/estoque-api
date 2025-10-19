"use client";

import React, { memo } from "react";
import { FaTrash, FaEdit, FaEye, FaLink, FaWarehouse } from "react-icons/fa";
import { AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { Produto } from "../types";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ProdutoTableRowProps {
  produto: Produto;
  stockQuantity?: number;
  stockMinimum?: number;
  isLoadingStock: boolean;
  replenishmentStatus?: "ok" | "atencao" | "critico";
  onDelete: (id: string) => void;
  onViewDetails: (produto: Produto) => void;
  onEdit: (produto: Produto) => void;
  onViewSuppliers: (produto: Produto) => void;
  onViewStock: (produto: Produto) => void;
  onViewReplenishment: (produto: Produto) => void;
}

/**
 * Memoized table row component for produtos
 * Only re-renders when props actually change
 */
export const ProdutoTableRow = memo<ProdutoTableRowProps>(
  ({
    produto,
    stockQuantity,
    stockMinimum,
    isLoadingStock,
    replenishmentStatus,
    onDelete,
    onViewDetails,
    onEdit,
    onViewSuppliers,
    onViewStock,
    onViewReplenishment,
  }) => {
    const isCritical = replenishmentStatus === "critico";
    const isAttention = replenishmentStatus === "atencao";

    const getStockBadgeColor = () => {
      if (stockQuantity === undefined || stockQuantity === 0) {
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      }
      if (stockMinimum !== undefined && stockQuantity <= stockMinimum) {
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
      }
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    };

    const getRowClassName = () => {
      if (isCritical) {
        return "bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50 dark:hover:bg-red-950/30";
      }
      if (isAttention) {
        return "bg-yellow-50/50 dark:bg-yellow-950/20 hover:bg-yellow-100/50 dark:hover:bg-yellow-950/30";
      }
      return "hover:bg-gray-50 dark:hover:bg-gray-800/50";
    };

    return (
      <TableRow className={`group ${getRowClassName()}`}>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {isCritical && (
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            )}
            {isAttention && !isCritical && (
              <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            )}
            <span>{produto.nome}</span>
          </div>
        </TableCell>

        <TableCell className="text-gray-600 dark:text-gray-300">
          {produto.sku}
        </TableCell>

        <TableCell>
          {isLoadingStock ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-1 text-gray-400" />
              <span className="text-xs text-gray-400">Carregando...</span>
            </div>
          ) : stockQuantity !== undefined ? (
            <div className="flex items-center gap-1">
              <Badge className={getStockBadgeColor()}>{stockQuantity}</Badge>
              {stockMinimum !== undefined &&
                stockQuantity <= stockMinimum &&
                stockQuantity > 0 && (
                  <span title="Estoque abaixo do nível mínimo">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </span>
                )}
            </div>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </TableCell>

        <TableCell>
          {produto._mlEstoqueFull ? (
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              {produto._mlEstoqueFull}
            </Badge>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </TableCell>

        <TableCell>
          {produto._mlTotalVendas ? (
            <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {produto._mlTotalVendas}
            </Badge>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </TableCell>

        <TableCell className="text-gray-600 dark:text-gray-300">
          {produto.custoMedio
            ? `R$ ${(produto.custoMedio / 100).toFixed(2)}`
            : "Não Definido"}
        </TableCell>

        <TableCell className="text-right">
          <div className="flex justify-end items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(produto)}
              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              <FaEye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(produto)}
              className="h-8 w-8 p-0 text-green-600 hover:text-green-800 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
            >
              <FaEdit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewSuppliers(produto)}
              className="h-8 w-8 p-0 text-purple-600 hover:text-purple-800 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20"
            >
              <FaLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewStock(produto)}
              className="h-8 w-8 p-0 text-orange-600 hover:text-orange-800 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
            >
              <FaWarehouse className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewReplenishment(produto)}
              className="h-8 w-8 p-0 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
              title="Sugestão de Reposição"
            >
              <TrendingUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(produto.id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-800 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              <FaTrash className="w-4 h-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  },
  // Custom comparison function - only re-render if these props change
  (prevProps, nextProps) => {
    return (
      prevProps.produto.id === nextProps.produto.id &&
      prevProps.produto.nome === nextProps.produto.nome &&
      prevProps.produto.sku === nextProps.produto.sku &&
      prevProps.produto.custoMedio === nextProps.produto.custoMedio &&
      prevProps.produto._mlEstoqueFull === nextProps.produto._mlEstoqueFull &&
      prevProps.produto._mlTotalVendas === nextProps.produto._mlTotalVendas &&
      prevProps.stockQuantity === nextProps.stockQuantity &&
      prevProps.stockMinimum === nextProps.stockMinimum &&
      prevProps.isLoadingStock === nextProps.isLoadingStock &&
      prevProps.replenishmentStatus === nextProps.replenishmentStatus
    );
  }
);

ProdutoTableRow.displayName = "ProdutoTableRow";
