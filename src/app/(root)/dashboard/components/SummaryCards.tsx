import {
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { exibirValorEmReais } from "@/utils/currency";

interface DashboardSummaryData {
  entriesCount: number;
  entriesValue: number;
  outputsCount: number;
  totalValue: number;
  lowStockCount: number;
}

interface SummaryCardsProps {
  summaryData: DashboardSummaryData;
  activeView: string;
  setActiveView: (view: string) => void;
  loadingData: boolean;
  loadingEntradas: boolean;
  loadingSaidas: boolean;
}

export const SummaryCards = ({
  summaryData,
  activeView,
  setActiveView,
  loadingData,
  loadingEntradas,
  loadingSaidas,
}: SummaryCardsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Card 1: Movimentação de valor - Card mais importante */}
      <Card
        className={`shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md ${
          activeView === "overview"
            ? "bg-blue-50 border-blue-300 ring-2 ring-blue-300"
            : ""
        }`}
        onClick={() => setActiveView("overview")}
      >
        <CardContent className="p-6 relative h-full flex items-center justify-center">
          {loadingData && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] z-10 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          )}
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Valor Total
              </p>
              <h3 className="text-2xl font-bold mt-1">
                {exibirValorEmReais(summaryData.totalValue)}
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

      {/* Card 2: Entradas */}
      <Card
        className={`shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md ${
          activeView === "entradas"
            ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-300"
            : ""
        }`}
        onClick={() => setActiveView("entradas")}
      >
        <CardContent className="p-6 relative h-full flex items-center justify-center">
          {loadingEntradas && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] z-10 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          )}
          <div className="flex items-center justify-between w-full">
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
                {exibirValorEmReais(summaryData.entriesValue)}
              </p>
            </div>
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                activeView === "entradas" ? "bg-emerald-200" : "bg-emerald-100"
              }`}
            >
              <ArrowDownLeft className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Saídas */}
      <Card
        className={`shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md ${
          activeView === "saidas"
            ? "bg-orange-50 border-orange-300 ring-2 ring-orange-300"
            : ""
        }`}
        onClick={() => setActiveView("saidas")}
      >
        <CardContent className="p-6 relative h-full flex items-center justify-center">
          {loadingSaidas && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] z-10 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          )}
          <div className="flex items-center justify-between w-full">
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
                activeView === "saidas" ? "bg-orange-200" : "bg-orange-100"
              }`}
            >
              <ArrowUpRight className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 4: Estoque Crítico */}
      <Card
        className={`shadow-sm transition-all duration-300 cursor-pointer hover:shadow-md ${
          activeView === "estoqueCritico"
            ? "bg-red-100 border-red-400 ring-2 ring-red-400"
            : "bg-red-50"
        }`}
        onClick={() => setActiveView("estoqueCritico")}
      >
        <CardContent className="p-6 relative h-full flex items-center justify-center">
          {loadingData && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[2px] z-10 rounded-lg">
              <Loader2 className="h-8 w-8 animate-spin text-red-500" />
            </div>
          )}
          <div className="flex items-center justify-between w-full">
            <div>
              <p className="text-sm font-medium text-red-600">
                Estoque Crítico
              </p>
              <h3 className="text-2xl font-bold mt-1 text-red-700 flex items-center">
                <span className="mr-2">
                  {summaryData.lowStockCount.toLocaleString("pt-BR")}
                </span>
                <span className="text-sm font-normal text-red-600">
                  {summaryData.lowStockCount === 1 ? "produto" : "produtos"}
                </span>
              </h3>
            </div>
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                activeView === "estoqueCritico" ? "bg-red-300" : "bg-red-200"
              }`}
            >
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SummaryCards;
