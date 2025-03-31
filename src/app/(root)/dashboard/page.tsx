"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  CardFooter,
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
  Calendar,
  RefreshCcw,
  FilterIcon,
  ChevronDownIcon,
  Search,
  ChevronsUpDown,
  DollarSign,
  Loader2,
  AlertCircle,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  XCircle,
  Info,
  CheckCircle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import PedidosTable from "@/components/PedidosTable";
import { PedidoLoadingSkeleton } from "@/components/PedidoLoadingSkeleton";
import { SaidaList } from "@/app/(root)/saidas/components/SaidaList";
import { SaidaLoadingSkeleton } from "@/app/(root)/saidas/components/SaidaLoadingSkeleton";
import { PedidoEntradasLoadingSkeleton } from "@/components/PedidoEntradasLoadingSkeleton";
import { DateRange } from "react-day-picker";
import { format, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DatePickerWithRange } from "@/components/ui/DatePickerWithRange";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { exibirValorEmReais, centsToBRL, formatBRL } from "@/utils/currency";
import { Separator } from "@/components/ui/separator";

// Importar componentes modulares
import DashboardFilters, {
  PeriodoKey,
  PERIODOS_PREDEFINIDOS_ARRAY,
} from "./components/DashboardFilters";
import SummaryCards from "./components/SummaryCards";

// Definir tipos para objetos vindos da API
interface ProdutoPedido {
  id: string;
  quantidade: number;
  custo: number;
  multiplicador: number;
  produto?: {
    multiplicador?: number;
  };
}

interface PedidoAPI {
  id: string;
  dataConclusao?: string | null;
  produtos?: ProdutoPedido[];
}

interface DetalhesSaida {
  id: number;
  quantidade: number;
  produto: {
    id: string;
    nome: string;
    sku: string;
  };
  isKit: boolean;
}

interface Saida {
  id: string;
  data: string;
  armazem: {
    id: string;
    nome: string;
  };
  detalhes: DetalhesSaida[];
}

interface DashboardSummaryData {
  entriesCount: number;
  entriesValue: number;
  outputsCount: number;
  totalValue: number;
  lowStockCount: number;
}

const Dashboard = () => {
  const [summaryData, setSummaryData] = useState<DashboardSummaryData>({
    entriesCount: 0,
    entriesValue: 0,
    outputsCount: 0,
    totalValue: 0,
    lowStockCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [dateFilter, setDateFilter] = useState({
    startDate: subDays(new Date(), 30).toISOString(),
    endDate: new Date().toISOString(),
  });
  const [activeView, setActiveView] = useState("overview");
  const [saidasData, setSaidasData] = useState<Saida[]>([]);
  const [entradasData, setEntradasData] = useState<PedidoAPI[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [periodoSelecionado, setPeriodoSelecionado] =
    useState<PeriodoKey>("30dias");
  const [loadingEntradas, setLoadingEntradas] = useState(false);
  const [loadingSaidas, setLoadingSaidas] = useState(false);

  const lastRefreshTimestamp = useRef(0);
  const isUpdating = useRef(false);

  const carregarDadosVisualizacoes = useCallback(async () => {
    try {
      console.log("Dados das visualizações atualizados");
    } catch (error) {
      console.error("Erro ao carregar dados das visualizações:", error);
    }
  }, []);

  const fetchSummaryData = useCallback(async () => {
    if (isUpdating.current) {
      console.log("Já existe uma atualização em andamento, ignorando");
      return;
    }

    isUpdating.current = true;

    if (!dateFilter.startDate || !dateFilter.endDate) {
      console.warn("Filtro de datas não definido");
      isUpdating.current = false;
      return;
    }

    setLoading(true);
    setLoadingEntradas(true);
    setLoadingSaidas(true);
    setLoadingData(true);

    try {
      console.log("Buscando dados com filtros:", {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        periodoSelecionado,
        refreshTrigger,
      });

      // Função auxiliar para fazer fetch com timeout
      const fetchWithTimeout = async (
        url: string,
        options = {},
        timeout = 10000
      ) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          clearTimeout(id);
          return response;
        } catch (error) {
          clearTimeout(id);
          console.error(`Timeout ou erro ao buscar ${url}:`, error);
          throw error;
        }
      };

      // Fazer requisições em paralelo
      const [
        stockValuePromise,
        lowStockPromise,
        entradasPromise,
        pedidosPromise,
        saidasPromise,
      ] = [
        fetchWithTimeout("/api/dashboard/valor-estoque")
          .then((res) => res.json())
          .catch((err) => {
            console.error("Erro ao buscar valor do estoque:", err);
            return { valorTotal: 0, quantidadeTotal: 0 };
          }),

        fetchWithTimeout("/api/dashboard/estoque-seguranca")
          .then((res) => res.json())
          .catch((err) => {
            console.error("Erro ao buscar estoque de segurança:", err);
            return [];
          }),

        fetchWithTimeout(
          `/api/dashboard/entradas?${new URLSearchParams({
            period: "custom",
            startDate: dateFilter.startDate,
            endDate: dateFilter.endDate,
          }).toString()}`
        )
          .then((res) => res.json())
          .catch((err) => {
            console.error("Erro ao buscar entradas:", err);
            return { totals: { quantidade: 0, valor: 0 }, chart: [] };
          }),

        fetchWithTimeout(
          `/api/pedidos-compra?${new URLSearchParams({
            status: "confirmado",
            startDate: dateFilter.startDate,
            endDate: dateFilter.endDate,
          }).toString()}`
        )
          .then((res) => res.json())
          .catch((err) => {
            console.error("Erro ao buscar pedidos:", err);
            return [];
          }),

        fetchWithTimeout(
          `/api/saida?${new URLSearchParams({
            startDate: dateFilter.startDate,
            endDate: dateFilter.endDate,
          }).toString()}`
        )
          .then((res) => res.json())
          .catch((err) => {
            console.error("Erro ao buscar saídas:", err);
            return [];
          }),
      ];

      // Aguardar todas as requisições ou seus fallbacks
      const [
        stockValueData,
        lowStockData,
        entradasDataResponse,
        pedidosData,
        saidasData,
      ] = await Promise.all([
        stockValuePromise,
        lowStockPromise,
        entradasPromise,
        pedidosPromise,
        saidasPromise,
      ]);

      console.log("Todas as requisições concluídas ou com timeout");

      const valorTotalEstoque = stockValueData.valorTotal || 0;

      const startDate = new Date(dateFilter.startDate);
      const endDate = new Date(dateFilter.endDate);

      // Processar dados de pedidos
      const filteredPedidos = Array.isArray(pedidosData)
        ? pedidosData.filter((pedido: PedidoAPI) => {
            if (!pedido.dataConclusao) return false;

            const conclusionDate = new Date(pedido.dataConclusao);
            const isInRange =
              conclusionDate >= startDate && conclusionDate <= endDate;

            const hasProducts =
              pedido.produtos &&
              Array.isArray(pedido.produtos) &&
              pedido.produtos.length > 0;

            return isInRange && hasProducts;
          })
        : [];

      console.log("Pedidos filtrados para exibição:", filteredPedidos.length);
      setEntradasData(filteredPedidos);

      // Processar dados de saídas
      const filteredSaidas = Array.isArray(saidasData)
        ? saidasData.filter((saida: Saida) => {
            if (!saida.data) return false;

            const dataSaida = new Date(saida.data);
            return dataSaida >= startDate && dataSaida <= endDate;
          })
        : [];

      setSaidasData(filteredSaidas);
      console.log("Saídas filtradas:", filteredSaidas.length);

      // Calcular entradas
      let entriesCount = 0;
      let entriesValue = 0;

      if (entradasDataResponse && entradasDataResponse.totals) {
        entriesCount = entradasDataResponse.totals.quantidade || 0;
        entriesValue = entradasDataResponse.totals.valor || 0;
        console.log(
          `Usando dados da API: ${entriesCount} itens, valor ${entriesValue}`
        );
      } else {
        entriesCount = filteredPedidos.reduce(
          (count: number, pedido: PedidoAPI) => {
            if (!pedido.produtos || !Array.isArray(pedido.produtos))
              return count;

            return (
              count +
              pedido.produtos.reduce((sum: number, produto: ProdutoPedido) => {
                return sum + (produto.quantidade || 0);
              }, 0)
            );
          },
          0
        );

        entriesValue = filteredPedidos.reduce(
          (value: number, pedido: PedidoAPI) => {
            if (!pedido.produtos || !Array.isArray(pedido.produtos))
              return value;

            const pedidoValue = pedido.produtos.reduce(
              (total: number, produto: ProdutoPedido) => {
                if (!produto) return total;

                const quantidade = produto.quantidade || 0;
                const custo = produto.custo || 0;
                const multiplicador =
                  produto.multiplicador ||
                  (produto.produto && produto.produto.multiplicador) ||
                  1;

                return total + quantidade * custo * multiplicador;
              },
              0
            );

            return value + pedidoValue;
          },
          0
        );
      }

      // Calcular saídas
      const outputsCount = filteredSaidas.reduce(
        (count: number, saida: Saida) => {
          if (!saida.detalhes || !Array.isArray(saida.detalhes)) return count;

          return (
            count +
            saida.detalhes.reduce((sum: number, detalhe: DetalhesSaida) => {
              return sum + (detalhe.quantidade || 0);
            }, 0)
          );
        },
        0
      );

      setSummaryData({
        totalValue: valorTotalEstoque,
        lowStockCount: Array.isArray(lowStockData) ? lowStockData.length : 0,
        entriesCount: entriesCount || 0,
        entriesValue: entriesValue || 0,
        outputsCount: outputsCount || 0,
      });

      console.log("Dashboard atualizado com sucesso");

      await carregarDadosVisualizacoes();
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados do dashboard");

      setSummaryData((prev) => ({
        ...prev,
        // Manter valores anteriores se houver erro
      }));
    } finally {
      setLoading(false);
      setLoadingEntradas(false);
      setLoadingSaidas(false);
      setLoadingData(false);
      isUpdating.current = false;
    }
  }, [
    dateFilter,
    carregarDadosVisualizacoes,
    periodoSelecionado,
    setSummaryData,
  ]);

  // Função para atualizar os dados - simplificada
  const handleRefresh = useCallback(() => {
    if (isUpdating.current) {
      console.log("Já existe uma atualização em andamento, ignorando");
      return;
    }

    lastRefreshTimestamp.current = Date.now();

    setLoadingData(true);
    setLoadingEntradas(true);
    setLoadingSaidas(true);

    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (refreshTrigger === 0) {
      console.log("Dashboard montado - inicializando");

      if (!dateRange) {
        setDateRange({
          from: subDays(new Date(), 30),
          to: new Date(),
        });
      } else if (dateRange.from && dateRange.to) {
        // Se já temos um dateRange com valores definidos, definir o dateFilter
        const startDate = new Date(dateRange.from);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(dateRange.to);
        endDate.setHours(23, 59, 59, 999);

        setDateFilter({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });
      }

      // Primeira carga de dados
      handleRefresh();
      return;
    }

    // Requisição de dados quando o refreshTrigger muda
    if (dateFilter.startDate && dateFilter.endDate && refreshTrigger > 0) {
      // Evitar atualizações duplicadas
      const currentTime = Date.now();
      const timeSinceLastRefresh = currentTime - lastRefreshTimestamp.current;

      // Se faz menos de 100ms desde a última atualização ou já estamos atualizando, ignorar
      if (timeSinceLastRefresh < 100 || isUpdating.current) {
        console.log(
          `Ignorando atualização duplicada (${timeSinceLastRefresh}ms desde a última)`
        );
        return;
      }

      console.log(`Atualizando dados (trigger: ${refreshTrigger})`);
      fetchSummaryData();
    }
  }, [refreshTrigger, dateRange, dateFilter, handleRefresh, fetchSummaryData]);

  // *** Manipulação de changes no dateRange ***
  useEffect(() => {
    // Ignorar a primeira renderização (quando refreshTrigger é 0) ou se não tiver datas
    if (refreshTrigger === 0) return;
    if (!dateRange || !dateRange.from || !dateRange.to) return;

    // Agora sabemos que dateRange.from e dateRange.to são definidos
    // Criar cópias das datas para não modificar o objeto original
    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    console.log("Filtro de data atualizado:", {
      de: startDate.toISOString(),
      ate: endDate.toISOString(),
      periodoSelecionado,
    });

    // Atualizar o filtro de data sem disparar o refreshTrigger imediatamente
    setDateFilter({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Aguardar um pequeno delay antes de disparar o refresh para evitar loops
    const timeoutId = setTimeout(() => {
      handleRefresh();
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [dateRange, periodoSelecionado, handleRefresh]);

  // Função para aplicar período predefinido
  const aplicarPeriodoPredefinido = useCallback(
    (periodo: string) => {
      // Evitar redefinir o mesmo período
      if (periodoSelecionado === periodo) {
        console.log(`Período ${periodo} já está selecionado, ignorando`);
        return;
      }

      setPeriodoSelecionado(periodo as PeriodoKey);

      const today = new Date();
      today.setHours(23, 59, 59, 999);

      let startDate = new Date();
      let endDate = new Date(today);

      switch (periodo) {
        case "hoje":
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(today);
          break;
        case "ontem":
          startDate = new Date();
          startDate.setDate(today.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date();
          endDate.setDate(today.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case "7dias":
          startDate = new Date();
          startDate.setDate(today.getDate() - 6); // 7 dias inclui hoje
          startDate.setHours(0, 0, 0, 0);
          break;
        case "15dias":
          startDate = new Date();
          startDate.setDate(today.getDate() - 14); // 15 dias inclui hoje
          startDate.setHours(0, 0, 0, 0);
          break;
        case "30dias":
          startDate = new Date();
          startDate.setDate(today.getDate() - 29); // 30 dias inclui hoje
          startDate.setHours(0, 0, 0, 0);
          break;
        case "90dias":
          startDate = new Date();
          startDate.setDate(today.getDate() - 89); // 90 dias inclui hoje
          startDate.setHours(0, 0, 0, 0);
          break;
        case "esteMes":
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case "mesPassado":
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(today.getFullYear(), today.getMonth(), 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate.setDate(today.getDate() - 29); // Padrão: últimos 30 dias
          startDate.setHours(0, 0, 0, 0);
      }

      console.log(`Período aplicado: ${periodo}`, {
        de: startDate.toISOString(),
        ate: endDate.toISOString(),
      });

      // Atualizar o dateRange sem provocar loop
      setDateRange({ from: startDate, to: endDate });
    },
    [periodoSelecionado]
  );

  const calcularValorEntradas = (pedidos: PedidoAPI[]) => {
    return pedidos.reduce((total, pedido) => {
      const valorPedido =
        pedido.produtos?.reduce((sum, produto) => {
          return (
            sum + produto.quantidade * produto.custo * produto.multiplicador
          );
        }, 0) || 0;
      return total + valorPedido;
    }, 0);
  };

  const contarItensEntradas = (pedidos: PedidoAPI[]) => {
    return pedidos.reduce((total, pedido) => {
      const itensPedido =
        pedido.produtos?.reduce((sum, produto) => {
          return sum + produto.quantidade;
        }, 0) || 0;
      return total + itensPedido;
    }, 0);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header do dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <Header name="Dashboard" />
          <p className="text-muted-foreground mt-1">
            Visão geral do seu sistema de estoque e movimentações
          </p>
        </div>

        {/* Botão de atualização dos dados */}
        <div className="mt-4 sm:mt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-1.5"
            disabled={
              loading || loadingData || loadingEntradas || loadingSaidas
            }
          >
            <RefreshCcw className="h-4 w-4" />
            {loading || loadingData || loadingEntradas || loadingSaidas ? (
              <span className="flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Atualizando...
              </span>
            ) : (
              <span>Atualizar dados</span>
            )}
          </Button>
        </div>
      </div>

      {/* Filtros unificados usando o componente modular */}
      <DashboardFilters
        dateRange={dateRange}
        setDateRange={setDateRange}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        periodoSelecionado={periodoSelecionado}
        setPeriodoSelecionado={setPeriodoSelecionado}
        aplicarPeriodoPredefinido={aplicarPeriodoPredefinido}
        isLoading={loading || loadingData || loadingEntradas || loadingSaidas}
      />

      {/* Cards resumo com o componente */}
      <SummaryCards
        summaryData={summaryData}
        activeView={activeView}
        setActiveView={setActiveView}
        loadingData={loadingData}
        loadingEntradas={loadingEntradas}
        loadingSaidas={loadingSaidas}
      />

      {/* Container principal do dashboard com altura fixa otimizada */}
      <div className="min-h-[650px] md:min-h-[700px] h-[calc(100vh-350px)] relative bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Visualização do Overview */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
            activeView === "overview"
              ? "opacity-100 z-10 visible pointer-events-auto"
              : "opacity-0 z-0 invisible pointer-events-none"
          }`}
        >
          <div className="h-full w-full flex flex-col bg-white rounded-lg overflow-hidden">
            <Tabs
              defaultValue="overview"
              className="flex flex-col h-full w-full"
            >
              <TabsList className="mb-4 w-full justify-start p-4">
                <TabsTrigger
                  value="overview"
                  className="px-4 py-2 relative z-10"
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Visão Geral
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="px-4 py-2 relative z-10"
                >
                  <LineChart className="h-4 w-4 mr-2" />
                  Análise Detalhada
                </TabsTrigger>
              </TabsList>

              <div className="flex-grow h-full overflow-auto p-4">
                <TabsContent
                  value="overview"
                  className="relative w-full min-h-[500px]"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 order-2 lg:order-1">
                      <Card className="h-full overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle>Fluxo Financeiro</CardTitle>
                          <CardDescription>
                            Entradas e saídas de valores
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px] md:h-[500px] overflow-hidden">
                          <FluxoFinanceiroChart />
                        </CardContent>
                      </Card>
                    </div>
                    <div className="order-1 lg:order-2">
                      <Card className="h-full overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle>Top Produtos</CardTitle>
                          <CardDescription>
                            Produtos mais movimentados
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px] md:h-[500px] overflow-hidden">
                          <TopProdutosChart />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent
                  value="analytics"
                  className="relative w-full min-h-[500px]"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 order-2 lg:order-1">
                      <Card className="h-full overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle>Entradas</CardTitle>
                          <CardDescription>
                            Histórico de entradas no período
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px] md:h-[500px] overflow-hidden">
                          <EntradasChart />
                        </CardContent>
                      </Card>
                    </div>
                    <div className="order-1 lg:order-2 h-full w-full">
                      <Card className="h-full overflow-hidden">
                        <CardHeader className="pb-2">
                          <CardTitle>Valor em Estoque</CardTitle>
                          <CardDescription>
                            Valor total dos produtos
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="h-[400px] md:h-[500px] overflow-hidden">
                          <CardValorEstoque />
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Visualização de Entradas */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
            activeView === "entradas"
              ? "opacity-100 z-10 visible pointer-events-auto"
              : "opacity-0 z-0 invisible pointer-events-none"
          }`}
        >
          <Card className="shadow-md border-0 h-full flex flex-col">
            <CardHeader className="pb-0">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center">
                    <ArrowDownLeft className="mr-2 h-5 w-5 text-emerald-600" />
                    Histórico de Entradas
                  </CardTitle>
                  <CardDescription>
                    Pedidos confirmados e entradas no estoque
                  </CardDescription>
                </div>
                <div className="bg-emerald-50 rounded-md px-3 py-2 text-right mt-4 lg:mt-0">
                  <p className="text-sm text-emerald-700 font-medium">
                    Total no período:
                  </p>
                  <p className="text-lg font-bold text-emerald-700">
                    {exibirValorEmReais(summaryData.entriesValue)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {summaryData.entriesCount.toLocaleString("pt-BR")} itens
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent
              className="p-4 overflow-auto"
              style={{ height: "calc(100% - 100px)" }}
            >
              {loadingEntradas && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 z-20">
                  <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Carregando entradas...
                  </p>
                </div>
              )}
              {entradasData.length === 0 && summaryData.entriesValue > 0 ? (
                <div className="bg-blue-50 p-4 mb-4 rounded-md">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-blue-800">
                        Informação sobre os dados
                      </h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Existem {summaryData.entriesCount} itens registrados
                        totalizando{" "}
                        {exibirValorEmReais(summaryData.entriesValue)}, mas não
                        há pedidos de compra concluídos para exibir na tabela.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="h-full overflow-auto">
                <PedidosTable
                  status="confirmado"
                  dateRange={dateRange}
                  searchTerm={searchTerm}
                  onRefresh={handleRefresh}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visualização de Saídas */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
            activeView === "saidas"
              ? "opacity-100 z-10 visible pointer-events-auto"
              : "opacity-0 z-0 invisible pointer-events-none"
          }`}
        >
          <Card className="shadow-md border-0 h-full flex flex-col">
            <CardHeader className="pb-0">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center">
                    <ArrowUpRight className="mr-2 h-5 w-5 text-orange-600" />
                    Histórico de Saídas
                  </CardTitle>
                  <CardDescription>
                    Registros de saídas de produtos do estoque
                  </CardDescription>
                </div>
                <div className="bg-orange-50 rounded-md px-3 py-2 text-right mt-4 lg:mt-0">
                  <p className="text-sm text-orange-700 font-medium">
                    Itens no período:
                  </p>
                  <p className="text-lg font-bold text-orange-700">
                    {summaryData.outputsCount.toLocaleString("pt-BR")}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {saidasData.length} operações
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent
              className="p-4 overflow-auto"
              style={{ height: "calc(100% - 100px)" }}
            >
              {loadingSaidas && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 z-20">
                  <Loader2 className="h-10 w-10 animate-spin text-orange-500 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Carregando saídas...
                  </p>
                </div>
              )}
              <div className="h-full overflow-auto">
                <SaidaList saidas={saidasData} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visualização de Estoque Crítico */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 ease-in-out ${
            activeView === "estoqueCritico"
              ? "opacity-100 z-10 visible pointer-events-auto"
              : "opacity-0 z-0 invisible pointer-events-none"
          }`}
        >
          <Card className="shadow-md border-red-200 bg-red-50 h-full">
            <CardHeader className="pb-2">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center">
                    <AlertCircle className="mr-2 h-5 w-5 text-red-600" />
                    Alerta de Estoque de Segurança
                  </CardTitle>
                  <CardDescription className="text-red-700">
                    Produtos que estão abaixo do estoque mínimo definido
                  </CardDescription>
                </div>
                <div className="bg-red-100 rounded-md px-3 py-2 mt-4 lg:mt-0">
                  <p className="text-sm text-red-700 font-semibold text-right">
                    {summaryData.lowStockCount}{" "}
                    {summaryData.lowStockCount === 1 ? "produto" : "produtos"}{" "}
                    abaixo do estoque mínimo
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent
              className="p-4 overflow-auto"
              style={{ height: "calc(100% - 100px)" }}
            >
              {loadingData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 z-20">
                  <Loader2 className="h-10 w-10 animate-spin text-red-500 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Carregando alertas de estoque...
                  </p>
                </div>
              )}
              <div className="h-full overflow-auto">
                <EstoqueSegurancaCard searchTerm={searchTerm} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
