"use client";

import { useState, useEffect } from "react";
import Header from "@/app/components/Header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  PlusCircle,
  RefreshCw,
  Search,
  AlertCircle,
  Package,
  CalendarDays,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/DatePickerWithRange";
import { DateRange } from "react-day-picker";
import { Saida } from "./types";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFetch } from "@/app/hooks/useFetch";
import { SaidaLoadingSkeleton } from "./components/SaidaLoadingSkeleton";
import { SaidaList } from "./components/SaidaList";
import { NovaSaidaDialog } from "./components/NovaSaidaDialog";

// Main component for the Saidas page
const SaidasPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  // Fetch saidas data
  const {
    data: saidas,
    loading,
    error,
    refetch,
  } = useFetch<Saida[]>("/api/saida", undefined, [refreshTrigger]);

  // Filter saidas based on search term and date range
  const filteredSaidas = (saidas || []).filter((saida) => {
    // Filter by search term
    const matchesSearch =
      searchTerm === "" ||
      saida.armazem.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      saida.detalhes.some(
        (detalhe) =>
          detalhe.produto.nome
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          detalhe.produto.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );

    // Filter by date range
    const saidaDate = new Date(saida.data);
    const isInDateRange =
      !dateRange?.from ||
      !dateRange?.to ||
      (saidaDate >= dateRange.from && saidaDate <= dateRange.to);

    return matchesSearch && isInDateRange;
  });

  // Handle successful creation of new saida
  const handleSaveSuccess = () => {
    setShowCreateModal(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  // Calculate summary metrics
  const totalSaidas = filteredSaidas.length;
  const totalItens = filteredSaidas.reduce(
    (sum, saida) =>
      sum +
      saida.detalhes.reduce(
        (itemSum, detalhe) => itemSum + detalhe.quantidade,
        0
      ),
    0
  );

  return (
    <div className="container max-w-screen-xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex justify-between items-center">
          <div>
            <Header name="Registro de Saídas" />
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Gerencie todas as saídas de produtos e kits do seu estoque
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-700 dark:hover:bg-indigo-600 gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Saída</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center">
              <div className="p-4 md:p-6 flex-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total de Saídas
                </p>
                <div className="mt-2 flex items-center">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {loading ? "-" : totalSaidas}
                  </h3>
                </div>
              </div>
              <div className="h-full w-2 bg-blue-500"></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center">
              <div className="p-4 md:p-6 flex-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total de Itens
                </p>
                <div className="mt-2 flex items-center">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {loading ? "-" : totalItens}
                  </h3>
                </div>
              </div>
              <div className="h-full w-2 bg-green-500"></div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center">
              <div className="p-4 md:p-6 flex-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Período
                </p>
                <div className="mt-2 flex items-center">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {dateRange?.from && dateRange?.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })}{" "}
                        - {format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                      </>
                    ) : (
                      "Todos os períodos"
                    )}
                  </h3>
                </div>
              </div>
              <div className="h-full w-2 bg-amber-500"></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Input
                  placeholder="Buscar produto, armazém..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                />
              </div>
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
                className="min-w-[280px]"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="h-10 border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5 text-indigo-500" />
            Lista de Saídas
          </CardTitle>
          <CardDescription>
            {filteredSaidas.length}{" "}
            {filteredSaidas.length === 1 ? "registro" : "registros"} encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : loading ? (
            <SaidaLoadingSkeleton />
          ) : (
            <SaidaList saidas={filteredSaidas} />
          )}
        </CardContent>
      </Card>

      {/* Modal for creating new saida */}
      {showCreateModal && (
        <NovaSaidaDialog
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveSuccess}
        />
      )}
    </div>
  );
};

export default SaidasPage;
