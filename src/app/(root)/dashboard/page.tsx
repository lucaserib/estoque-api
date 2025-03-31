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

// Adicionar interfaces para os dados dos cards individuais
interface ValorEstoqueData {
  valorTotal: number;
  quantidadeTotal: number;
  valorMedio?: number;
}

interface EstoqueCritico {
  id: string;
  nome: string;
  sku: string;
  quantidade: number;
  estoqueSeguranca: number;
  armazem: string;
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

  // Adicionar estados para os dados específicos dos cards
  const [valorEstoqueData, setValorEstoqueData] = useState<ValorEstoqueData>({
    valorTotal: 0,
    quantidadeTotal: 0,
    valorMedio: 0,
  });
  const [estoqueCriticoData, setEstoqueCriticoData] = useState<
    EstoqueCritico[]
  >([]);
  const [valorEstoqueError, setValorEstoqueError] = useState<string | null>(
    null
  );
  const [estoqueCriticoError, setEstoqueCriticoError] = useState<string | null>(
    null
  );

  const carregarDadosVisualizacoes = useCallback(async () => {
    try {
      console.log("Dados das visualizações atualizados");
    } catch (error) {
      console.error("Erro ao carregar dados das visualizações:", error);
    }
  }, []);

  const fetchSummaryData = useCallback(async () => {
    // Adicionar timeout de segurança para evitar que isUpdating fique preso como true
    const securityTimeout = setTimeout(() => {
      if (isUpdating.current) {
        console.log("Detectado bloqueio por isUpdating. Liberando flag.");
        isUpdating.current = false;
      }
    }, 10000); // Timeout de 10 segundos como salvaguarda

    if (isUpdating.current) {
      console.log("Já existe uma atualização em andamento, ignorando");
      clearTimeout(securityTimeout); // Limpar timeout se não prosseguirmos
      return;
    }

    // Registrar timestamp de refresh
    lastRefreshTimestamp.current = Date.now();

    // Validar se as datas são válidas antes de prosseguir
    if (!dateFilter.startDate || !dateFilter.endDate) {
      console.warn("Filtro de datas não definido, utilizando período padrão");

      // Em vez de retornar, definir um período padrão (últimos 30 dias)
      const defaultEnd = new Date();
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 30);

      // Garantir horas corretas
      defaultStart.setHours(0, 0, 0, 0);
      defaultEnd.setHours(23, 59, 59, 999);

      setDateFilter({
        startDate: defaultStart.toISOString(),
        endDate: defaultEnd.toISOString(),
      });

      // Não definir isUpdating.current = false aqui, pois vamos continuar o carregamento
    }

    isUpdating.current = true;
    setLoading(true);
    setLoadingEntradas(true);
    setLoadingSaidas(true);
    setLoadingData(true);

    // Exibir feedback visual para o usuário
    toast.info("Atualizando dados do dashboard...", {
      duration: 2000,
    });

    try {
      console.log("Buscando dados com filtros:", {
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
        periodoSelecionado,
        refreshTrigger,
      });

      // Variáveis para armazenar os dados que serão usados no setSummaryData
      let valorTotalEstoque = 0;
      let lowStockCount = 0;

      // Buscar dados de valor de estoque centralizado
      try {
        const stockValueResponse = await fetch("/api/dashboard/valor-estoque", {
          credentials: "include",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        });

        if (!stockValueResponse.ok) {
          throw new Error(
            `Falha ao obter dados do estoque: ${stockValueResponse.status}`
          );
        }

        const stockValueData = await stockValueResponse.json();
        console.log("Dados de valor de estoque recebidos:", stockValueData);

        valorTotalEstoque = stockValueData.valorTotal || 0;
        const quantidadeTotal = stockValueData.quantidadeTotal || 0;

        // Calcular valor médio por item (em centavos)
        const valorMedio =
          quantidadeTotal > 0
            ? Math.round(valorTotalEstoque / quantidadeTotal)
            : 0;

        setValorEstoqueData({
          valorTotal: valorTotalEstoque,
          quantidadeTotal,
          valorMedio,
        });
        setValorEstoqueError(null);
      } catch (error) {
        console.error("Erro ao carregar valor de estoque:", error);
        setValorEstoqueError("Não foi possível carregar os dados do estoque");
      }

      // Buscar dados de estoque crítico centralizado
      try {
        const lowStockResponse = await fetch(
          "/api/dashboard/estoque-seguranca",
          {
            credentials: "include",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );

        if (!lowStockResponse.ok) {
          throw new Error(
            `Falha ao obter dados de estoque crítico: ${lowStockResponse.status}`
          );
        }

        const lowStockData = await lowStockResponse.json();
        console.log("Dados de estoque crítico recebidos:", lowStockData);

        setEstoqueCriticoData(lowStockData);
        lowStockCount = lowStockData.length || 0;
        setEstoqueCriticoError(null);
      } catch (error) {
        console.error("Erro ao carregar estoque crítico:", error);
        setEstoqueCriticoError(
          "Não foi possível carregar os dados de estoque crítico"
        );
      }

      // Modificar como os parâmetros são enviados para a API, evitando problemas de formato
      const params = new URLSearchParams();
      params.append("period", "custom");

      // Garantir que as datas estão em formato ISO
      const apiStartDate = dateFilter.startDate
        ? new Date(dateFilter.startDate).toISOString()
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const apiEndDate = dateFilter.endDate
        ? new Date(dateFilter.endDate).toISOString()
        : new Date().toISOString();

      params.append("startDate", apiStartDate);
      params.append("endDate", apiEndDate);

      const entradasResponse = await fetch(
        `/api/dashboard/entradas?${params.toString()}`
      );

      if (!entradasResponse.ok) {
        throw new Error("Falha ao carregar dados de entradas");
      }

      const entradasDataResponse = await entradasResponse.json();
      console.log("Dados de entradas carregados:", entradasDataResponse);

      // Para o componente PedidosTable, buscar os pedidos concluídos
      const pedidosParams = new URLSearchParams();
      pedidosParams.append("status", "confirmado");
      pedidosParams.append("startDate", apiStartDate);
      pedidosParams.append("endDate", apiEndDate);

      const pedidosResponse = await fetch(
        `/api/pedidos-compra?${pedidosParams.toString()}`
      );

      if (!pedidosResponse.ok) {
        throw new Error("Falha ao carregar pedidos concluídos");
      }

      const pedidosData = await pedidosResponse.json();
      console.log("Pedidos carregados:", pedidosData.length);
      const filterStartDate = new Date(apiStartDate);
      const filterEndDate = new Date(apiEndDate);

      const filteredPedidos = pedidosData.filter((pedido: PedidoAPI) => {
        if (!pedido.dataConclusao) return false;

        const conclusionDate = new Date(pedido.dataConclusao);
        const isInRange =
          conclusionDate >= filterStartDate && conclusionDate <= filterEndDate;

        const hasProducts =
          pedido.produtos &&
          Array.isArray(pedido.produtos) &&
          pedido.produtos.length > 0;

        return isInRange && hasProducts;
      });

      console.log("Pedidos filtrados para exibição:", filteredPedidos.length);
      setEntradasData(filteredPedidos);
      const saidasParams = new URLSearchParams();
      saidasParams.append("startDate", apiStartDate);
      saidasParams.append("endDate", apiEndDate);

      const saidasResponse = await fetch(
        `/api/saida?${saidasParams.toString()}`
      );
      const saidasData = await saidasResponse.json();

      const filteredSaidas = saidasData.filter((saida: Saida) => {
        if (!saida.data) return false;

        const dataSaida = new Date(saida.data);
        return dataSaida >= filterStartDate && dataSaida <= filterEndDate;
      });

      setSaidasData(filteredSaidas);
      console.log("Saídas filtradas:", filteredSaidas.length);

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

      console.log("Comparação de valores:", {
        entradasAPI: {
          quantidade: entradasDataResponse?.totals?.quantidade || 0,
          valor: entradasDataResponse?.totals?.valor || 0,
        },
        pedidosCalculados: {
          quantidade: entriesCount,
          valor: entriesValue,
        },
        pedidosNaTabela: filteredPedidos.length,
        saidasNaTabela: filteredSaidas.length,
        filtroDatas: {
          de: apiStartDate,
          ate: apiEndDate,
        },
      });

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
        lowStockCount: lowStockCount,
        entriesCount: entriesCount || 0,
        entriesValue: entriesValue || 0,
        outputsCount: outputsCount || 0,
      });

      console.log("Valor total do estoque:", {
        valorEmCentavos: valorTotalEstoque,
        valorFormatado: exibirValorEmReais(valorTotalEstoque),
      });

      await carregarDadosVisualizacoes();
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
      toast.error("Erro ao carregar dados do dashboard");

      setSummaryData({
        totalValue: 0,
        lowStockCount: 0,
        entriesCount: 0,
        entriesValue: 0,
        outputsCount: 0,
      });
    } finally {
      // Limpar o timeout de segurança
      clearTimeout(securityTimeout);

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
    refreshTrigger,
  ]);

  const handleRefresh = useCallback(() => {
    console.log("Disparando refresh manual");
    // Evitar múltiplas atualizações num curto período
    if (Date.now() - lastRefreshTimestamp.current < 500) {
      console.log(
        "Refresh ignorado - tempo mínimo entre atualizações não atingido"
      );
      return;
    }

    lastRefreshTimestamp.current = Date.now();

    // Garantir que isUpdating está resetado para não bloquear a atualização
    setTimeout(() => {
      isUpdating.current = false;
      setRefreshTrigger((prev) => prev + 1);
    }, 0);
  }, []);

  // Adicionar o efeito para inicialização do dashboard
  useEffect(() => {
    console.log("Dashboard montado - inicializando uma única vez");

    // Definir as datas padrão (últimos 30 dias)
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    // Garantir horas corretas
    thirtyDaysAgo.setHours(0, 0, 0, 0);
    today.setHours(23, 59, 59, 999);

    // Atualizar estados de forma síncrona para evitar múltiplas atualizações
    setDateRange({
      from: thirtyDaysAgo,
      to: today,
    });

    setPeriodoSelecionado("30dias");

    // Definir filtros de data
    setDateFilter({
      startDate: thirtyDaysAgo.toISOString(),
      endDate: today.toISOString(),
    });

    // Garantir que não estamos em atualização
    isUpdating.current = false;

    // Disparar atualização apenas uma vez na montagem
    const timer = setTimeout(() => {
      console.log("Primeira carga de dados");
      setRefreshTrigger(1); // Definir como 1 diretamente, não incrementar
    }, 500);

    // Limpar o timer se o componente for desmontado
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependência vazia para executar apenas na montagem

  // Efeito para atualização quando refreshTrigger muda
  useEffect(() => {
    // Ignorar a primeira renderização (quando refreshTrigger ainda é 0)
    if (refreshTrigger === 0) return;

    console.log(`Atualizando dados (trigger: ${refreshTrigger})`);

    // Evitar atualizações duplicadas
    const currentTime = Date.now();
    const timeSinceLastRefresh = currentTime - lastRefreshTimestamp.current;

    // Se faz menos de 300ms desde a última atualização ou já estamos atualizando, ignorar
    if (timeSinceLastRefresh < 300 || isUpdating.current) {
      console.log(
        `Ignorando atualização duplicada (${timeSinceLastRefresh}ms desde a última)`
      );
      return;
    }

    // Fazer a requisição
    fetchSummaryData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // Função para aplicar período predefinido
  const aplicarPeriodoPredefinido = useCallback(
    (periodo: string) => {
      // Evitar redefinir o mesmo período
      if (periodoSelecionado === periodo) {
        console.log(`Período ${periodo} já está selecionado, ignorando`);
        return;
      }

      // Primeiro, atualizar o estado do período
      setPeriodoSelecionado(periodo as PeriodoKey);

      // Criar datas usando UTC para garantir consistência
      const now = new Date();
      const today = new Date(now);
      today.setHours(23, 59, 59, 999);

      let startDate = new Date(now);
      let endDate = new Date(today);

      try {
        switch (periodo) {
          case "hoje":
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(today);
            break;
          case "ontem":
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setDate(now.getDate() - 1);
            endDate.setHours(23, 59, 59, 999);
            break;
          case "7dias":
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6); // 7 dias inclui hoje
            startDate.setHours(0, 0, 0, 0);
            break;
          case "15dias":
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 14); // 15 dias inclui hoje
            startDate.setHours(0, 0, 0, 0);
            break;
          case "30dias":
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 29); // 30 dias inclui hoje
            startDate.setHours(0, 0, 0, 0);
            break;
          case "90dias":
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 89); // 90 dias inclui hoje
            startDate.setHours(0, 0, 0, 0);
            break;
          case "esteMes":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            break;
          case "mesPassado":
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            endDate.setHours(23, 59, 59, 999);
            break;
          default:
            startDate.setDate(now.getDate() - 29); // Padrão: últimos 30 dias
            startDate.setHours(0, 0, 0, 0);
        }

        console.log(`Período aplicado: ${periodo}`, {
          de: startDate.toISOString(),
          ate: endDate.toISOString(),
        });

        // Atualizar o dateRange sem provocar loop
        setDateRange({ from: startDate, to: endDate });

        // Atualizar diretamente o dateFilter para evitar esperar o efeito
        const startDateISO = startDate.toISOString();
        const endDateISO = endDate.toISOString();

        // Verificar se os filtros realmente mudaram
        if (
          dateFilter.startDate !== startDateISO ||
          dateFilter.endDate !== endDateISO
        ) {
          setDateFilter({
            startDate: startDateISO,
            endDate: endDateISO,
          });

          // Aguardar antes de disparar o refresh
          setTimeout(() => {
            if (!isUpdating.current) {
              handleRefresh();
            }
          }, 200);
        }
      } catch (error) {
        console.error("Erro ao aplicar período:", error);
        toast.error("Erro ao aplicar filtro de período");
      }
    },
    [periodoSelecionado, dateFilter, handleRefresh]
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

  // Atualizar handleClearFilters para usar o novo padrão
  const handleClearFilters = useCallback(() => {
    console.log("Limpando todos os filtros");

    // Limpar o campo de busca
    setSearchTerm("");

    // Configurar período padrão (30 dias)
    setPeriodoSelecionado("30dias");

    // Criar novas datas
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    // Garantir horas corretas para evitar problemas de comparação
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    // Atualizar estados
    setDateRange({
      from: startDate,
      to: endDate,
    });

    // Definir filtros de data para API
    setDateFilter({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Garantir que isUpdating está resetado
    isUpdating.current = false;

    // Disparar atualização com valor específico para evitar loops
    setRefreshTrigger((prevTrigger) => {
      const newTrigger = prevTrigger + 1;
      console.log(`Definindo novo trigger: ${newTrigger}`);
      return newTrigger;
    });
  }, []);

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
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="gap-1.5"
            disabled={
              loading || loadingData || loadingEntradas || loadingSaidas
            }
          >
            <XCircle className="h-4 w-4" />
            <span>Limpar filtros</span>
          </Button>

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
        onClearFilters={handleClearFilters}
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
                          <CardValorEstoque
                            data={valorEstoqueData}
                            loading={loadingData}
                            error={valorEstoqueError}
                            onRetry={handleRefresh}
                          />
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
                <EstoqueSegurancaCard
                  data={estoqueCriticoData}
                  loading={loadingData}
                  searchTerm={searchTerm}
                  onRetry={handleRefresh}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
