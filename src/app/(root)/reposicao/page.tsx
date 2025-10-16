"use client";

import { useState, useEffect } from "react";
import Header from "@/app/components/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  RefreshCw,
  AlertCircle,
  Search,
  Package,
  TrendingDown,
} from "lucide-react";
import { ReplenishmentSummaryCards } from "./components/ReplenishmentSummaryCards";
import { ReplenishmentTableRow } from "./components/ReplenishmentTableRow";
import { ReplenishmentDetailModal } from "./components/ReplenishmentDetailModal";

interface BatchAnalysisResult {
  produtoId: string;
  produtoNome: string;
  sku: string;
  custoMedio: number;
  tipoAnuncio: "full" | "local" | "ambos";
  estoqueLocal: number;
  estoqueFull: number;
  estoqueTotal: number;
  mediaVendasPeriodo: number;
  mediaDiaria: number;
  analysisPeriodDays: number;
  statusGeral: "ok" | "atencao" | "critico";
  reposicaoFull: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number;
  } | null;
  reposicaoLocal: {
    necessaria: boolean;
    quantidadeSugerida: number;
    diasRestantes: number;
    status: "ok" | "atencao" | "critico";
    custoTotal: number;
  };
  custoTotalReposicao: number;
}

interface BatchAnalysisResponse {
  success: boolean;
  results: BatchAnalysisResult[];
  summary: {
    total: number;
    critico: number;
    atencao: number;
    ok: number;
    custoTotalCritico: number;
    custoTotalAtencao: number;
    custoTotalGeral: number;
  };
}

const ReposicaoPage = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string | null>(
    null
  );
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [analysisData, setAnalysisData] = useState<BatchAnalysisResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/replenishment/batch-analysis");
      if (!response.ok) {
        throw new Error("Erro ao buscar análise");
      }
      const data = await response.json();
      setAnalysisData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      console.error("Erro ao buscar análise:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refetch = fetchData;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await refetch();
      toast.success("Análise de reposição atualizada!");
    } catch (error) {
      toast.error("Erro ao analisar produtos");
      console.error("Erro na análise:", error);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewDetails = (produtoId: string) => {
    setSelectedProdutoId(produtoId);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedProdutoId(null);
  };

  const handleConfigUpdated = () => {
    // Recarregar análise após atualização de configuração
    refetch();
  };

  return (
    <div className="flex flex-col w-full">
      <Header name="Reposição de Estoque" />

      <div className="p-4 md:p-6 space-y-6">
        {/* Header com ação */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Análise de Reposição
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Produtos que precisam de reposição urgente
            </p>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || loading}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            {analyzing || loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Verificar Estoque
              </>
            )}
          </Button>
        </div>

        {/* Alerta informativo */}
        <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Importante:</strong> Esta análise considera as configurações
            de reposição de cada produto. Para ajustar os parâmetros, acesse a
            página de Produtos e clique em "Ver Reposição" no produto desejado.
          </AlertDescription>
        </Alert>

        {/* Loading State */}
        {loading && !analysisData && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-96" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Erro ao carregar análise de reposição. Tente novamente.
            </AlertDescription>
          </Alert>
        )}

        {/* Success State - Com Dados */}
        {analysisData && !loading && analysisData.summary && (
          <>
            {/* Cards de Resumo */}
            <ReplenishmentSummaryCards summary={analysisData.summary} />

            {/* Tabela de Produtos */}
            <Card className="border-gray-200 dark:border-gray-700">
              <CardContent className="p-0">
                {(analysisData?.results?.length || 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                      <Package className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      Nenhum produto precisa de reposição
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
                      Todos os produtos estão com estoque adequado. Clique em
                      "Verificar Estoque" para atualizar a análise.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Produto
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Estoque Local
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Estoque Full
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Dias Rest.
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Média/Dia
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Repor Full
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Comprar
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Custo Total
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                        {analysisData?.results?.map((item) => (
                          <ReplenishmentTableRow
                            key={item.produtoId}
                            item={item}
                            onViewDetails={handleViewDetails}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Rodapé com estatísticas */}
            {(analysisData?.results?.length || 0) > 0 && (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <TrendingDown className="h-4 w-4" />
                  <span>
                    Exibindo {analysisData?.results?.length || 0} produto(s) que precisam
                    de atenção
                  </span>
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Investimento necessário:{" "}
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(analysisData?.summary?.custoTotalGeral || 0)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Detalhes */}
      {selectedProdutoId && (
        <ReplenishmentDetailModal
          produtoId={selectedProdutoId}
          isOpen={showDetailsModal}
          onClose={handleCloseModal}
          onConfigUpdated={handleConfigUpdated}
        />
      )}
    </div>
  );
};

export default ReposicaoPage;
