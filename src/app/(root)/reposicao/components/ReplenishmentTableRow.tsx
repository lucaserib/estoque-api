"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, CheckCircle, ShoppingCart, Truck, TrendingUp } from "lucide-react";

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
}

interface ReplenishmentTableRowProps {
  item: ReplenishmentItem;
  onViewDetails: (produtoId: string) => void;
}

export const ReplenishmentTableRow = memo<ReplenishmentTableRowProps>(
  ({ item, onViewDetails }) => {
    const formatCurrency = (value: number) => {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value / 100);
    };

    const getStatusBadge = (status: "ok" | "atencao" | "critico") => {
      switch (status) {
        case "critico":
          return (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Crítico
            </Badge>
          );
        case "atencao":
          return (
            <Badge className="gap-1 bg-yellow-500 hover:bg-yellow-600 text-white">
              <AlertTriangle className="h-3 w-3" />
              Atenção
            </Badge>
          );
        default:
          return (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3" />
              OK
            </Badge>
          );
      }
    };

    const getTipoAnuncioBadge = (tipo: "full" | "local" | "ambos") => {
      switch (tipo) {
        case "full":
          return (
            <Badge variant="outline" className="text-blue-600 border-blue-600">
              Full
            </Badge>
          );
        case "local":
          return (
            <Badge variant="outline" className="text-gray-600 border-gray-600">
              Local
            </Badge>
          );
        case "ambos":
          return (
            <Badge variant="outline" className="text-purple-600 border-purple-600">
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
      <tr
        className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
          item.statusGeral === "critico"
            ? "bg-red-50 dark:bg-red-950/20"
            : item.statusGeral === "atencao"
            ? "bg-yellow-50 dark:bg-yellow-950/20"
            : ""
        }`}
      >
        {/* Status */}
        <td className="px-4 py-3">
          {getStatusBadge(item.statusGeral)}
        </td>

        {/* Produto */}
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {item.produtoNome}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              SKU: {item.sku}
            </p>
          </div>
        </td>

        {/* Tipo */}
        <td className="px-4 py-3">
          {getTipoAnuncioBadge(item.tipoAnuncio)}
        </td>

        {/* Estoque Local */}
        <td className="px-4 py-3 text-center">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {item.estoqueLocal}
          </span>
        </td>

        {/* Estoque Full */}
        <td className="px-4 py-3 text-center">
          <span className="font-medium text-blue-600 dark:text-blue-400">
            {item.estoqueFull > 0 ? item.estoqueFull : "-"}
          </span>
        </td>

        {/* Dias Restantes */}
        <td className="px-4 py-3 text-center">
          <span
            className={`font-bold ${
              diasRestantesMenor < 3
                ? "text-red-600 dark:text-red-400"
                : diasRestantesMenor < 7
                ? "text-yellow-600 dark:text-yellow-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {diasRestantesMenor > 999 ? "∞" : `${diasRestantesMenor}d`}
          </span>
        </td>

        {/* Média Diária */}
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <TrendingUp className="h-3 w-3 text-gray-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {item.mediaDiaria.toFixed(1)}
            </span>
          </div>
        </td>

        {/* Repor Full */}
        <td className="px-4 py-3 text-center">
          {item.reposicaoFull?.necessaria ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <Truck className="h-3 w-3 text-blue-600" />
                <span className="font-medium text-blue-900 dark:text-blue-300">
                  {item.reposicaoFull.quantidadeSugerida}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {formatCurrency(item.reposicaoFull.custoTotal * 100)}
              </span>
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>

        {/* Comprar Local */}
        <td className="px-4 py-3 text-center">
          {item.reposicaoLocal.necessaria ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-1">
                <ShoppingCart className="h-3 w-3 text-orange-600" />
                <span className="font-medium text-orange-900 dark:text-orange-300">
                  {item.reposicaoLocal.quantidadeSugerida}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {formatCurrency(item.reposicaoLocal.custoTotal * 100)}
              </span>
            </div>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>

        {/* Custo Total */}
        <td className="px-4 py-3 text-right">
          <span className="font-bold text-purple-900 dark:text-purple-300">
            {formatCurrency(item.custoTotalReposicao * 100)}
          </span>
        </td>

        {/* Ações */}
        <td className="px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(item.produtoId)}
            className="text-xs"
          >
            Detalhes
          </Button>
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.item.produtoId === nextProps.item.produtoId;
  }
);

ReplenishmentTableRow.displayName = "ReplenishmentTableRow";
