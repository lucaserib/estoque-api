"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Saida } from "../types";
import { SaidaDetalhesDialog } from "./SaidaDetalhesDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Calendar,
  Package,
  Truck,
  Warehouse,
  AlertTriangle,
} from "lucide-react";

interface SaidaListProps {
  saidas: Saida[];
}

export function SaidaList({ saidas }: SaidaListProps) {
  const [selectedSaida, setSelectedSaida] = useState<Saida | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Handle opening the details dialog
  const handleViewDetails = (saida: Saida) => {
    setSelectedSaida(saida);
    setIsDetailsOpen(true);
  };

  // Function to count total items in a saida
  const countTotalItems = (saida: Saida) => {
    return saida.detalhes.reduce((acc, detalhe) => acc + detalhe.quantidade, 0);
  };

  // If there are no saidas, show a message
  if (!saidas || saidas.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-dashed border-gray-300 dark:border-gray-700">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">
          Nenhuma saída registrada
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
          Não há registros de saída no período selecionado. Use o botão "Nova
          Saída" para registrar a movimentação de produtos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader className="bg-gray-50 dark:bg-gray-800/50">
            <TableRow>
              <TableHead className="font-medium">Data</TableHead>
              <TableHead className="font-medium">Armazém</TableHead>
              <TableHead className="font-medium">Itens</TableHead>
              <TableHead className="font-medium">Detalhes</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {saidas.map((saida) => (
              <TableRow
                key={saida.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group"
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span>
                      {format(new Date(saida.data), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{saida.armazem.nome}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {countTotalItems(saida)} itens
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {saida.detalhes.slice(0, 2).map((detalhe) => (
                      <Badge
                        key={detalhe.id}
                        variant="outline"
                        className="bg-gray-50 dark:bg-gray-800"
                      >
                        {detalhe.isKit && <Package className="h-3 w-3 mr-1" />}
                        {detalhe.produto.sku} ({detalhe.quantidade})
                      </Badge>
                    ))}
                    {saida.detalhes.length > 2 && (
                      <Badge
                        variant="outline"
                        className="bg-gray-50 dark:bg-gray-800"
                      >
                        +{saida.detalhes.length - 2} itens
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetails(saida)}
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Details Dialog */}
      {selectedSaida && (
        <SaidaDetalhesDialog
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          saida={selectedSaida}
        />
      )}
    </div>
  );
}
