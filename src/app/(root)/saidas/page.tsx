"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
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
  ShoppingCart,
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
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatCardGrid, type StatCardItem } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";

const SaidasPage = () => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [activeTab, setActiveTab] = useState("manual");

  const {
    data: saidas,
    loading,
    error,
    refetch,
  } = useFetch<Saida[]>("/api/saida", undefined, [refreshTrigger]);

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

  const vendasMLUrl = useMemo(() => {
    return `/api/saida/vendas-ml?dateFrom=${normalizedDateRange.from.toISOString()}&dateTo=${normalizedDateRange.to.toISOString()}`;
  }, [normalizedDateRange]);

  const processVendasMLData = useCallback((data: unknown) => {
    if (Array.isArray(data) && data.length > 0) {
      return data[0] as unknown as VendasMLResponse;
    }
    return data as unknown as VendasMLResponse;
  }, []);

  const {
    data: vendasMLData,
    loading: loadingVendasML,
    error: errorVendasML,
  } = useFetch<VendasMLResponse>(vendasMLUrl, processVendasMLData, [
    refreshTrigger,
    vendasMLUrl,
  ]);

  const filteredSaidas = (saidas || []).filter((saida) => {
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

    const saidaDate = new Date(saida.data);
    const isInDateRange =
      saidaDate >= normalizedDateRange.from &&
      saidaDate <= normalizedDateRange.to;

    return matchesSearch && isInDateRange;
  });

  const handleSaveSuccess = () => {
    setShowCreateModal(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  const filteredVendasML = (vendasMLData?.vendas || []).filter((venda) => {
    if (searchTerm === "" || !searchTerm) return true;

    const searchLower = searchTerm.toLowerCase().trim();

    const matchesOrderId = venda.orderId?.toLowerCase().includes(searchLower);

    const matchesBuyer =
      venda.buyer?.nickname?.toLowerCase().includes(searchLower) ||
      venda.buyer?.first_name?.toLowerCase().includes(searchLower) ||
      venda.buyer?.last_name?.toLowerCase().includes(searchLower);

    const matchesItems = venda.items?.some(
      (item) =>
        item.title?.toLowerCase().includes(searchLower) ||
        item.sku?.toLowerCase().includes(searchLower)
    );

    return matchesOrderId || matchesBuyer || matchesItems;
  });

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

  const totalVendasML = filteredVendasML.length;
  const totalItensML = filteredVendasML.reduce(
    (sum, venda) =>
      sum + venda.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
  const totalRevenueML = vendasMLData?.totalRevenue || 0;

  const statItems: StatCardItem[] =
    activeTab === "manual"
      ? [
          { label: "Saídas manuais", value: loading ? "—" : String(totalSaidas) },
          { label: "Total de itens", value: loading ? "—" : String(totalItens) },
          {
            label: "Período",
            value: `${format(normalizedDateRange.from, "dd/MM", { locale: ptBR })} – ${format(
              normalizedDateRange.to,
              "dd/MM",
              { locale: ptBR }
            )}`,
          },
        ]
      : [
          { label: "Vendas ML", value: loadingVendasML ? "—" : String(totalVendasML) },
          { label: "Itens vendidos", value: loadingVendasML ? "—" : String(totalItensML) },
          {
            label: "Receita total",
            value: loadingVendasML
              ? "—"
              : new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalRevenueML / 100),
          },
        ];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8">
      <PageHeader
        title="Saídas"
        subtitle="Gerencie todas as saídas de produtos: manuais e vendas do Mercado Livre."
        actions={
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Saída Manual</span>
          </Button>
        }
      />

      <StatCardGrid items={statItems} />

      <Card className="border border-border shadow-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-faint" />
                <Input
                  placeholder={
                    activeTab === "manual"
                      ? "Buscar produto, armazém..."
                      : "Buscar pedido, comprador, produto..."
                  }
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-10"
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
              className="h-10 gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <SectionCard
          title={activeTab === "manual" ? "Saídas manuais" : "Vendas do Mercado Livre"}
          description={
            activeTab === "manual"
              ? `${filteredSaidas.length} ${
                  filteredSaidas.length === 1 ? "registro encontrado" : "registros encontrados"
                }`
              : `${filteredVendasML.length} ${
                  filteredVendasML.length === 1 ? "venda encontrada" : "vendas encontradas"
                }`
          }
          actions={
            <div className="flex items-center gap-3">
              {activeTab === "mercadolivre" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Abrir menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>Ações do Mercado Livre</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link
                        href="/financeiro/vendas"
                        className="flex items-center cursor-pointer"
                      >
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span>Análise Completa de Vendas</span>
                        <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/mercado-livre" className="flex items-center cursor-pointer">
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        <span>Saúde dos anúncios</span>
                        <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <TabsList className="grid grid-cols-2 gap-2">
                <TabsTrigger value="manual" className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Saídas Manuais</span>
                  <span className="sm:hidden">Manual</span>
                </TabsTrigger>
                <TabsTrigger value="mercadolivre" className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  <span className="hidden sm:inline">Mercado Livre</span>
                  <span className="sm:hidden">ML</span>
                </TabsTrigger>
              </TabsList>
            </div>
          }
        >
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
              <>
                {vendasMLData?.parcial && (
                  <Alert variant="warning" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Alguns pedidos não puderam ser carregados (
                      {vendasMLData.pedidosFaltantes} faltantes). Os números
                      abaixo podem estar incompletos.
                    </AlertDescription>
                  </Alert>
                )}
                <VendasMLList vendas={filteredVendasML} />
              </>
            )}
          </TabsContent>
        </SectionCard>
      </Tabs>

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
