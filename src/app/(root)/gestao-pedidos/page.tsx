"use client";

import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import Header from "@/app/components/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PedidosTable from "@/components/PedidosTable";

import {
  Plus,
  Download,
  Search,
  CheckCircle2,
  Clock,
  ShoppingCart,
} from "lucide-react";
import NovoPedidoForm from "./components/NovoPedidoForm";
import { DatePickerWithRange } from "@/components/ui/DatePickerWithRange";

interface PedidoFilter {
  dateRange: DateRange | undefined;
  searchTerm: string;
}

interface PedidosStats {
  pendentes: number;
  concluidos: number;
  valorTotal: number;
}

const GestaoPedidos = () => {
  const [activeTab, setActiveTab] = useState<string>("concluidos"); // Começa com concluídos
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [stats, setStats] = useState<PedidosStats>({
    pendentes: 0,
    concluidos: 0,
    valorTotal: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Estado para filtros
  const [filter, setFilter] = useState<PedidoFilter>({
    dateRange: undefined,
    searchTerm: "",
  });

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoadingStats(true);
      try {
        const response = await fetch("/api/pedidos-compra/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Erro ao carregar estatísticas:", error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, []);

  const handleFilterChange = (partialFilter: Partial<PedidoFilter>) => {
    setFilter({ ...filter, ...partialFilter });
  };

  const handleExport = () => {
    // Implementação da exportação (CSV, PDF, etc.)
    console.log("Exportando dados...");
  };

  return (
    <div className="container max-w-screen-xl mx-auto p-4 md:p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex justify-between items-center">
          <div>
            <Header name="Gestão de Pedidos" />
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Gerencie seus pedidos de compra e monitore o fluxo de entrada de
              produtos
            </p>
          </div>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-700 dark:hover:bg-indigo-600 gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Pedido</span>
          </Button>
        </div>
      </div>

      {isFormOpen ? (
        <Card className="border border-indigo-200 dark:border-indigo-800 shadow-sm overflow-hidden">
          <CardHeader className="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-900">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
                Novo Pedido de Compra
              </CardTitle>
              <Button
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="border-indigo-200 hover:bg-indigo-100 dark:border-indigo-800 dark:hover:bg-indigo-900/50"
              >
                Voltar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-white dark:bg-gray-800">
            <NovoPedidoForm
              onSuccess={() => {
                setIsFormOpen(false);
                setActiveTab("pendentes");
              }}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Dashboard cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center">
                  <div className="p-4 md:p-6 flex-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Pedidos Pendentes
                    </p>
                    <div className="mt-2 flex items-center">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {isLoadingStats ? "-" : stats.pendentes}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("pendentes")}
                        className="ml-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/20"
                      >
                        Ver todos
                      </Button>
                    </div>
                  </div>
                  <div className="h-full w-2 bg-amber-500"></div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center">
                  <div className="p-4 md:p-6 flex-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Pedidos Concluídos
                    </p>
                    <div className="mt-2 flex items-center">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {isLoadingStats ? "-" : stats.concluidos}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("concluidos")}
                        className="ml-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                      >
                        Ver todos
                      </Button>
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
                      Valor Total (30 dias)
                    </p>
                    <div className="mt-2 flex items-center">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {isLoadingStats
                          ? "-"
                          : `R$ ${(stats.valorTotal / 100).toFixed(2)}`}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsFormOpen(true)}
                        className="ml-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-900/20"
                      >
                        <Plus className="h-4 w-4 mr-1" /> Novo
                      </Button>
                    </div>
                  </div>
                  <div className="h-full w-2 bg-indigo-500"></div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex flex-1 gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <Input
                      placeholder="Buscar pedido, fornecedor..."
                      value={filter.searchTerm}
                      onChange={(e) =>
                        handleFilterChange({ searchTerm: e.target.value })
                      }
                      className="pl-9 h-10 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    />
                  </div>
                  <DatePickerWithRange
                    date={filter.dateRange}
                    onDateChange={(range) =>
                      handleFilterChange({ dateRange: range })
                    }
                    className="min-w-[280px]"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={handleExport}
                  className="h-10 border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800 gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs and content */}
          <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <Tabs
              defaultValue="concluidos"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <div className="px-4 pt-4 border-b border-gray-200 dark:border-gray-700">
                <TabsList className="grid w-full grid-cols-2 h-10 bg-gray-100 dark:bg-gray-900 p-1 rounded-md">
                  <TabsTrigger
                    value="pendentes"
                    className="flex gap-2 items-center data-[state=active]:bg-amber-100 data-[state=active]:text-amber-900 dark:data-[state=active]:bg-amber-900/40 dark:data-[state=active]:text-amber-100 rounded-md transition-colors"
                  >
                    <Clock className="h-4 w-4" />
                    Pendentes
                  </TabsTrigger>
                  <TabsTrigger
                    value="concluidos"
                    className="flex gap-2 items-center data-[state=active]:bg-green-100 data-[state=active]:text-green-900 dark:data-[state=active]:bg-green-900/40 dark:data-[state=active]:text-green-100 rounded-md transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Concluídos
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="pendentes" className="p-4">
                <PedidosTable
                  status="pendente"
                  dateRange={filter.dateRange}
                  searchTerm={filter.searchTerm}
                  onRefresh={() => setActiveTab("pendentes")}
                />
              </TabsContent>

              <TabsContent value="concluidos" className="p-4">
                <PedidosTable
                  status="confirmado"
                  dateRange={filter.dateRange}
                  searchTerm={filter.searchTerm}
                  onRefresh={() => setActiveTab("concluidos")}
                />
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}
    </div>
  );
};

export default GestaoPedidos;
