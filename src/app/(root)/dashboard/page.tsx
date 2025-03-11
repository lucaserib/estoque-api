"use client";

import { useEffect, useState } from "react";
import CardValorEstoque from "@/app/components/dashboard/CardValorEstoque";
import EntradasChart from "@/app/components/dashboard/EntradasChart";
import EstoqueSegurancaCard from "@/app/components/dashboard/EstoqueSegurancaCard";
import FluxoFinanceiroChart from "@/app/components/dashboard/FluxoFinanceiroChart";
import TopProdutosChart from "@/app/components/dashboard/TopProdutosChart";
import Header from "@/app/components/Header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpIcon,
  ArrowDownIcon,
  BarChart3,
  LineChart,
  AlertTriangle,
  PackageIcon,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = () => {
  const [summaryData, setSummaryData] = useState({
    entriesCount: 0,
    outputsCount: 0,
    totalValue: "0.00",
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(
      new Date().setDate(new Date().getDate() - 30)
    ).toISOString(),
    endDate: new Date().toISOString(),
  });

  // Fetch summary data on load
  useEffect(() => {
    const fetchSummaryData = async () => {
      setLoading(true);
      try {
        // These could be combined into a single API endpoint for better performance
        const [valorResponse, fluxoResponse, estoqueResponse] =
          await Promise.all([
            fetch("/api/dashboard/valor-estoque"),
            fetch(
              `/api/dashboard/fluxo-financeiro?startDate=${dateFilter.startDate}&endDate=${dateFilter.endDate}`
            ),
            fetch("/api/dashboard/estoque-seguranca"),
          ]);

        const valorData = await valorResponse.json();
        const fluxoData = await fluxoResponse.json();
        const estoqueData = await estoqueResponse.json();

        setSummaryData({
          entriesCount: fluxoData.entradas || 0,
          outputsCount: fluxoData.saidas || 0,
          totalValue: valorData.valorTotal || "0.00",
          lowStockCount: estoqueData.length || 0,
        });
      } catch (error) {
        console.error("Erro ao buscar dados resumidos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummaryData();
  }, [dateFilter]);

  return (
    <div className="max-w-[1400px] mx-auto p-6">
      <div className="mb-6">
        <Header name="Dashboard" />
        <p className="text-muted-foreground mt-1">
          Visão geral do seu sistema de estoque e movimentações
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array(4)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
        ) : (
          <>
            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Valor Total
                    </p>
                    <h3 className="text-2xl font-bold mt-1">
                      R${" "}
                      {parseFloat(summaryData.totalValue).toLocaleString(
                        "pt-BR",
                        { minimumFractionDigits: 2 }
                      )}
                    </h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Entradas (30d)
                    </p>
                    <h3 className="text-2xl font-bold mt-1">
                      {summaryData.entriesCount.toLocaleString("pt-BR")} itens
                    </h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <ArrowUpIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Saídas (30d)
                    </p>
                    <h3 className="text-2xl font-bold mt-1">
                      {summaryData.outputsCount.toLocaleString("pt-BR")} itens
                    </h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <ArrowDownIcon className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Estoque Crítico
                    </p>
                    <h3 className="text-2xl font-bold mt-1">
                      {summaryData.lowStockCount.toLocaleString("pt-BR")}{" "}
                      {summaryData.lowStockCount === 1 ? "produto" : "produtos"}
                    </h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Main Dashboard Content */}
      <Tabs defaultValue="overview" className="mb-6">
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="px-4 py-2">
            <BarChart3 className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="analytics" className="px-4 py-2">
            <LineChart className="h-4 w-4 mr-2" />
            Análise Detalhada
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-1">
              <TopProdutosChart />
            </div>
            <div className="col-span-1 lg:col-span-2">
              <FluxoFinanceiroChart />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-1">
              <CardValorEstoque />
            </div>
            <div className="col-span-1 lg:col-span-2">
              <EntradasChart />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Card className="shadow-md border-red-200 bg-red-50 mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-bold flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5 text-red-600" />
            Alerta de Estoque de Segurança
          </CardTitle>
          <CardDescription className="text-red-700">
            Produtos que estão abaixo do estoque mínimo definido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EstoqueSegurancaCard />
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
