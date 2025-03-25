"use client";

import { useEffect, useState, useCallback } from "react";
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

// Interfaces para a tipagem
interface DetalhesSaida {
  id: number;
  produto: {
    id: string;
    nome: string;
    sku: string;
  };
  quantidade: number;
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

interface PedidoProduto {
  produtoId: string;
  quantidade: number;
  custo: number;
  multiplicador: number;
  produto: {
    id: string;
    nome: string;
    sku: string;
  };
}

interface Pedido {
  id: number;
  fornecedorId: string;
  fornecedor: {
    nome: string;
  };
  status: string;
  dataPrevista: string | null;
  dataConclusao: string | null;
  produtos: PedidoProduto[];
}

// Predefinições para períodos com tipagem correta
type PeriodoKey = "7dias" | "15dias" | "30dias" | "90dias" | "custom";

const PERIODOS_PREDEFINIDOS: Record<
  PeriodoKey,
  { label: string; range: DateRange }
> = {
  "7dias": {
    label: "Últimos 7 dias",
    range: {
      from: subDays(new Date(), 7),
      to: new Date(),
    },
  },
  "15dias": {
    label: "Últimos 15 dias",
    range: {
      from: subDays(new Date(), 15),
      to: new Date(),
    },
  },
  "30dias": {
    label: "Últimos 30 dias",
    range: {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
  },
  "90dias": {
    label: "Últimos 90 dias",
    range: {
      from: subDays(new Date(), 90),
      to: new Date(),
    },
  },
  custom: {
    label: "Personalizado",
    range: {
      from: subDays(new Date(), 30),
      to: new Date(),
    },
  },
};

const Dashboard = () => {
  const [summaryData, setSummaryData] = useState({
    entriesCount: 0,
    entriesValue: 0,
    outputsCount: 0,
    totalValue: "0.00",
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
  const [entradasData, setEntradasData] = useState<Pedido[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [periodoSelecionado, setPeriodoSelecionado] =
    useState<PeriodoKey>("30dias");
  const [loadingEntradas, setLoadingEntradas] = useState(false);
  const [loadingSaidas, setLoadingSaidas] = useState(false);

  // Efeito para buscar dados iniciais e quando houver refresh
  useEffect(() => {
    fetchSummaryData();
  }, [refreshTrigger, dateRange]);

  useEffect(() => {
    console.log("Dashboard montado - inicializando");

    if (!dateRange) {
      setDateRange({
        from: subDays(new Date(), 30),
        to: new Date(),
      });
    }

    handleRefresh();
  }, []);

  // Aplicar período predefinido com tipagem correta
  const aplicarPeriodoPredefinido = (periodo: PeriodoKey) => {
    setPeriodoSelecionado(periodo);
    setDateRange(PERIODOS_PREDEFINIDOS[periodo].range);
  };

  // Atualiza o filtro de data quando o dateRange muda
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      setDateFilter({
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
      });
    }
  }, [dateRange]);

  // Função para calcular o valor total das entradas
  const calcularValorEntradas = (pedidos: Pedido[]) => {
    return pedidos.reduce((total, pedido) => {
      const valorPedido = pedido.produtos.reduce((sum, produto) => {
        return sum + produto.quantidade * produto.custo * produto.multiplicador;
      }, 0);
      return total + valorPedido;
    }, 0);
  };

  // Função para contar os itens nas entradas
  const contarItensEntradas = (pedidos: Pedido[]) => {
    return pedidos.reduce((total, pedido) => {
      const itensPedido = pedido.produtos.reduce((sum, produto) => {
        return sum + produto.quantidade;
      }, 0);
      return total + itensPedido;
    }, 0);
  };

  // Função para buscar dados do resumo
  const fetchSummaryData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      console.warn("Intervalo de datas não definido");
      return;
    }

    // Store in local variables to remove 'undefined' from the type
    const fromDate = dateRange.from;
    const toDate = dateRange.to;

    setLoading(true);
    setLoadingEntradas(true);
    setLoadingSaidas(true);

    try {
      // Buscar valor do estoque
      const stockValueResponse = await fetch("/api/dashboard/valor-estoque");
      const stockValueData = await stockValueResponse.json();

      // Buscar estoque crítico
      const lowStockResponse = await fetch("/api/dashboard/estoque-seguranca");
      const lowStockData = await lowStockResponse.json();

      // Buscar pedidos concluídos
      const startDate = fromDate.toISOString();
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999);

      // Usar a API específica de entradas para o dashboard
      const entradasResponse = await fetch(
        `/api/dashboard/entradas?period=custom&startDate=${startDate}&endDate=${endDate.toISOString()}`
      );

      if (!entradasResponse.ok) {
        throw new Error("Falha ao carregar dados de entradas");
      }

      const entradasDataResponse = await entradasResponse.json();
      console.log("Dados de entradas carregados:", entradasDataResponse);

      // Para o componente PedidosTable, ainda precisamos dos pedidos concluídos
      const params = new URLSearchParams();
      params.append("status", "concluido");
      params.append("startDate", startDate);
      params.append("endDate", endDate.toISOString());

      const pedidosResponse = await fetch(
        `/api/pedidos-compra?${params.toString()}`
      );

      if (!pedidosResponse.ok) {
        throw new Error("Falha ao carregar pedidos concluídos");
      }

      const pedidosData = await pedidosResponse.json();
      console.log("Pedidos carregados:", pedidosData.length);

      // Filtrar apenas os pedidos que estão dentro do intervalo de datas e têm produtos
      const filteredPedidos = pedidosData.filter((pedido: any) => {
        // Verificar se o pedido tem data de conclusão
        if (!pedido.dataConclusao) return false;

        // Verificar se a data está no intervalo
        const conclusionDate = new Date(pedido.dataConclusao);
        const isInRange =
          conclusionDate >= fromDate && conclusionDate <= endDate;

        // Verificar se tem produtos
        const hasProducts =
          pedido.produtos &&
          Array.isArray(pedido.produtos) &&
          pedido.produtos.length > 0;

        return isInRange && hasProducts;
      });

      console.log("Pedidos filtrados:", filteredPedidos.length);
      setEntradasData(filteredPedidos);

      // Buscar saídas
      const saidasResponse = await fetch("/api/saida");
      let saidasData = await saidasResponse.json();

      // Filtrar saídas pelo período
      saidasData = saidasData.filter((saida: any) => {
        const dataSaida = new Date(saida.data);
        return dataSaida >= fromDate && dataSaida <= endDate;
      });
      setSaidasData(saidasData);
      console.log("Saídas filtradas:", saidasData.length);

      // Calcular contagens e valores das entradas usando os dados da API especializada
      let entriesCount = 0;
      let entriesValue = 0;

      if (entradasDataResponse && entradasDataResponse.totals) {
        // Usar os totais fornecidos pela API de entradas
        entriesCount = entradasDataResponse.totals.quantidade || 0;
        entriesValue = entradasDataResponse.totals.valor || 0;
        console.log(
          `Usando dados da API: ${entriesCount} itens, valor ${entriesValue}`
        );
      } else {
        // Caso contrário, calcular dos pedidos filtrados (fallback)
        entriesCount = filteredPedidos.reduce((count: number, pedido: any) => {
          if (!pedido.produtos || !Array.isArray(pedido.produtos)) return count;
          return count + pedido.produtos.length;
        }, 0);

        entriesValue = filteredPedidos.reduce((value: number, pedido: any) => {
          if (!pedido.produtos || !Array.isArray(pedido.produtos)) return value;

          const pedidoValue = pedido.produtos.reduce(
            (total: number, produto: any) => {
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
        }, 0);
      }

      const outputsCount = saidasData.reduce((count: number, saida: any) => {
        if (!saida.detalhes || !Array.isArray(saida.detalhes)) return count;

        return (
          count +
          saida.detalhes.reduce(
            (sum: number, detalhe: any) => sum + (detalhe.quantidade || 0),
            0
          )
        );
      }, 0);

      // Atualizar dados de resumo
      setSummaryData({
        totalValue: stockValueData.valorTotal || "0",
        lowStockCount: lowStockData.length || 0,
        entriesCount: entriesCount || 0,
        entriesValue: entriesValue || 0,
        outputsCount: outputsCount || 0,
      });
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados do dashboard");

      // Definir valores seguros em caso de erro
      setSummaryData({
        totalValue: "0",
        lowStockCount: 0,
        entriesCount: 0,
        entriesValue: 0,
        outputsCount: 0,
      });
    } finally {
      setLoading(false);
      setLoadingEntradas(false);
      setLoadingSaidas(false);
      setLoadingData(false);
    }
  }, [dateRange]);

  // Função para formatar valores monetários
  const formatarValor = (valor: number) => {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  // Função para atualizar os dados
  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Renderização dos filtros do dashboard
  const renderFilters = () => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-[250px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar produtos, fornecedores..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 w-full"
              />
            </div>

            <Select
              value={periodoSelecionado}
              onValueChange={(value: string) =>
                aplicarPeriodoPredefinido(value as PeriodoKey)
              }
            >
              <SelectTrigger className="w-full md:w-[180px] h-10">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PERIODOS_PREDEFINIDOS).map(
                  ([key, { label }]) =>
                    key !== "custom" && (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    )
                )}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="min-w-[240px] justify-start text-left font-normal h-10"
                  id="date"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} -{" "}
                        {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                    )
                  ) : (
                    <span>Período personalizado</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <DatePickerWithRange
                  date={dateRange}
                  onDateChange={(date) => {
                    if (date === undefined) {
                      // Se a data for limpa, definir para o período padrão
                      const defaultDate: DateRange = {
                        from: subDays(new Date(), 30),
                        to: new Date(),
                      };
                      setDateRange(defaultDate);
                      setPeriodoSelecionado("30dias");
                    } else {
                      setDateRange(date);
                      // Verificar se corresponde a algum período predefinido
                      const isDefaultPeriod = Object.entries(
                        PERIODOS_PREDEFINIDOS
                      ).find(([_, data]) => {
                        // Verificamos se todos os valores existem para evitar erros
                        if (
                          !date.from ||
                          !date.to ||
                          !data.range.from ||
                          !data.range.to
                        ) {
                          return false;
                        }

                        // Agora podemos comparar com segurança
                        return (
                          data.range.from.toDateString() ===
                            date.from.toDateString() &&
                          data.range.to.toDateString() ===
                            date.to.toDateString()
                        );
                      });

                      setPeriodoSelecionado(
                        isDefaultPeriod
                          ? (isDefaultPeriod[0] as PeriodoKey)
                          : "custom"
                      );
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="ml-auto h-10 whitespace-nowrap"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Uma linha cinza clara para separar as opções de filtro */}
        <div className="w-full border-t my-3 border-gray-100 dark:border-gray-700"></div>

        {/* Conjunto de período rápido */}
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(PERIODOS_PREDEFINIDOS).map(
            ([key, { label }]) =>
              key !== "custom" && (
                <Button
                  key={key}
                  variant={periodoSelecionado === key ? "default" : "outline"}
                  className="h-8 px-3 text-xs"
                  onClick={() => aplicarPeriodoPredefinido(key as PeriodoKey)}
                >
                  {label}
                </Button>
              )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <Header name="Dashboard" />
          <p className="text-muted-foreground mt-1">
            Visão geral do seu sistema de estoque e movimentações
          </p>
        </div>

        {/* Indicador do período - agora clicável */}
        <div className="mt-4 sm:mt-0">
          <Popover>
            <PopoverTrigger asChild>
              <Badge
                variant="outline"
                className="text-sm py-1 px-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Calendar className="h-3 w-3 mr-1 inline" />
                {dateRange?.from && dateRange?.to ? (
                  <>
                    {format(dateRange.from, "dd/MM/yy", { locale: ptBR })} a{" "}
                    {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                  </>
                ) : (
                  "Últimos 30 dias"
                )}
                <ChevronsUpDown className="h-3 w-3 ml-1 inline" />
              </Badge>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <DatePickerWithRange
                date={dateRange}
                onDateChange={(date) => {
                  if (date === undefined) {
                    const defaultDate: DateRange = {
                      from: subDays(new Date(), 30),
                      to: new Date(),
                    };
                    setDateRange(defaultDate);
                  } else {
                    setDateRange(date);
                  }
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Cards de resumo - ALTURA FIXA para evitar redimensionamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array(4)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="shadow-sm h-[130px]">
                <CardContent className="p-6">
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))
        ) : (
          <>
            {/* Movimentação de valor - Card mais importante */}
            <Card
              className={`shadow-sm transition-all duration-300 cursor-pointer transform hover:scale-[1.02] h-[130px] ${
                activeView === "overview"
                  ? "bg-blue-50 border-blue-300 ring-2 ring-blue-300"
                  : "hover:shadow-md"
              }`}
              onClick={() => setActiveView("overview")}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Valor Total
                    </p>
                    <h3 className="text-2xl font-bold mt-1">
                      {parseFloat(summaryData.totalValue).toLocaleString(
                        "pt-BR",
                        { style: "currency", currency: "BRL" }
                      )}
                    </h3>
                  </div>
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      activeView === "overview" ? "bg-blue-200" : "bg-blue-100"
                    }`}
                  >
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cards de movimentação física agrupados juntos */}
            <Card
              className={`shadow-sm transition-all duration-300 cursor-pointer transform hover:scale-[1.02] h-[130px] ${
                activeView === "entradas"
                  ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-300"
                  : "hover:shadow-md"
              }`}
              onClick={() => setActiveView("entradas")}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Entradas
                    </p>
                    <h3 className="text-2xl font-bold mt-1 flex items-center">
                      <span className="mr-2">
                        {summaryData.entriesCount.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">
                        itens
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
                      {formatarValor(summaryData.entriesValue)}
                    </p>
                  </div>
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      activeView === "entradas"
                        ? "bg-emerald-200"
                        : "bg-emerald-100"
                    }`}
                  >
                    <ArrowUpIcon className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className={`shadow-sm transition-all duration-300 cursor-pointer transform hover:scale-[1.02] h-[130px] ${
                activeView === "saidas"
                  ? "bg-orange-50 border-orange-300 ring-2 ring-orange-300"
                  : "hover:shadow-md"
              }`}
              onClick={() => setActiveView("saidas")}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Saídas
                    </p>
                    <h3 className="text-2xl font-bold mt-1 flex items-center">
                      <span className="mr-2">
                        {summaryData.outputsCount.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-sm font-normal text-muted-foreground">
                        itens
                      </span>
                    </h3>
                  </div>
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      activeView === "saidas"
                        ? "bg-orange-200"
                        : "bg-orange-100"
                    }`}
                  >
                    <ArrowDownIcon className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alerta de estoque como elemento que requer atenção */}
            <Card
              className={`shadow-sm transition-all duration-300 cursor-pointer transform hover:scale-[1.02] border-red-200 h-[130px] ${
                activeView === "estoqueCritico"
                  ? "bg-red-100 border-red-400 ring-2 ring-red-400"
                  : "bg-red-50 hover:shadow-md"
              }`}
              onClick={() => setActiveView("estoqueCritico")}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">
                      Estoque Crítico
                    </p>
                    <h3 className="text-2xl font-bold mt-1 text-red-700 flex items-center">
                      <span className="mr-2">
                        {summaryData.lowStockCount.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-sm font-normal text-red-600">
                        {summaryData.lowStockCount === 1
                          ? "produto"
                          : "produtos"}
                      </span>
                    </h3>
                  </div>
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      activeView === "estoqueCritico"
                        ? "bg-red-300"
                        : "bg-red-200"
                    }`}
                  >
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filtros unificados */}
      {renderFilters()}

      {/* IMPORTANTE: Div com altura fixa para evitar redimensionamento */}
      <div className="transition-all duration-300 ease-in-out fixed-height-container min-h-[800px] relative">
        <div
          className={`${
            activeView === "overview"
              ? "opacity-100 relative z-10"
              : "opacity-0 absolute top-0 left-0 right-0 -z-10 pointer-events-none"
          } transition-opacity duration-300 w-full`}
        >
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

            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Reorganizando para melhor utilização do espaço em telas grandes */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 order-2 lg:order-1">
                  <FluxoFinanceiroChart />
                </div>
                <div className="order-1 lg:order-2">
                  <TopProdutosChart />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 order-2 lg:order-1">
                  <EntradasChart />
                </div>
                <div className="order-1 lg:order-2">
                  <CardValorEstoque />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div
          className={`${
            activeView === "entradas"
              ? "opacity-100 relative z-10"
              : "opacity-0 absolute top-0 left-0 right-0 -z-10 pointer-events-none"
          } transition-opacity duration-300 w-full`}
        >
          <Card className="shadow-md mb-6 overflow-hidden">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center">
                    <ArrowUpIcon className="mr-2 h-5 w-5 text-emerald-600" />
                    Histórico de Entradas
                  </CardTitle>
                  <CardDescription>
                    Pedidos confirmados e entradas no estoque
                  </CardDescription>
                </div>
                <div className="bg-emerald-50 rounded-md px-3 py-2 text-right">
                  <p className="text-sm text-emerald-700 font-medium">
                    Total no período:
                  </p>
                  <p className="text-lg font-bold text-emerald-700">
                    {formatarValor(summaryData.entriesValue)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    {summaryData.entriesCount.toLocaleString("pt-BR")} itens
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="mt-4 relative">
              {loadingEntradas ? (
                <PedidoEntradasLoadingSkeleton />
              ) : (
                <div className="relative">
                  <PedidosTable
                    status="concluido"
                    dateRange={dateRange}
                    searchTerm={searchTerm}
                    onRefresh={handleRefresh}
                  />
                  {loadingEntradas && (
                    <div className="loading-overlay">
                      <div className="spinner" />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div
          className={`${
            activeView === "saidas"
              ? "opacity-100 relative z-10"
              : "opacity-0 absolute top-0 left-0 right-0 -z-10 pointer-events-none"
          } transition-opacity duration-300 w-full`}
        >
          <Card className="shadow-md mb-6 overflow-hidden">
            <CardHeader className="pb-0">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center">
                    <ArrowDownIcon className="mr-2 h-5 w-5 text-orange-600" />
                    Histórico de Saídas
                  </CardTitle>
                  <CardDescription>
                    Registros de saídas de produtos do estoque
                  </CardDescription>
                </div>
                <div className="bg-orange-50 rounded-md px-3 py-2 text-right">
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
            <CardContent className="mt-4">
              {loadingSaidas ? (
                <SaidaLoadingSkeleton />
              ) : (
                <SaidaList saidas={saidasData} />
              )}
            </CardContent>
          </Card>
        </div>

        <div
          className={`${
            activeView === "estoqueCritico"
              ? "opacity-100 relative z-10"
              : "opacity-0 absolute top-0 left-0 right-0 -z-10 pointer-events-none"
          } transition-opacity duration-300 w-full`}
        >
          <Card className="shadow-md border-red-200 bg-red-50 mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center">
                    <AlertTriangle className="mr-2 h-5 w-5 text-red-600" />
                    Alerta de Estoque de Segurança
                  </CardTitle>
                  <CardDescription className="text-red-700">
                    Produtos que estão abaixo do estoque mínimo definido
                  </CardDescription>
                </div>
                <div className="bg-red-100 rounded-md px-3 py-2">
                  <p className="text-sm text-red-700 font-semibold text-right">
                    {summaryData.lowStockCount}{" "}
                    {summaryData.lowStockCount === 1 ? "produto" : "produtos"}{" "}
                    abaixo do estoque mínimo
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <EstoqueSegurancaCard searchTerm={searchTerm} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Estilos CSS para animação e layout fixo */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }

        .fixed-height-container > div {
          min-height: 800px;
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
