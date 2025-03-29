"use client";

import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { Loader2, RefreshCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PedidosTable from "@/components/PedidosTable";

interface EntradasSectionProps {
  dateRange: DateRange | undefined;
  searchTerm: string;
  onRefresh: () => void;
  loadingEntradas: boolean;
  summaryData: {
    entriesCount: number;
    entriesValue: number;
  };
}

export default function EntradasSection({
  dateRange,
  searchTerm,
  onRefresh,
  loadingEntradas,
  summaryData,
}: EntradasSectionProps) {
  return (
    <div>
      <div className="mb-4 flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold tracking-tight">
            Pedidos de Compra Concluídos
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loadingEntradas}
          >
            {loadingEntradas ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            <span className="ml-2">Atualizar</span>
          </Button>
        </div>
      </div>

      {loadingEntradas ? (
        <div className="h-[400px] w-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-md border">
          <PedidosTable
            status="confirmado"
            dateRange={dateRange}
            searchTerm={searchTerm}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  );
}
