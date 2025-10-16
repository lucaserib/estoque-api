"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/app/components/Header";
import Link from "next/link";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PlusCircle,
  RefreshCw,
  Search,
  AlertCircle,
  Package,
  CalendarDays,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  MoreVertical,
  ExternalLink,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePickerWithRange } from "@/components/ui/DatePickerWithRange";
import { DateRange } from "react-day-picker";
import { Saida, VendaML, VendasMLResponse } from "./types";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFetch } from "@/app/hooks/useFetch";
import { SaidaLoadingSkeleton } from "./components/SaidaLoadingSkeleton";
import { SaidaList } from "./components/SaidaList";
import { NovaSaidaDialog } from "./components/NovaSaidaDialog";
import { VendasMLList } from "./components/VendasMLList";

// Main component for the Saidas page
const SaidasPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [activeTab, setActiveTab] = useState("manual");

  // Fetch saidas manuais data
  const {
    data: saidas,
    loading,
    error,
    refetch,
  } = useFetch<Saida[]>("/api/saida", undefined, [refreshTrigger]);

  // Normalizar datas para garantir que cubram o dia inteiro
  const normalizedDateRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      const defaultFrom = subDays(new Date(), 30);
      defaultFrom.setHours(0, 0, 0, 0);
      const defaultTo = new Date();
      defaultTo.setHours(23, 59, 59, 999);
      return { from: defaultFrom, to: defaultTo };
    }

    const from = new Date(dateRange.from);
    from.setHours(0, 0, 0, 0);

    const to = new Date(dateRange.to);
    to.setHours(23, 59, 59, 999);

    return { from, to };
  }, [dateRange]);

  // Construir URL para vendas do ML
  const vendasMLUrl = useMemo(() => {
    return `/api/saida/vendas-ml?dateFrom=${normalizedDateRange.from.toISOString()}&dateTo=${normalizedDateRange.to.toISOString()}`;
  }, [normalizedDateRange]);

  // Memorizar a função de processamento para evitar loops
  const processVendasMLData = useCallback((data: unknown) => {
    // Se o hook converteu para array, pegar o primeiro elemento
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as unknown as VendasMLResponse;
    }
    return data as unknown as VendasMLResponse;
  }, []);

  // Fetch vendas do Mercado Livre
  const {
    data: vendasMLData,
    loading: loadingVendasML,
    error: errorVendasML,
  } = useFetch<VendasMLResponse>(vendasMLUrl, processVendasMLData, [
    refreshTrigger,
    vendasMLUrl, // Adicionar a URL como dependência explícita
  ]);

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

    // Filter by date range (usando datas normalizadas)
    const saidaDate = new Date(saida.data);
    const isInDateRange =
      saidaDate >= normalizedDateRange.from &&
      saidaDate <= normalizedDateRange.to;

    return matchesSearch && isInDateRange;
  });

  // Handle successful creation of new saida
  const handleSaveSuccess = () => {
    setShowCreateModal(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  // Filter vendas ML based on search term
  const filteredVendasML = (vendasMLData?.vendas || []).filter((venda) => {
    if (searchTerm === "" || !searchTerm) return true;

    const searchLower = searchTerm.toLowerCase().trim();

    // Search in order ID
    const matchesOrderId = venda.orderId?.toLowerCase().includes(searchLower);

    // Search in buyer info
    const matchesBuyer =
      venda.buyer?.nickname?.toLowerCase().includes(searchLower) ||
      venda.buyer?.first_name?.toLowerCase().includes(searchLower) ||
      venda.buyer?.last_name?.toLowerCase().includes(searchLower);

    // Search in items
    const matchesItems = venda.items?.some(
      (item) =>
        item.title?.toLowerCase().includes(searchLower) ||
        item.sku?.toLowerCase().includes(searchLower)
    );

    return matchesOrderId || matchesBuyer || matchesItems;
  });

  // Calculate summary metrics for manual saidas
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

  // Calculate summary metrics for ML vendas
  const totalVendasML = filteredVendasML.length;
  const totalItensML = filteredVendasML.reduce(
    (sum, venda) =>
      sum + venda.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
  const totalRevenueML = vendasMLData?.totalRevenue || 0;

  return (
    <div className="container max-w-screen-xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 md:p-6">
        <div className="flex justify-between items-center">
          <div>
            <Header name="Registro de Saídas" />
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Gerencie todas as saídas de produtos: manuais e vendas do Mercado
              Livre
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-700 dark:hover:bg-indigo-600 gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Saída Manual</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards - Dinâmicas baseadas na aba ativa */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeTab === "manual" ? (
          <>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center">
                  <div className="p-4 md:p-6 flex-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Saídas Manuais
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
          </>
        ) : (
          <>
            <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center">
                  <div className="p-4 md:p-6 flex-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Vendas ML
                    </p>
                    <div className="mt-2 flex items-center">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {loadingVendasML ? "-" : totalVendasML}
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
                      Itens Vendidos
                    </p>
                    <div className="mt-2 flex items-center">
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {loadingVendasML ? "-" : totalItensML}
                      </h3>
                    </div>
                  </div>
                  <div className="h-full w-2 bg-blue-500"></div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center">
              <div className="p-4 md:p-6 flex-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {activeTab === "mercadolivre" ? "Receita Total" : "Período"}
                </p>
                <div className="mt-2 flex items-center">
                  {activeTab === "mercadolivre" ? (
                    <h3 className="text-xl font-bold text-green-600 dark:text-green-400">
                      {loadingVendasML
                        ? "-"
                        : new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          }).format(totalRevenueML / 100)}
                    </h3>
                  ) : (
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {format(normalizedDateRange.from, "dd/MM/yyyy", {
                        locale: ptBR,
                      })}{" "}
                      -{" "}
                      {format(normalizedDateRange.to, "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </h3>
                  )}
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
                  placeholder={
                    activeTab === "manual"
                      ? "Buscar produto, armazém..."
                      : "Buscar pedido, comprador, produto..."
                  }
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

      {/* Main Content com Tabs */}
      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <CardHeader className="pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div>
                  <CardTitle className="text-xl font-semibold flex items-center gap-2">
                    {activeTab === "manual" ? (
                      <>
                        <Package className="h-5 w-5 text-indigo-500" />
                        Saídas Manuais
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5 text-green-500" />
                        Vendas do Mercado Livre
                      </>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {activeTab === "manual"
                      ? `${filteredSaidas.length} ${
                          filteredSaidas.length === 1 ? "registro" : "registros"
                        } encontrados`
                      : `${filteredVendasML.length} ${
                          filteredVendasML.length === 1 ? "venda" : "vendas"
                        } encontradas`}
                  </CardDescription>
                </div>

                {/* Dropdown de Ações para ML */}
                {activeTab === "mercadolivre" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Abrir menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56">
                      <DropdownMenuLabel>
                        Ações do Mercado Livre
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link
                          href="/mercado-livre/vendas"
                          className="flex items-center cursor-pointer"
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          <span>Análise Completa de Vendas</span>
                          <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href="/mercado-livre"
                          className="flex items-center cursor-pointer"
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          <span>Dashboard ML</span>
                          <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              <TabsList className="grid w-full md:w-auto grid-cols-2 gap-2">
                <TabsTrigger
                  value="manual"
                  className="flex items-center gap-2 data-[state=active]:bg-indigo-500 data-[state=active]:text-white"
                >
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Saídas Manuais</span>
                  <span className="sm:hidden">Manual</span>
                  {totalSaidas > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                      {totalSaidas}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="mercadolivre"
                  className="flex items-center gap-2 data-[state=active]:bg-green-500 data-[state=active]:text-white"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span className="hidden sm:inline">Mercado Livre</span>
                  <span className="sm:hidden">ML</span>
                  {totalVendasML > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium">
                      {totalVendasML}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <TabsContent value="manual" className="mt-0">
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
            </TabsContent>

            <TabsContent value="mercadolivre" className="mt-0">
              {errorVendasML ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {typeof errorVendasML === "string"
                      ? errorVendasML
                      : "Erro ao carregar vendas do Mercado Livre"}
                  </AlertDescription>
                </Alert>
              ) : loadingVendasML ? (
                <SaidaLoadingSkeleton />
              ) : (
                <VendasMLList vendas={filteredVendasML} />
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
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
