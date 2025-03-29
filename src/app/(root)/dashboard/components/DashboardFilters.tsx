import { useState } from "react";
import { DateRange } from "react-day-picker";
import { format, subDays } from "date-fns";
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
  Calendar,
  Search,
  XCircle,
  Info,
  Loader2,
  CheckCircle,
  FilterIcon,
  ArrowDownUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMediaQuery } from "@/hooks/use-media-query";

// Predefinições para períodos com tipagem correta
export type PeriodoKey =
  | "hoje"
  | "ontem"
  | "7dias"
  | "15dias"
  | "30dias"
  | "90dias"
  | "esteMes"
  | "mesPassado"
  | "custom";

export const PERIODOS_PREDEFINIDOS: Record<
  PeriodoKey,
  { label: string; range: DateRange }
> = {
  hoje: {
    label: "Hoje",
    range: {
      from: new Date(),
      to: new Date(),
    },
  },
  ontem: {
    label: "Ontem",
    range: {
      from: subDays(new Date(), 1),
      to: subDays(new Date(), 1),
    },
  },
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
  esteMes: {
    label: "Este mês",
    range: {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    },
  },
  mesPassado: {
    label: "Mês passado",
    range: {
      from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      to: new Date(new Date().getFullYear(), new Date().getMonth(), 0),
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

export const PERIODOS_PREDEFINIDOS_ARRAY = Object.entries(
  PERIODOS_PREDEFINIDOS
).map(([key, { label }]) => ({ key, label }));

interface DashboardFiltersProps {
  dateRange: DateRange | undefined;
  setDateRange: (dateRange: DateRange | undefined) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  periodoSelecionado: PeriodoKey;
  setPeriodoSelecionado: (periodo: PeriodoKey) => void;
  aplicarPeriodoPredefinido: (periodo: string) => void;
  isLoading: boolean;
}

export const DashboardFilters = ({
  dateRange,
  setDateRange,
  searchTerm,
  setSearchTerm,
  periodoSelecionado,
  setPeriodoSelecionado,
  aplicarPeriodoPredefinido,
  isLoading,
}: DashboardFiltersProps) => {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Função para renderizar o resumo do período selecionado
  const renderPeriodoSelecionado = () => {
    if (
      periodoSelecionado !== "custom" &&
      PERIODOS_PREDEFINIDOS[periodoSelecionado]
    ) {
      return PERIODOS_PREDEFINIDOS[periodoSelecionado].label;
    }

    if (dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "dd/MM/yyyy", {
        locale: ptBR,
      })} - ${format(dateRange.to, "dd/MM/yyyy", { locale: ptBR })}`;
    }

    return "Selecione um período";
  };

  return (
    <div className="mt-6 bg-white rounded-lg p-4 border shadow-sm">
      {/* Cabeçalho do filtro com toggle para mobile */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Filtros do Dashboard</h3>
        </div>

        {!isDesktop && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="flex items-center gap-1"
          >
            <ArrowDownUp className="h-3 w-3" />
            {showMobileFilters ? "Ocultar filtros" : "Mostrar filtros"}
          </Button>
        )}
      </div>

      {/* Conteúdo principal dos filtros */}
      <div className={!isDesktop && !showMobileFilters ? "hidden" : ""}>
        {/* Filtro de período */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Período</h3>
            <div className="flex flex-wrap gap-2">
              {PERIODOS_PREDEFINIDOS_ARRAY.slice(0, 6).map((periodo) => (
                <Button
                  key={periodo.key}
                  size="sm"
                  variant={
                    periodoSelecionado === periodo.key ? "default" : "outline"
                  }
                  className={
                    periodoSelecionado === periodo.key
                      ? "bg-primary text-primary-foreground"
                      : ""
                  }
                  onClick={() => aplicarPeriodoPredefinido(periodo.key)}
                >
                  {periodo.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Período Personalizado</h3>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start text-left font-normal gap-2 bg-white hover:bg-gray-50 border-gray-200"
                  >
                    <Calendar className="h-4 w-4 text-gray-500" />
                    <span className="truncate">
                      {renderPeriodoSelecionado()}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <DatePickerWithRange
                    date={dateRange}
                    onDateChange={(newRange) => {
                      if (newRange) {
                        setDateRange(newRange);
                        setPeriodoSelecionado("custom");
                      } else {
                        // Se limpar a seleção, voltar para 30 dias
                        setPeriodoSelecionado("30dias");
                        aplicarPeriodoPredefinido("30dias");
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>

              {dateRange?.from && dateRange?.to && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDateRange(undefined);
                    setPeriodoSelecionado("30dias");
                    aplicarPeriodoPredefinido("30dias");
                  }}
                  className="gap-1"
                >
                  <XCircle className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:inline-block">
                    Limpar
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Feedback visual do período aplicado */}
        {dateRange?.from && dateRange?.to && (
          <div className="mt-4 pt-3 border-t text-sm text-muted-foreground flex flex-wrap items-center gap-2">
            <div className="flex items-center">
              <Info className="h-4 w-4 mr-2 text-blue-500" />
              <span>
                Exibindo dados de{" "}
                <strong>{dateRange.from.toLocaleDateString("pt-BR")}</strong>{" "}
                até <strong>{dateRange.to.toLocaleDateString("pt-BR")}</strong>
              </span>
            </div>

            {isLoading ? (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200"
              >
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Atualizando...
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Dados atualizados
              </Badge>
            )}
          </div>
        )}

        {/* Campo de busca para filtragem local */}
        <div className="mt-4 pt-3 border-t">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por produtos, fornecedores ou números de pedidos..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardFilters;
