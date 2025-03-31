"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShoppingCart, Loader2 } from "lucide-react";
import Link from "next/link";

interface EstoqueCritico {
  id: string;
  nome: string;
  sku: string;
  quantidade: number;
  estoqueSeguranca: number;
  armazem: string;
}

interface EstoqueSegurancaCardProps {
  data: EstoqueCritico[];
  loading: boolean;
  searchTerm?: string;
  onRetry?: () => void;
}

const EstoqueSegurancaCard = ({
  data = [],
  loading = false,
  searchTerm = "",
  onRetry,
}: EstoqueSegurancaCardProps) => {
  // Filtrar dados quando searchTerm mudar
  const filteredData = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return data;
    }

    const term = searchTerm.toLowerCase();
    return data.filter(
      (item) =>
        item.nome.toLowerCase().includes(term) ||
        item.sku.toLowerCase().includes(term) ||
        item.armazem.toLowerCase().includes(term)
    );
  }, [searchTerm, data]);

  // Calcular o percentual de estoque em relação ao nível de segurança
  const calcularPercentual = (atual: number, seguranca: number) => {
    if (seguranca === 0) return 0;
    return Math.min((atual / seguranca) * 100, 100);
  };

  // Determinar a classe CSS baseada no percentual
  const getStatusClass = (percentual: number) => {
    if (percentual <= 30) return "bg-red-500";
    if (percentual <= 60) return "bg-orange-500";
    return "bg-yellow-500";
  };

  return (
    <div className="overflow-hidden">
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
            <AlertTriangle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">
            {searchTerm
              ? "Nenhum produto encontrado para a pesquisa"
              : "Nenhum produto em estoque crítico"}
          </h3>
          <p className="text-gray-500 mt-2">
            {searchTerm
              ? `Sua pesquisa por &quot;${searchTerm}&quot; não retornou resultados.`
              : "Todos os seus produtos estão com níveis de estoque adequados."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">SKU</TableHead>
                <TableHead className="text-center">Armazém</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => {
                const percentual = calcularPercentual(
                  item.quantidade,
                  item.estoqueSeguranca
                );
                const statusClass = getStatusClass(percentual);

                return (
                  <TableRow key={`${item.id}-${item.armazem}`}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{item.nome}</span>
                        <span className="text-xs text-gray-500">
                          {item.quantidade}/{item.estoqueSeguranca} unidades
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.sku}</TableCell>
                    <TableCell className="text-center">
                      {item.armazem}
                    </TableCell>
                    <TableCell>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full ${statusClass}`}
                          style={{ width: `${percentual}%` }}
                        ></div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/estoque/produtos/${item.id}/comprar`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center"
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          Comprar
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {filteredData.length > 0 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-500">
            Mostrando {filteredData.length} produto
            {filteredData.length !== 1 ? "s" : ""} em estoque crítico
            {searchTerm && (
              <span> para a pesquisa &quot;{searchTerm}&quot;</span>
            )}
          </div>
          <Link href="/estoque/produtos/comprar">
            <Button variant="default" className="flex items-center text-sm">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Fazer Pedido de Compra
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};

export default EstoqueSegurancaCard;
