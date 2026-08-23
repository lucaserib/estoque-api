"use client";

import { memo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { DataTableCell, DataTableRow } from "@/components/ui/data-table";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ShoppingCart,
  Truck,
  TrendingUp,
} from "lucide-react";

interface ReplenishmentItem {
  produtoId: string;
  produtoNome: string;
  sku: string;
  custoMedio: number;
  tipoAnuncio: "full" | "local" | "ambos";
  estoqueLocal: number;
  estoqueFull: number;
  estoqueTotal: number;
  mediaVendasPeriodo: number;
  mediaDiaria: number;
  analysisPeriodDays: number;
  statusGeral: "ok" | "atencao" | "critico";
  reposicaoFull: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number;
  } | null;
  reposicaoLocal: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number;
  };
  custoTotalReposicao: number;
  custoIndefinido: boolean;
}

interface ReplenishmentTableRowProps {
  item: ReplenishmentItem;
  onViewDetails: (produtoId: string) => void;
}

const STATUS_BORDER: Record<"ok" | "atencao" | "critico", string> = {
  critico: "border-l-[3px] border-l-destructive",
  atencao: "border-l-[3px] border-l-warning",
  ok: "border-l-[3px] border-l-transparent",
};

export const ReplenishmentTableRow = memo<ReplenishmentTableRowProps>(
  ({ item, onViewDetails }) => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value / 100);
    };

    const getStatusPill = (status: "ok" | "atencao" | "critico") => {
      switch (status) {
        case "critico":
          return (
            <StatusPill tone="critical" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Crítico
            </StatusPill>
          );
        case "atencao":
          return (
            <StatusPill tone="warning" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Atenção
            </StatusPill>
          );
        default:
          return (
            <StatusPill tone="success" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              OK
            </StatusPill>
          );
      }
    };

    const getTipoAnuncioBadge = (tipo: "full" | "local" | "ambos") => {
      switch (tipo) {
        case "full":
          return (
            <Badge variant="outline" className="text-info border-info/40">
              Full
            </Badge>
          );
        case "local":
          return (
            <Badge
              variant="outline"
              className="text-muted-foreground border-border"
            >
              Local
            </Badge>
          );
        case "ambos":
          return (
            <Badge variant="outline" className="text-primary border-primary/40">
              Full + Local
            </Badge>
          );
      }
    };

    const diasRestantesMenor = Math.min(
      item.reposicaoLocal.diasRestantes,
      item.reposicaoFull?.diasRestantes || 999
    );

    return (
      <DataTableRow className={STATUS_BORDER[item.statusGeral]}>
        <DataTableCell className="pl-4">
          {getStatusPill(item.statusGeral)}
        </DataTableCell>

        <DataTableCell sticky>
          <p className="font-medium text-foreground">{item.produtoNome}</p>
          <p className="text-sm text-muted-foreground">SKU: {item.sku}</p>
        </DataTableCell>

        <DataTableCell>{getTipoAnuncioBadge(item.tipoAnuncio)}</DataTableCell>

        <DataTableCell numeric>
          <span className="font-medium text-foreground">
            {item.estoqueLocal}
          </span>
        </DataTableCell>

        <DataTableCell numeric>
          <span className="font-medium text-info">
            {item.estoqueFull > 0 ? item.estoqueFull : "-"}
          </span>
        </DataTableCell>

        <DataTableCell numeric>
          <span
            className={
              diasRestantesMenor < 3
                ? "font-bold text-destructive"
                : diasRestantesMenor < 7
                ? "font-bold text-warning"
                : "font-bold text-foreground"
            }
          >
            {diasRestantesMenor > 999 ? "∞" : `${diasRestantesMenor}d`}
          </span>
        </DataTableCell>

        <DataTableCell numeric>
          <div className="flex items-center justify-end gap-1">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {item.mediaDiaria.toFixed(1)}
            </span>
          </div>
        </DataTableCell>

        <DataTableCell numeric>
          {item.reposicaoFull?.necessaria ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <Truck className="h-3 w-3 text-info" />
                <span className="font-medium text-info">
                  {item.reposicaoFull.quantidadeSugerida}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(item.reposicaoFull.custoTotal * 100)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </DataTableCell>

        <DataTableCell numeric>
          {item.reposicaoLocal.necessaria ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3 text-warning" />
                <span className="font-medium text-warning">
                  {item.reposicaoLocal.quantidadeSugerida}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatCurrency(item.reposicaoLocal.custoTotal * 100)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </DataTableCell>

        <DataTableCell numeric>
          {item.custoIndefinido ? (
            <Link
              href={`/produtos/${item.produtoId}`}
              className="text-sm text-warning underline underline-offset-2"
            >
              Custo não definido
            </Link>
          ) : (
            <span className="font-bold text-foreground">
              {formatCurrency(item.custoTotalReposicao * 100)}
            </span>
          )}
        </DataTableCell>

        <DataTableCell className="pr-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(item.produtoId)}
            className="text-xs"
          >
            Detalhes
          </Button>
        </DataTableCell>
      </DataTableRow>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.item.produtoId === nextProps.item.produtoId;
  }
);

ReplenishmentTableRow.displayName = "ReplenishmentTableRow";
