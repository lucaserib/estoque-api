"use client";

import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PedidosTable from "@/components/PedidosTable";

import { Plus, Download, Search, CheckCircle2, Clock } from "lucide-react";
import NovoPedidoForm from "./components/NovoPedidoForm";
import { DatePickerWithRange } from "@/components/ui/DatePickerWithRange";
import { PageHeader } from "@/components/ui/page-header";
import { StatStrip, type StatStripItem } from "@/components/ui/stat-strip";
import { SectionCard } from "@/components/ui/section-card";

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

  const statItems: StatStripItem[] = [
    { label: "Pedidos pendentes", value: isLoadingStats ? "—" : String(stats.pendentes) },
    { label: "Pedidos concluídos", value: isLoadingStats ? "—" : String(stats.concluidos) },
    {
      label: "Valor total (30 dias)",
      value: isLoadingStats ? "—" : `R$ ${(stats.valorTotal / 100).toFixed(2)}`,
    },
  ];

  return (
    <div className="container mx-auto max-w-[1400px] space-y-8 p-6">
      <PageHeader
        title="Pedidos de compra"
        subtitle="Gerencie seus pedidos de compra e monitore o fluxo de entrada de produtos."
        actions={
          <Button onClick={() => setIsFormOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Pedido</span>
          </Button>
        }
      />

      {isFormOpen ? (
        <Card className="border border-primary/30 shadow-card overflow-hidden">
          <CardHeader className="bg-primary/10 border-b border-primary/20">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-bold text-foreground">
                Novo Pedido de Compra
              </CardTitle>
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                Voltar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-card">
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
          <StatStrip items={statItems} />

          {/* Filtros */}
          <Card className="border border-border shadow-card">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div className="flex flex-1 gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-faint" />
                    <Input
                      placeholder="Buscar pedido, fornecedor..."
                      value={filter.searchTerm}
                      onChange={(e) =>
                        handleFilterChange({ searchTerm: e.target.value })
                      }
                      className="pl-9 h-10"
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
                <Button variant="outline" onClick={handleExport} className="h-10 gap-2">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Exportar</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tabs and content */}
          <Tabs defaultValue="concluidos" value={activeTab} onValueChange={setActiveTab}>
            <SectionCard
              contentClassName="p-4"
              title="Pedidos"
              actions={
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="pendentes" className="flex gap-2 items-center">
                    <Clock className="h-4 w-4" />
                    Pendentes
                  </TabsTrigger>
                  <TabsTrigger value="concluidos" className="flex gap-2 items-center">
                    <CheckCircle2 className="h-4 w-4" />
                    Concluídos
                  </TabsTrigger>
                </TabsList>
              }
            >
              <TabsContent value="pendentes" className="mt-0">
                <PedidosTable
                  status="pendente"
                  dateRange={filter.dateRange}
                  searchTerm={filter.searchTerm}
                  onRefresh={() => setActiveTab("pendentes")}
                />
              </TabsContent>

              <TabsContent value="concluidos" className="mt-0">
                <PedidosTable
                  status="confirmado"
                  dateRange={filter.dateRange}
                  searchTerm={filter.searchTerm}
                  onRefresh={() => setActiveTab("concluidos")}
                />
              </TabsContent>
            </SectionCard>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default GestaoPedidos;
