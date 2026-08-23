"use client";

import React, { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaTrash, FaEdit, FaEye, FaLink, FaWarehouse } from "react-icons/fa";
import { AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { Produto } from "../types";
import { Button } from "@/components/ui/button";
import { DataTableCell, DataTableRow } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { CubeMark } from "@/components/brand/Logo";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InlineStockAdjust } from "./InlineStockAdjust";

interface ArmazemOption {
  id: string;
  nome: string;
}

interface ProdutoTableRowProps {
  produto: Produto;
  stockQuantity?: number;
  stockMinimum?: number;
  isLoadingStock: boolean;
  replenishmentStatus?: "ok" | "atencao" | "critico";
  armazens: ArmazemOption[];
  onDelete: (id: string) => void;
  onEdit: (produto: Produto) => void;
  onViewSuppliers: (produto: Produto) => void;
  onViewStock: (produto: Produto) => void;
  onViewReplenishment: (produto: Produto) => void;
  onStockAdjusted: () => void;
}

const STATUS_BORDER: Record<"ok" | "atencao" | "critico", string> = {
  critico: "border-l-[3px] border-l-destructive",
  atencao: "border-l-[3px] border-l-warning",
  ok: "border-l-[3px] border-l-transparent",
};

const actionButtonClass =
  "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent";

export const ProdutoTableRow = memo<ProdutoTableRowProps>(
  ({
    produto,
    stockQuantity,
    stockMinimum,
    isLoadingStock,
    replenishmentStatus,
    armazens,
    onDelete,
    onEdit,
    onViewSuppliers,
    onViewStock,
    onViewReplenishment,
    onStockAdjusted,
  }) => {
    const isCritical = replenishmentStatus === "critico";
    const isAttention = replenishmentStatus === "atencao";

    const getStockTone = () => {
      if (stockQuantity === undefined || stockQuantity === 0) return "critical";
      if (stockMinimum !== undefined && stockQuantity <= stockMinimum)
        return "warning";
      return "success";
    };

    return (
      <DataTableRow
        className={cn(
          "group",
          STATUS_BORDER[replenishmentStatus ?? "ok"]
        )}
      >
        <DataTableCell className="pl-4">
          {produto.imagemUrl ? (
            <div className="relative h-10 w-10 overflow-hidden rounded-md border border-border bg-muted">
              <Image
                src={produto.imagemUrl}
                alt={produto.nome}
                fill
                sizes="40px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted">
              <CubeMark className="h-5 w-5 opacity-40" />
            </div>
          )}
        </DataTableCell>

        <DataTableCell emphasis>
          <div className="flex items-center gap-2">
            {isCritical && (
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            )}
            {isAttention && !isCritical && (
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="truncate">{produto.nome}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {produto.sku}
              </p>
            </div>
          </div>
        </DataTableCell>

        <DataTableCell className="text-muted-foreground">
          {produto.fornecedorPrincipal ? (
            <span>
              {produto.fornecedorPrincipal.nome}
              {typeof produto.fornecedorPrincipal.prazoEntregaDias ===
                "number" &&
                ` · ${produto.fornecedorPrincipal.prazoEntregaDias} dias`}
            </span>
          ) : (
            <span className="text-sm">Sem fornecedor</span>
          )}
        </DataTableCell>

        <DataTableCell>
          {isLoadingStock ? (
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 animate-spin mr-1 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Carregando...</span>
            </div>
          ) : stockQuantity !== undefined ? (
            <div className="flex items-center gap-1">
              <StatusPill tone={getStockTone()}>{stockQuantity}</StatusPill>
              {stockMinimum !== undefined &&
                stockQuantity <= stockMinimum &&
                stockQuantity > 0 && (
                  <span title="Estoque abaixo do nível mínimo">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  </span>
                )}
              <InlineStockAdjust
                produtoId={produto.id}
                armazens={armazens}
                currentTotal={stockQuantity}
                onAdjusted={onStockAdjusted}
              />
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </DataTableCell>

        <DataTableCell numeric>
          {produto._mlEstoqueFull ? (
            <span className="font-medium text-info tabular-nums">
              {produto._mlEstoqueFull}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </DataTableCell>

        <DataTableCell numeric>
          {produto._mlTotalVendas ? (
            <span className="font-medium text-foreground tabular-nums">
              {produto._mlTotalVendas}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </DataTableCell>

        <DataTableCell className="text-muted-foreground">
          {produto.custoMedio ? formatBRL(produto.custoMedio) : "Não definido"}
        </DataTableCell>

        <DataTableCell className="pr-4 text-right">
          <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className={actionButtonClass}
              title="Ver ficha do produto"
            >
              <Link href={`/produtos/${produto.id}`}>
                <FaEye className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(produto)}
              className={actionButtonClass}
              title="Editar produto"
            >
              <FaEdit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewSuppliers(produto)}
              className={actionButtonClass}
              title="Fornecedores"
            >
              <FaLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewStock(produto)}
              className={actionButtonClass}
              title="Estoque por armazém"
            >
              <FaWarehouse className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewReplenishment(produto)}
              className={actionButtonClass}
              title="Sugestão de Reposição"
            >
              <TrendingUp className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(produto.id)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Excluir produto"
            >
              <FaTrash className="w-4 h-4" />
            </Button>
          </div>
        </DataTableCell>
      </DataTableRow>
    );
  },
  // Custom comparison function - only re-render if these props change
  (prevProps, nextProps) => {
    return (
      prevProps.produto.id === nextProps.produto.id &&
      prevProps.produto.nome === nextProps.produto.nome &&
      prevProps.produto.sku === nextProps.produto.sku &&
      prevProps.produto.imagemUrl === nextProps.produto.imagemUrl &&
      prevProps.produto.fornecedorPrincipal?.nome ===
        nextProps.produto.fornecedorPrincipal?.nome &&
      prevProps.produto.fornecedorPrincipal?.prazoEntregaDias ===
        nextProps.produto.fornecedorPrincipal?.prazoEntregaDias &&
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
